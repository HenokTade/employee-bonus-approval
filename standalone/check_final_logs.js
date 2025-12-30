
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkLogs() {
    try {
        console.log('--- Checking for ALERTS and EVENTS ---');
        // Check for SYSTEM_STARTUP
        const startup = await pool.query("SELECT * FROM audit_logs WHERE action = 'SYSTEM_STARTUP' ORDER BY created_at DESC LIMIT 1");
        if (startup.rows.length > 0) console.log('✅ Found SYSTEM_STARTUP log.');
        else console.log('❌ Missing SYSTEM_STARTUP log.');

        // Check for SYSTEM_ALERT
        const alert = await pool.query("SELECT * FROM audit_logs WHERE action = 'SYSTEM_ALERT' ORDER BY created_at DESC LIMIT 1");
        if (alert.rows.length > 0) {
            console.log('✅ Found SYSTEM_ALERT log.');
            console.log('Alert Details:', alert.rows[0].details);
            if (alert.rows[0].encrypted_details) console.log('✅ Alert has encrypted details.');
        } else {
            console.log('❌ Missing SYSTEM_ALERT log.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkLogs();
