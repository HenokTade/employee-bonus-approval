
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function forceAdd() {
    try {
        console.log('--- Force Adding Columns ---');
        try {
            await pool.query('ALTER TABLE audit_logs ADD COLUMN username VARCHAR(255)');
            console.log('Added username.');
        } catch (e) { console.log('Username error (exists?):', e.message); }

        try {
            await pool.query('ALTER TABLE audit_logs ADD COLUMN encrypted_details JSONB');
            console.log('Added encrypted_details.');
        } catch (e) { console.log('Encrypted error (exists?):', e.message); }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

forceAdd();
