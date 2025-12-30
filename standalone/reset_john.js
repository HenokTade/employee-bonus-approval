
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

async function resetJohn() {
    try {
        const hash = await bcrypt.hash('Password@123', 10);
        await pool.query("UPDATE users SET hashed_password = $1 WHERE email = 'john.manager@aastu.edu.et'", [hash]);
        console.log("John's password reset.");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

resetJohn();
