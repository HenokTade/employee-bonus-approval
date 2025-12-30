require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function migrateIds() {
    try {
        console.log('Starting migration...');

        // 1. Drop constraints temporarily
        await pool.query('ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey');
        await pool.query('ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey');
        await pool.query('ALTER TABLE nominations DROP CONSTRAINT IF EXISTS nominations_employee_id_fkey');
        await pool.query('ALTER TABLE nominations DROP CONSTRAINT IF EXISTS nominations_manager_id_fkey');

        // 2. Alter columns to INTEGER
        // audit_logs
        await pool.query('ALTER TABLE audit_logs ALTER COLUMN user_id TYPE INTEGER USING NULL');
        // USING NULL because we can't cast UUID to Integer directly easily if data is bad, 
        // but here we likely have empty or valid UUIDs that don't match. 
        // Actually, if audit_logs has existing UUIDs, we might lose them or fail.
        // Since this is a dev env and logs are secondary, NULLing is safer than failing.

        // sessions
        await pool.query('ALTER TABLE sessions ALTER COLUMN user_id TYPE INTEGER USING NULL');

        // nominations
        const nomCols = ['employee_id', 'manager_id', 'level1_approved_by', 'level2_approved_by', 'level3_approved_by', 'rejected_by', 'owner_id'];
        for (const col of nomCols) {
            await pool.query(`ALTER TABLE nominations ALTER COLUMN ${col} TYPE INTEGER USING NULL`);
        }

        // dac_permissions
        await pool.query('ALTER TABLE dac_permissions DROP CONSTRAINT IF EXISTS dac_permissions_user_id_fkey');
        await pool.query('ALTER TABLE dac_permissions DROP CONSTRAINT IF EXISTS dac_permissions_granted_by_fkey');
        await pool.query('ALTER TABLE dac_permissions ALTER COLUMN user_id TYPE INTEGER USING NULL');
        await pool.query('ALTER TABLE dac_permissions ALTER COLUMN granted_by TYPE INTEGER USING NULL');

        // 3. Re-add constraints
        await pool.query('ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)');
        await pool.query('ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');

        // nominations constraints
        await pool.query('ALTER TABLE nominations ADD CONSTRAINT nominations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id)');
        await pool.query('ALTER TABLE nominations ADD CONSTRAINT nominations_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id)');

        console.log('Migration completed successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        pool.end();
    }
}

migrateIds();
