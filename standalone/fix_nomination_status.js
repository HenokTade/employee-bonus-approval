
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function fixStatuses() {
    try {
        console.log('--- Fixing Nomination Statuses ---');
        // Update any nomination in 'pending_manager' to 'pending_dept_head'
        // This assumes managers created them (which is true for now)
        const res = await pool.query(`
            UPDATE nominations 
            SET status = 'pending_dept_head' 
            WHERE status = 'pending_manager'
            RETURNING id, status
        `);
        console.log(`Updated ${res.rowCount} nominations to 'pending_dept_head'.`);
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

fixStatuses();
