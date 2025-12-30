
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkEngineering() {
    try {
        const res = await pool.query("SELECT id, email, role, department FROM users WHERE department = 'Engineering' AND role = 'employee'");
        console.log(`Employees in Engineering: ${res.rows.length}`);
        if (res.rows.length > 0) {
            console.log(res.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkEngineering();
