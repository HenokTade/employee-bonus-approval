
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function migrate() {
    try {
        console.log('--- Adding Audit Columns ---');

        await pool.query(`
            ALTER TABLE audit_logs 
            ADD COLUMN IF NOT EXISTS username VARCHAR(255),
            ADD COLUMN IF NOT EXISTS encrypted_details JSONB;
        `);

        console.log('✅ Columns added successfully.');

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

migrate();
