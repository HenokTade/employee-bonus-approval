
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkJohn() {
    try {
        console.log('--- Checking John ---');
        const res = await pool.query("SELECT id, email, role, department FROM users WHERE email = 'john.manager@aastu.edu.et'");
        if (res.rows.length === 0) {
            console.log('User john.manager@aastu.edu.et NOT FOUND.');
        } else {
            console.log('User Found:', res.rows[0]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkJohn();
