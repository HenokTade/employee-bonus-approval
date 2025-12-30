
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

async function addEmployee2() {
    try {
        console.log('--- Adding Employee 2 ---');

        // 1. Check if exists first to avoid duplicates (though email should be unique)
        const check = await pool.query("SELECT id FROM users WHERE email = 'employee2@aastu.edu.et'");
        if (check.rows.length > 0) {
            console.log('Employee 2 already exists with ID:', check.rows[0].id);
            // Verify department
            await pool.query("UPDATE users SET department = 'Software Engineering' WHERE email = 'employee2@aastu.edu.et'");
            console.log('Updated department for Employee 2.');
            return;
        }

        // 2. Insert if not exists
        const hashedPassword = await bcrypt.hash('Password@123', 10);

        const res = await pool.query(`
            INSERT INTO users (email, name, hashed_password, role, department, clearance_level, mfa_enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, email, department
        `, ['employee2@aastu.edu.et', 'Test Employee 2', hashedPassword, 'employee', 'Software Engineering', 1, false]);

        console.log('Created:', res.rows[0]);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

addEmployee2();
