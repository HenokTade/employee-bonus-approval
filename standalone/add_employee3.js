
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

async function addEmployee3() {
    try {
        console.log('--- Adding Employee 3 (Engineering) ---');

        const hashedPassword = await bcrypt.hash('Password@123', 10);

        const res = await pool.query(`
            INSERT INTO users (email, name, hashed_password, role, department, clearance_level, mfa_enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) DO UPDATE SET department = 'Engineering'
            RETURNING id, email, department
        `, ['employee3@aastu.edu.et', 'Test Employee 3', hashedPassword, 'employee', 'Engineering', 1, false]);

        console.log('Created/Updated:', res.rows[0]);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

addEmployee3();
