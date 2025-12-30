
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkNominations() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'nominations' 
            AND column_name IN ('id', 'employee_id', 'manager_id', 'department')
            ORDER BY column_name;
        `);

        if (res.rows.length === 0) {
            console.log('Nominations table NOT FOUND');
        } else {
            console.log('Nominations Table Found:');
            res.rows.forEach(r => {
                console.log(`${r.column_name}: ${r.udt_name}`);
            });
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkNominations();
