require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkDepartments() {
    try {
        const res = await pool.query("SELECT email, role, department, length(department) as dept_len FROM users WHERE email IN ('eamman@aastu.edu.et', 'eam1@aastu.edu.et')");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkDepartments();
