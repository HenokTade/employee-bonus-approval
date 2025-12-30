
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkUser() {
    try {
        const res = await pool.query(`SELECT email, failed_login_attempts, locked_until, hashed_password FROM users WHERE email = 'employee1@aastu.edu.et'`);
        if (res.rows.length === 0) {
            console.log('User NOT FOUND');
        } else {
            console.log('User FOUND:');
            const u = res.rows[0];
            console.log('Email:', u.email);
            console.log('Failed Attempts:', u.failed_login_attempts);
            console.log('Locked Until:', u.locked_until);
            // print first 10 chars of hash to verify it's not empty/weird
            console.log('Hash start:', u.hashed_password ? u.hashed_password.substring(0, 10) : 'NULL');
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkUser();
