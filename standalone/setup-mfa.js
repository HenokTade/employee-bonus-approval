const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function setupMFA() {
    try {
        await client.connect();
        console.log('\n🔐 SETTING UP MFA FOR EXISTING USERS');
        console.log('='.repeat(60) + '\n');
        
        // Get all users that should have MFA (Manager+ roles)
        const result = await client.query(
            `SELECT id, email, name, role, mfa_enabled, mfa_secret 
             FROM users 
             WHERE role IN ('manager', 'dept_head', 'hr_admin', 'system_admin')
             ORDER BY email`
        );
        
        if (result.rows.length === 0) {
            console.log('No users found that require MFA.\n');
            return;
        }
        
        const qrCodesDir = path.join(__dirname, 'qr-codes');
        if (!fs.existsSync(qrCodesDir)) {
            fs.mkdirSync(qrCodesDir);
        }
        
        console.log(`Found ${result.rows.length} users requiring MFA:\n`);
        
        for (const user of result.rows) {
            let mfaSecret = user.mfa_secret;
            let needsUpdate = false;
            
            // Generate new secret if missing
            if (!mfaSecret) {
                const secret = speakeasy.generateSecret({
                    name: `SEPBAS (${user.email})`,
                    issuer: 'AASTU SEPBAS',
                });
                mfaSecret = secret.base32;
                needsUpdate = true;
            }
            
            // Generate QR code
            const otpauth = speakeasy.otpauthURL({
                secret: mfaSecret,
                encoding: 'base32',
                label: user.email,
                issuer: 'AASTU SEPBAS'
            });
            
            const qrDataUrl = await QRCode.toDataURL(otpauth);
            
            // Save QR code as image file
            const qrImagePath = path.join(qrCodesDir, `${user.email.replace('@', '_at_')}.png`);
            const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
            fs.writeFileSync(qrImagePath, base64Data, 'base64');
            
            // Update database if needed
            if (needsUpdate || !user.mfa_enabled) {
                await client.query(
                    'UPDATE users SET mfa_enabled = true, mfa_secret = $1 WHERE id = $2',
                    [mfaSecret, user.id]
                );
            }
            
            console.log(`✅ ${user.name} (${user.email})`);
            console.log(`   Role: ${user.role}`);
            console.log(`   QR Code saved: ${qrImagePath}`);
            console.log(`   QR Code Data URL: ${qrDataUrl.substring(0, 80)}...`);
            console.log('');
        }
        
        console.log('='.repeat(60));
        console.log('\n📱 NEXT STEPS:');
        console.log('1. Open the QR code images from the "qr-codes" folder');
        console.log('2. Or use the QR Code Data URLs above (paste in browser)');
        console.log('3. Scan with Google Authenticator app');
        console.log('4. Login with username/password + 6-digit code\n');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

setupMFA();

