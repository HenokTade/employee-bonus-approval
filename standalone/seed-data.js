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

async function seed() {
    try {
        console.log('Connecting to database...');

        // Hash password
        const password = await bcrypt.hash('Password@123', 10);
        const department = 'Software Engineering';

        // 1. Create Manager
        console.log('Creating Manager...');
        const managerRes = await pool.query(
            `INSERT INTO users (email, name, hashed_password, role, department, clearance_level, mfa_enabled, email_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (email) DO UPDATE SET role = $4, department = $5
             RETURNING id, email, role, department`,
            ['manager@aastu.edu.et', 'Test Manager', password, 'manager', department, 2, false, true]
        );
        console.log('Manager created/updated:', managerRes.rows[0]);

        // 2. Create Employee 1
        console.log('Creating Employee 1...');
        const emp1Res = await pool.query(
            `INSERT INTO users (email, name, hashed_password, role, department, clearance_level, mfa_enabled, email_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (email) DO UPDATE SET role = $4, department = $5
             RETURNING id, email, role, department`,
            ['employee1@aastu.edu.et', 'Test Employee 1', password, 'employee', department, 1, false, true]
        );
        console.log('Employee 1 created/updated:', emp1Res.rows[0]);

        // 3. Create Employee 2
        console.log('Creating Employee 2...');
        const emp2Res = await pool.query(
            `INSERT INTO users (email, name, hashed_password, role, department, clearance_level, mfa_enabled, email_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (email) DO UPDATE SET role = $4, department = $5
             RETURNING id, email, role, department`,
            ['employee2@aastu.edu.et', 'Test Employee 2', password, 'employee', department, 1, false, true]
        );
        console.log('Employee 2 created/updated:', emp2Res.rows[0]);

        console.log('\n✅ Seeding completed successfully!');
        console.log('Login credentials:');
        console.log('Manager: manager@aastu.edu.et / Password@123');
        console.log('Employees: employee1@aastu.edu.et, employee2@aastu.edu.et / Password@123');

    } catch (err) {
        console.error('Seeding error:', err);
    } finally {
        await pool.end();
    }
}

seed();
