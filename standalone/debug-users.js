require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function run() {
    try {
        console.log('Connecting...');

        const managers = await pool.query("SELECT email, department FROM users WHERE role = 'manager'");
        console.log(`Found ${managers.rows.length} managers.`);

        for (const manager of managers.rows) {
            const empRes = await pool.query(
                "SELECT count(*) FROM users WHERE role = 'employee' AND department = $1",
                [manager.department]
            );
            console.log(`Manager: ${manager.email} (${manager.department}) -> Employees: ${empRes.rows[0].count}`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
