
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkNominations() {
    try {
        console.log('--- Current Nominations ---');
        const res = await pool.query(`
            SELECT id, employee_id, status, department, bonus_amount, type 
            FROM nominations 
            ORDER BY created_at DESC
        `);
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkNominations();
