/**
 * Database Setup Script
 * Initializes the database and creates sample users with properly hashed passwords
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function setupDatabase() {
    try {
        console.log('🔧 Setting up SEPBAS database...\n');
        
        // Read and execute schema file
        console.log('📁 Reading database schema...');
        const schemaPath = path.join(__dirname, 'database-schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📊 Creating tables...');
        await pool.query(schema);
        console.log('✅ Tables created successfully\n');
        
        // Create sample users with properly hashed passwords
        console.log('👥 Creating sample users...');
        const password = 'Test@123'; // Default password for all sample users
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sampleUsers = [
            {
                email: 'admin@aastu.edu.et',
                name: 'System Administrator',
                role: 'system_admin',
                department: 'IT',
                clearanceLevel: 3,
                afterHoursAccess: true,
                mfaEnabled: true
            },
            {
                email: 'hr@aastu.edu.et',
                name: 'HR Manager',
                role: 'hr_admin',
                department: 'HR',
                clearanceLevel: 2,
                afterHoursAccess: false,
                mfaEnabled: true
            },
            {
                email: 'john.manager@aastu.edu.et',
                name: 'John Manager',
                role: 'manager',
                department: 'Engineering',
                clearanceLevel: 1,
                afterHoursAccess: false,
                mfaEnabled: true
            },
            {
                email: 'jane.head@aastu.edu.et',
                name: 'Jane Head',
                role: 'dept_head',
                department: 'Engineering',
                clearanceLevel: 2,
                afterHoursAccess: false,
                mfaEnabled: true
            },
            {
                email: 'employee1@aastu.edu.et',
                name: 'Alice Employee',
                role: 'employee',
                department: 'Engineering',
                clearanceLevel: 1,
                afterHoursAccess: false,
                mfaEnabled: false
            },
            {
                email: 'employee2@aastu.edu.et',
                name: 'Bob Employee',
                role: 'employee',
                department: 'Engineering',
                clearanceLevel: 1,
                afterHoursAccess: false,
                mfaEnabled: false
            },
            {
                email: 'sales.manager@aastu.edu.et',
                name: 'Sarah Sales',
                role: 'manager',
                department: 'Sales',
                clearanceLevel: 1,
                afterHoursAccess: false,
                mfaEnabled: true
            }
        ];
        
        // Clear existing sample users first
        await pool.query('DELETE FROM users');
        
        for (const user of sampleUsers) {
            await pool.query(
                `INSERT INTO users 
                (email, name, hashed_password, role, department, clearance_level, after_hours_access, mfa_enabled) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    user.email,
                    user.name,
                    hashedPassword,
                    user.role,
                    user.department,
                    user.clearanceLevel,
                    user.afterHoursAccess,
                    user.mfaEnabled
                ]
            );
            console.log(`   ✓ ${user.email} (${user.role})`);
        }
        
        console.log('\n✅ Database setup completed successfully!\n');
        console.log('📝 Sample Users Created:');
        console.log('='.repeat(60));
        console.log('Email                          | Role           | Password');
        console.log('='.repeat(60));
        sampleUsers.forEach(user => {
            console.log(`${user.email.padEnd(30)} | ${user.role.padEnd(14)} | Test@123`);
        });
        console.log('='.repeat(60));
        console.log('\n⚠️  IMPORTANT NOTES:');
        console.log('1. Users with MFA enabled will need to scan QR code on first login');
        console.log('2. For testing, you can disable MFA temporarily in the database');
        console.log('3. Change default passwords in production!');
        console.log('4. System is restricted to Mon-Fri 08:00-18:00 EAT');
        console.log('5. Only System Admin has after-hours access enabled\n');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Make sure PostgreSQL is running');
        console.error('2. Check your .env file configuration');
        console.error('3. Ensure the database exists: createdb sepbas_db');
        console.error('4. Verify database credentials\n');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

setupDatabase();
