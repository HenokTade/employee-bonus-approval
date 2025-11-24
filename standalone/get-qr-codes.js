const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function generateQRCodes() {
    try {
        await client.connect();
        console.log('\n📱 MFA QR CODES FOR EXISTING USERS');
        console.log('='.repeat(60) + '\n');
        
        const result = await client.query(
            'SELECT email, name, mfa_secret, mfa_enabled FROM users WHERE mfa_enabled = true ORDER BY email'
        );
        
        if (result.rows.length === 0) {
            console.log('No users with MFA enabled found.\n');
            return;
        }
        
        for (const user of result.rows) {
            const otpauth = speakeasy.otpauthURL({
                secret: user.mfa_secret,
                encoding: 'base32',
                label: user.email,
                issuer: 'AASTU SEPBAS'
            });
            
            const qrDataUrl = await QRCode.toDataURL(otpauth);
            
            console.log(`User: ${user.name} (${user.email})`);
            console.log('QR Code Data URL (copy and paste in browser):');
            console.log(qrDataUrl);
            console.log('\n' + '-'.repeat(60) + '\n');
        }
        
        console.log('📖 INSTRUCTIONS:');
        console.log('1. Copy ONE of the QR Code Data URLs above');
        console.log('2. Open a new browser tab');
        console.log('3. Paste the entire URL in the address bar and press Enter');
        console.log('4. The QR code will be displayed');
        console.log('5. Open Google Authenticator app on your phone');
        console.log('6. Tap the "+" button and choose "Scan a QR code"');
        console.log('7. Scan the QR code from your browser');
        console.log('8. Done! Now you can login with the 6-digit code\n');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

generateQRCodes();

