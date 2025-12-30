const { Client } = require('pg');
require('dotenv').config();

(async ()=>{
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || undefined,
  });

  try {
    await client.connect();
    const res = await client.query("SELECT id, email, name, role, failed_login_attempts, locked_until, mfa_enabled FROM users ORDER BY id ASC");
    console.table(res.rows);
  } catch (err) {
    console.error('Query error:', err.message);
  } finally {
    await client.end();
  }
})();
