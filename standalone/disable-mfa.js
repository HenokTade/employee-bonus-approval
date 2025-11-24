const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function disableMFA() {
    try {
        await client.connect();
        
        await client.query('UPDATE users SET mfa_enabled = false');
        
        console.log('\n✅ MFA DISABLED FOR ALL USERS\n');
        console.log('You can now login without needing Google Authenticator:');
        console.log('');
        console.log('Test Accounts (all passwords: Test@123):');
        console.log('  • admin@aastu.edu.et (System Admin)');
        console.log('  • hr@aastu.edu.et (HR Admin)');
        console.log('  • john.manager@aastu.edu.et (Manager)');
        console.log('  • jane.head@aastu.edu.et (Dept Head)');
        console.log('  • employee1@aastu.edu.et (Employee)');
        console.log('  • employee2@aastu.edu.et (Employee)');
        console.log('');
        console.log('🌐 Go to http://localhost:5173 and login!\n');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

disableMFA();

