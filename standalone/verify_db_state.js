
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function verifyState() {
    try {
        console.log('--- Checking Audit Logs Schema ---');
        const schemaRes = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'audit_logs'
            ORDER BY ordinal_position;
        `);
        schemaRes.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        console.log('\n--- Checking Nominations Status ---');
        const nomRes = await pool.query(`
            SELECT id, status, type FROM nominations ORDER BY id DESC;
        `);
        nomRes.rows.forEach(r => console.log(`ID: ${r.id}, Status: '${r.status}', Type: ${r.type}`));

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
verifyState();
