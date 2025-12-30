
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function resetPass() {
    try {
        console.log('Generating hash for Password@123...');
        const hash = await bcrypt.hash('Password@123', 10);
        console.log('Hash generated:', hash.substring(0, 10) + '...');

        const res = await pool.query(
            `UPDATE users SET hashed_password = $1, failed_login_attempts = 0, locked_until = NULL WHERE email = 'employee1@aastu.edu.et'`,
            [hash]
        );
        console.log('Update result:', res.rowCount);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

resetPass();
