
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkUsers() {
    try {
        console.log('--- Checking Users ---');

        // Check Manager
        const managerRes = await pool.query("SELECT id, email, role, department FROM users WHERE email = 'manager@aastu.edu.et'");
        console.log('Manager:', managerRes.rows);

        // Check Employees
        const employeesRes = await pool.query("SELECT id, email, role, department FROM users WHERE email IN ('employee1@aastu.edu.et', 'employee2@aastu.edu.et')");
        console.log('Employees:', employeesRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkUsers();
