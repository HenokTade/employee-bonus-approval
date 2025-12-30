require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function updateRole() {
    try {
        const res = await pool.query("UPDATE users SET role = 'employee' WHERE email = 'eam1@aastu.edu.et' RETURNING *");
        console.log('Updated user:', res.rows[0]);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

updateRole();
