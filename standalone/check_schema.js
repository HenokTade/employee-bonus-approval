
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name IN ('users', 'sessions', 'nominations') 
            AND column_name IN ('id', 'user_id', 'employee_id', 'manager_id', 'owner_id')
            ORDER BY table_name, column_name;
        `);
        console.log('Table       | Column      | Type        | UDT');
        console.log('------------|-------------|-------------|------');
        res.rows.forEach(r => {
            console.log(`${r.table_name.padEnd(12)}| ${r.column_name.padEnd(12)}| ${r.data_type.padEnd(12)}| ${r.udt_name}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkSchema();
