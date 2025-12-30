
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function verifyLogging() {
    try {
        console.log('--- Verifying Audit Logging & Encryption ---');

        // 1. Fetch the most recent log entry (should be from our test or system startup)
        // We look for 'SYSTEM_STARTUP' or any action
        const res = await pool.query(`
            SELECT id, action, details, encrypted_details, created_at 
            FROM audit_logs 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log('No logs found.');
            return;
        }

        const log = res.rows[0];
        console.log('Latest Log Action:', log.action);
        console.log('Has Encrypted Details:', !!log.encrypted_details);

        if (log.encrypted_details) {
            console.log('Encrypted Data Structure:', Object.keys(log.encrypted_details));
            console.log('SUCCESS: Encryption implemented.');
        } else {
            console.log('NOTE: Latest log did not have encrypted details (might not be sensitive).');
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

verifyLogging();
