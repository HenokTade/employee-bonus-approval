/**
 * Reset all user passwords to Test@123
 * Run this if passwords are not working
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function resetPasswords() {
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        const password = 'Test@123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('\n🔄 Resetting all user passwords to: Test@123');
        
        const result = await client.query(
            'UPDATE users SET hashed_password = $1, failed_login_attempts = 0, locked_until = NULL',
            [hashedPassword]
        );
        
        console.log(`✅ Updated ${result.rowCount} user passwords`);
        console.log('\n📝 All users now have password: Test@123');
        console.log('\n✅ Password reset completed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

resetPasswords();




