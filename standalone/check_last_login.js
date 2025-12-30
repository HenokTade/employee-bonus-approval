
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkLastLogin() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'last_login';
        `);

        if (res.rows.length > 0) {
            console.log('✅ last_login column exists');
        } else {
            console.log('❌ last_login column MISSING');
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkLastLogin();
