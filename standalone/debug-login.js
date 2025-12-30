require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function testLogin() {
    try {
        console.log('Connecting to database...');

        // 1. Get a user
        const userRes = await pool.query("SELECT * FROM users WHERE email = 'manager@aastu.edu.et'");
        if (userRes.rows.length === 0) {
            console.log('❌ User not found. Run seed-data.js first.');
            return;
        }
        const user = userRes.rows[0];
        console.log(`Testing login for: ${user.email}`);

        // 2. Simulate Login Logic (from server.js)
        // Verify password
        const validPassword = await bcrypt.compare('Password@123', user.hashed_password);
        if (!validPassword) {
            console.log('❌ Password mismatch (unexpected for test user).');
            return;
        }
        console.log('✅ Password verified.');

        // Generate tokens
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production',
            { expiresIn: '30m' }
        );
        const refreshToken = crypto.randomBytes(64).toString('hex');

        const accessTokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
        const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // 3. Create Session (This failed before)
        console.log('Attempting to create session...');
        try {
            await pool.query(
                `INSERT INTO sessions 
                 (user_id, access_token_hash, refresh_token, refresh_token_hash, ip_address, user_agent, expires_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    user.id,
                    accessTokenHash,
                    refreshToken,
                    refreshTokenHash,
                    '127.0.0.1',
                    'Test Script',
                    refreshTokenExpiry
                ]
            );
            console.log('✅ Session created successfully!');
        } catch (sessionError) {
            console.error('❌ Failed to create session:', sessionError.message);
            return;
        }

        // 4. Verify Session Exists
        const sessionRes = await pool.query(
            "SELECT * FROM sessions WHERE user_id = $1 AND is_active = TRUE",
            [user.id]
        );

        if (sessionRes.rows.length > 0) {
            console.log(`✅ Verified: Found ${sessionRes.rows.length} active session(s) for user.`);
        } else {
            console.log('❌ Failed to verify session in database.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

testLogin();
