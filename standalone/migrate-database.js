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
        
        // Enable UUID extension if not already enabled
        console.log('\n📝 Enabling UUID extension...');
        try {
            await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
            console.log('✅ UUID extension enabled');
        } catch (error) {
            console.log('ℹ️  UUID extension may already exist');
        }
        
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

        // Add phone verification columns to users table
        console.log('\n📝 Adding phone verification columns...');
        try {
            await client.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
                ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(10),
                ADD COLUMN IF NOT EXISTS phone_verification_code_expires TIMESTAMP
            `);
            console.log('✅ Phone verification columns added');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  Phone verification columns already exist');
            } else {
                throw error;
            }
        }

        // Add last_login column if missing
        console.log('\n📝 Adding last_login column...');
        try {
            await client.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
            `);
            console.log('✅ last_login column added');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  last_login column already exists');
            } else {
                console.log('ℹ️  last_login column may already exist');
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
        
        // Create sessions table for session management
        console.log('\n📝 Creating sessions table...');
        try {
            // Check if table already exists
            const tableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'sessions'
                );
            `);
            
            if (tableCheck.rows[0].exists) {
                console.log('ℹ️  Sessions table already exists');
            } else {
                // Check users table id type
                const usersCheck = await client.query(`
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' 
                    AND column_name = 'id';
                `);
                
                const idType = usersCheck.rows[0]?.data_type || 'UUID';
                
                await client.query(`
                    CREATE TABLE sessions (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        user_id ${idType} NOT NULL,
                        access_token_hash VARCHAR(255) NOT NULL,
                        refresh_token VARCHAR(255) UNIQUE NOT NULL,
                        refresh_token_hash VARCHAR(255) NOT NULL,
                        ip_address VARCHAR(45),
                        user_agent TEXT,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        is_active BOOLEAN DEFAULT TRUE,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    );
                    
                    CREATE INDEX idx_sessions_user_id ON sessions(user_id);
                    CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
                    CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
                    CREATE INDEX idx_sessions_active ON sessions(is_active) WHERE is_active = TRUE;
                `);
                console.log('✅ Sessions table created');
            }
        } catch (error) {
            if (error.message.includes('already exists') || error.message.includes('duplicate')) {
                console.log('ℹ️  Sessions table already exists');
            } else {
                console.error('⚠️  Error creating sessions table:', error.message);
                console.log('ℹ️  Continuing migration...');
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


