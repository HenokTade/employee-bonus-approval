/**
 * Database Migration Script
 * Adds new columns for enhanced security features
 */

const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function migrate() {
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        // Add email verification columns to users table
        console.log('\n📝 Adding email verification columns...');
        try {
            await client.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)
            `);
            console.log('✅ Email verification columns added');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  Email verification columns already exist');
            } else {
                throw error;
            }
        }
        
        // Add username and encrypted_details to audit_logs table
        console.log('\n📝 Adding enhanced audit log columns...');
        try {
            await client.query(`
                ALTER TABLE audit_logs 
                ADD COLUMN IF NOT EXISTS username VARCHAR(255),
                ADD COLUMN IF NOT EXISTS encrypted_details JSONB
            `);
            console.log('✅ Enhanced audit log columns added');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  Enhanced audit log columns already exist');
            } else {
                throw error;
            }
        }
        
        // Create index on username for faster queries
        console.log('\n📝 Creating indexes...');
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);
                CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
            `);
            console.log('✅ Indexes created');
        } catch (error) {
            console.log('ℹ️  Indexes may already exist');
        }
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();


