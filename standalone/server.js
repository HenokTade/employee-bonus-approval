/**
 * SEPBAS - Secure Employee Promotion & Bonus Approval System
 * Node.js + Express + PostgreSQL Backend
 * AASTU - Software Engineering Department
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const securityEnhancements = require('./security-enhancements');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

// Register Alert Handler to Centralized Log
if (securityEnhancements.setOnAlert) {
    securityEnhancements.setOnAlert(async (alert) => {
        try {
            await logSystemEvent('SYSTEM_ALERT', alert);
        } catch (e) {
            console.error('Failed to log alert to DB:', e);
        }
    });
}

// Database Connection Pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sepbas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('Please check your .env configuration and ensure PostgreSQL is running.');
    } else {
        console.log('✅ Database connected successfully at', res.rows[0].now);
        // Log system startup
        logSystemEvent('SYSTEM_STARTUP', {
            nodeEnv: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        });
    }
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down...');
    await logSystemEvent('SYSTEM_SHUTDOWN', { reason: 'SIGTERM' });
    pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down...');
    await logSystemEvent('SYSTEM_SHUTDOWN', { reason: 'SIGINT' });
    pool.end();
    process.exit(0);
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        // Allow localhost on any port for development
        if (origin.match(/^http:\/\/localhost(:\d+)?$/)) {
            return callback(null, true);
        }
        // Allow the configured frontend URL
        const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
        if (origin === allowedOrigin) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting (Prevent brute force attacks)
// Configurable via environment variables:
// - LOGIN_RATE_WINDOW_MINUTES (default 15)
// - LOGIN_RATE_MAX (default 5 in production, very high in development to avoid accidental lockouts)
// - ENABLE_LOGIN_RATELIMIT (set to 'false' to completely disable rate limiting)
const LOGIN_RATE_WINDOW_MINUTES = process.env.LOGIN_RATE_WINDOW_MINUTES ? Number(process.env.LOGIN_RATE_WINDOW_MINUTES) : 15;
const DEFAULT_MAX = process.env.NODE_ENV === 'development' ? 1000 : 5;
const LOGIN_RATE_MAX = process.env.LOGIN_RATE_MAX ? Number(process.env.LOGIN_RATE_MAX) : DEFAULT_MAX;
const ENABLE_LOGIN_RATELIMIT = process.env.ENABLE_LOGIN_RATELIMIT !== 'false';

const loginLimiter = rateLimit({
    windowMs: LOGIN_RATE_WINDOW_MINUTES * 60 * 1000,
    max: LOGIN_RATE_MAX,
    // Allow disabling the limiter in development by setting ENABLE_LOGIN_RATELIMIT=false
    skip: (req, res) => {
        if (!ENABLE_LOGIN_RATELIMIT) {
            console.log('[RATE-LIMIT] loginLimiter skipped (disabled via ENABLE_LOGIN_RATELIMIT=false)');
            return true;
        }
        return false;
    },
    // Return a JSON response for clients — include Retry-After header and helpful info
    handler: (req, res) => {
        // req.rateLimit may be populated by express-rate-limit; use it to compute remaining time
        let retryAfterSeconds = Math.ceil((loginLimiter.windowMs || (LOGIN_RATE_WINDOW_MINUTES * 60 * 1000)) / 1000);
        if (req && req.rateLimit && req.rateLimit.resetTime) {
            retryAfterSeconds = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000));
        }

        res.set('Retry-After', String(retryAfterSeconds));
        // Also surface standard rate limit headers (Limit, Remaining, Reset) through middleware
        return res.status(429).json({
            error: 'Too many login attempts. Please try again later.',
            retryAfterSeconds,
            note: process.env.NODE_ENV === 'development' ? 'You can disable the login rate limiter while testing by setting ENABLE_LOGIN_RATELIMIT=false' : undefined
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Request Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * RuBAC - Check if current time is within business hours
 * Business hours: Monday-Friday, 08:00-18:00 EAT (UTC+3)
 */
function isWithinBusinessHours() {
    // Skip time check in development mode for easier testing
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_TIME_CHECK === 'true') {
        return true;
    }

    const now = new Date();
    const eatHour = now.getUTCHours() + 3; // Ethiopia is UTC+3
    const day = now.getUTCDay(); // 0=Sunday, 6=Saturday

    // Weekend check
    if (day === 0 || day === 6) {
        return false;
    }

    // Time check (08:00 - 18:00)
    if (eatHour < 8 || eatHour >= 18) {
        return false;
    }

    return true;
}

/**
 * RuBAC - Check time-based access control
 */
function checkTimeBasedAccess(afterHoursAccess) {
    if (isWithinBusinessHours()) {
        return true;
    }
    return afterHoursAccess === true;
}

/**
 * MAC - Check if user has sufficient clearance for data
 */
function checkMacClearance(userClearance, dataLabel) {
    return userClearance >= dataLabel;
}

/**
 * ABAC - Evaluate attribute-based policy
 */
function evaluateAbacPolicy(user, resource, action) {
    const now = new Date();
    const eatHour = now.getUTCHours() + 3;

    // Policy 1: Manager can nominate employees in their department
    if (action === 'nominate' && user.role === 'manager' && user.department === resource.department) {
        return true;
    }

    // Policy 2: HR can approve high-value bonus only during business hours
    if (action === 'approve_hr' && user.role === 'hr_admin') {
        if (resource.bonusAmount > 50000 && (eatHour < 8 || eatHour >= 18)) {
            return false; // High-value bonus requires business hours
        }
        return true;
    }

    // Policy 3: Department heads can only approve in their department
    if (action === 'approve_dept' && user.role === 'dept_head' && user.department === resource.department) {
        return true;
    }

    return false;
}

/**
 * Audit Logging - Log all security-relevant actions with encryption
 */
async function logAction(userId, action, details = {}, req) {
    try {
        const ipAddress = req ? (req.ip || req.connection?.remoteAddress || 'Unknown') : 'Unknown';
        const userAgent = req ? (req.get('user-agent') || 'Unknown') : 'Unknown';

        // Get username if userId provided
        let username = null;
        if (userId) {
            try {
                const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
                if (userResult.rows.length > 0) {
                    username = userResult.rows[0].email;
                }
            } catch (err) {
                console.error('Error fetching username for logging:', err.message);
                // Ignore if user not found - continue with logging
            }
        }

        // Encrypt sensitive details (passwords, tokens, etc.)
        const sensitiveFields = ['password', 'token', 'secret', 'mfaSecret', 'adminToken'];
        const encryptedDetails = { ...details };
        const hasSensitiveData = Object.keys(details).some(key =>
            sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))
        );

        let encryptedData = null;
        if (hasSensitiveData && securityEnhancements && securityEnhancements.encryptLogData) {
            try {
                encryptedData = securityEnhancements.encryptLogData(details);
            } catch (encryptError) {
                console.error('Encryption failed:', encryptError.message);
            }
        }

        // Store in database (with error handling for missing columns)
        try {
            await pool.query(
                `INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent, username, encrypted_details) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    userId,
                    action,
                    hasSensitiveData ? JSON.stringify({ encrypted: true }) : JSON.stringify(details),
                    ipAddress,
                    userAgent,
                    username,
                    encryptedData ? JSON.stringify(encryptedData) : null
                ]
            );
        } catch (dbError) {
            // If columns don't exist, try without them
            if (dbError.message.includes('column') && dbError.message.includes('does not exist')) {
                console.warn('Audit log columns missing, using basic insert');
                await pool.query(
                    `INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        userId,
                        action,
                        JSON.stringify(details),
                        ipAddress,
                        userAgent
                    ]
                );
            } else {
                console.error('Audit log insert failed:', dbError.message);
                // Don't throw - logging errors shouldn't break the app
            }
        }

        // Check for alert conditions (with error handling)
        try {
            securityEnhancements.checkAlertConditions(action, details, userId);
        } catch (alertError) {
            console.error('Alert check failed:', alertError.message);
        }

    } catch (error) {
        console.error('Audit logging error:', error.message);
        // Don't throw - logging errors shouldn't break the application
        try {
            securityEnhancements.generateAlert('system_error', 'medium', 'Audit logging failed', { error: error.message });
        } catch (alertErr) {
            // Ignore alert generation errors
        }
    }
}

/**
 * System Events Logging
 */
async function logSystemEvent(eventType, details = {}) {
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent, username) 
             VALUES (NULL, $1, $2, 'SYSTEM', 'SYSTEM', 'SYSTEM')`,
            [`SYSTEM_${eventType}`, JSON.stringify(details)]
        );

        console.log(`📋 System Event: ${eventType}`, details);
    } catch (error) {
        console.error('System event logging error:', error);
    }
}

/**
 * JWT Token Generation
 */
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.SESSION_EXPIRY || '30m' }
    );
}

/**
 * Generate Refresh Token
 */
function generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
}

/**
 * Hash token for storage
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Authentication Middleware
 * Verifies JWT token and checks session validity
 */
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.substring(7);
        const tokenHash = hashToken(token);

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log('[Auth] Token verified. Decoded:', decoded);

        // Check if session exists and is active
        try {
            const sessionQuery = `SELECT s.id as session_id, s.user_id, s.refresh_token, u.email, u.name, u.role, u.department, u.clearance_level 
             FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.access_token_hash = $1 
             AND s.is_active = TRUE 
             AND s.expires_at > NOW()`;

            // console.log('[Auth] Querying session...');
            const sessionResult = await pool.query(sessionQuery, [tokenHash]);
            // console.log('[Auth] Session found:', sessionResult.rows.length);

            if (sessionResult.rows.length === 0) {
                return res.status(401).json({ error: 'Session not found or expired' });
            }

            const session = sessionResult.rows[0];

            // Update last_used_at
            await pool.query(
                'UPDATE sessions SET last_used_at = NOW() WHERE id = $1',
                [session.session_id]
            );

            // Set user from session
            req.user = {
                id: session.user_id,
                email: session.email,
                name: session.name,
                role: session.role,
                department: session.department,
                clearance_level: session.clearance_level,
            };
            req.session = {
                id: session.session_id,
                refresh_token: session.refresh_token,
            };

            next();
        } catch (dbErr) {
            console.error('[Auth] Database error in authenticate:', dbErr.message);
            throw dbErr; // Re-throw to be caught by outer catch
        }
    } catch (error) {
        const fs = require('fs');
        let tokenForLog = 'unknown';
        try {
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
                tokenForLog = req.headers.authorization.substring(7);
            }
        } catch (e) { }

        const logMessage = `\n[${new Date().toISOString()}] ❌ Auth Error: ${error.name} - ${error.message}\nPath: ${req.method} ${req.originalUrl}\nToken start: ${tokenForLog.substring(0, 20)}...\n`;
        try { fs.appendFileSync('debug.log', logMessage); } catch (e) { console.error('Failed to write to log', e); }

        console.error('❌ Auth Error:', error.name, error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired. Please use refresh token to get a new access token.' });
        }
        // DEBUG: Return detailed error
        return res.status(401).json({ error: 'Invalid authentication token', details: error.message, type: error.name });
    }
}

/**
 * Authorization Middleware - Check role
 */
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            logAction(req.user.id, 'AUTHORIZATION_FAILED', {
                requiredRoles: roles,
                userRole: req.user.role
            }, req);
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * Register New User
 * POST /api/auth/register
 * Requires: Admin registration token
 */
/**
 * Simple Math CAPTCHA Generator
 */
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const answer = num1 + num2;
    return {
        question: `${num1} + ${num2} = ?`,
        answer: answer,
        id: crypto.randomBytes(16).toString('hex')
    };
}

// Store CAPTCHA challenges (in production, use Redis or database)
const captchaChallenges = new Map();

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

// Twilio client (optional - only if SMS is enabled)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Send email verification email
 */
async function sendVerificationEmail(email, token, userId) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.log('⚠️  Email service not configured. Skipping email send.');
        return false;
    }

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${token}`;

    try {
        await emailTransporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'Verify Your Email - SEPBAS',
            html: `
                <h2>Welcome to SEPBAS!</h2>
                <p>Please verify your email address by clicking the link below:</p>
                <p><a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                <p>Or copy and paste this link into your browser:</p>
                <p>${verificationUrl}</p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create an account, please ignore this email.</p>
            `,
        });
        console.log(`✅ Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send verification email:', error);
        return false;
    }
}

/**
 * Send SMS verification code
 */
async function sendVerificationSMS(phone, code) {
    if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
        console.log('⚠️  SMS service not configured. Skipping SMS send.');
        return false;
    }

    try {
        await twilioClient.messages.create({
            body: `Your SEPBAS verification code is: ${code}. This code expires in 10 minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
        });
        console.log(`✅ Verification SMS sent to ${phone}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send verification SMS:', error);
        return false;
    }
}

app.post('/api/auth/register',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8 })
            .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/),
        body('name').trim().isLength({ min: 2 }),
        body('role').isIn(['employee', 'manager', 'dept_head', 'hr_admin', 'system_admin']),
        body('department').trim().notEmpty(),
        body('captchaId').notEmpty().withMessage('CAPTCHA ID is required'),
        body('captchaAnswer').notEmpty().withMessage('CAPTCHA answer is required'),
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { email, password, name, phone, role, department, adminToken, captchaId, captchaAnswer } = req.body;

            // Verify CAPTCHA
            const captcha = captchaChallenges.get(captchaId);
            if (!captcha) {
                return res.status(400).json({ error: 'Invalid or expired CAPTCHA' });
            }

            // Check if CAPTCHA is expired (5 minutes)
            if (Date.now() - captcha.timestamp > 5 * 60 * 1000) {
                captchaChallenges.delete(captchaId);
                return res.status(400).json({ error: 'CAPTCHA expired. Please request a new one.' });
            }

            // Verify answer
            if (parseInt(captchaAnswer) !== captcha.answer) {
                await logAction(null, 'REGISTRATION_FAILED', { email, reason: 'Invalid CAPTCHA' }, req);
                captchaChallenges.delete(captchaId);
                return res.status(400).json({ error: 'Incorrect CAPTCHA answer' });
            }

            // Remove used CAPTCHA
            captchaChallenges.delete(captchaId);

            // Only system admin can register users
            if (adminToken !== process.env.ADMIN_REGISTRATION_TOKEN) {
                return res.status(401).json({
                    error: 'Unauthorized: Only system admin can register users'
                });
            }

            // Check if user already exists
            const existingUser = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );

            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Determine if MFA is required (Manager+ roles)
            const requiresMfa = ['manager', 'dept_head', 'hr_admin', 'system_admin'].includes(role);

            // Generate MFA secret if required
            let mfaSecret = null;
            let qrCodeUrl = null;

            if (requiresMfa) {
                const secret = speakeasy.generateSecret({
                    name: `SEPBAS (${email})`,
                    issuer: 'AASTU SEPBAS',
                });
                mfaSecret = secret.base32;
                qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
            }

            // Determine clearance level based on role
            let clearanceLevel = 1;
            if (role === 'system_admin') clearanceLevel = 3;
            else if (role === 'hr_admin' || role === 'dept_head') clearanceLevel = 2;

            // Insert user (email_verified defaults to false, can be set to true for admin registration)
            const emailVerified = process.env.SKIP_EMAIL_VERIFICATION === 'true' ? true : false;

            const result = await pool.query(
                `INSERT INTO users 
                (email, name, hashed_password, phone, role, department, clearance_level, mfa_enabled, mfa_secret, email_verified) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                RETURNING id, email, name, role, department`,
                [email, name, hashedPassword, phone || null, role, department, clearanceLevel, requiresMfa, mfaSecret, emailVerified]
            );

            const newUser = result.rows[0];

            // Generate email verification token and send email
            const verificationToken = crypto.randomBytes(32).toString('hex');
            await pool.query(
                'UPDATE users SET email_verification_token = $1 WHERE id = $2',
                [verificationToken, newUser.id]
            );

            // Send verification email if email service is configured
            if (!emailVerified) {
                await sendVerificationEmail(email, verificationToken, newUser.id);
            }

            // Generate phone verification code if phone is provided
            let phoneVerificationCode = null;
            if (phone) {
                phoneVerificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
                await pool.query(
                    'UPDATE users SET phone_verification_code = $1, phone_verification_code_expires = $2 WHERE id = $3',
                    [phoneVerificationCode, expiresAt, newUser.id]
                );
                // Send SMS if SMS service is configured
                await sendVerificationSMS(phone, phoneVerificationCode);
            }

            await logAction(newUser.id, 'USER_REGISTERED', { email, role, emailVerified, phone: phone ? 'provided' : 'not provided' }, req);

            // Log system event
            await logSystemEvent('USER_REGISTERED', { email, role });

            res.status(201).json({
                success: true,
                userId: newUser.id,
                mfaRequired: requiresMfa,
                qrCodeUrl: qrCodeUrl || undefined,
                emailVerified: emailVerified,
                verificationToken: emailVerified ? undefined : verificationToken,
                phoneVerificationCode: phone ? phoneVerificationCode : undefined,
                message: requiresMfa
                    ? 'User registered. Please scan QR code with Google Authenticator.'
                    : 'User registered successfully.'
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: `Registration failed: ${error.message}` });
        }
    }
);

/**
 * Login
 * POST /api/auth/login
 */
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { email, password, mfaToken } = req.body;

        // Normalize email (lowercase, trim)
        const normalizedEmail = email ? email.toLowerCase().trim() : '';

        if (!normalizedEmail || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user (case-insensitive email search)
        const result = await pool.query(
            'SELECT * FROM users WHERE LOWER(email) = $1',
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            console.log(`[LOGIN] User not found: ${normalizedEmail}`);
            try {
                await logAction(null, 'LOGIN_FAILED', { email: normalizedEmail, reason: 'User not found' }, req);
            } catch (logError) {
                console.error('Failed to log login attempt:', logError);
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        console.log(`[LOGIN] User found: ${user.email}, checking password...`);

        // Check account lockout
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            return res.status(423).json({
                error: `Account locked. Try again in ${remainingMinutes} minutes.`
            });
        }

        // Verify password
        if (!user.hashed_password) {
            console.error(`[LOGIN] User ${user.email} has no password hash!`);
            return res.status(500).json({ error: 'Account configuration error. Please contact administrator.' });
        }

        const validPassword = await bcrypt.compare(password, user.hashed_password);
        console.log(`[LOGIN] Password valid: ${validPassword}`);

        if (!validPassword) {
            console.log(`[LOGIN] Password mismatch for user: ${user.email}`);
            // Increment failed attempts
            const newFailedAttempts = (user.failed_login_attempts || 0) + 1;

            if (newFailedAttempts >= 5) {
                const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
                await pool.query(
                    'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
                    [newFailedAttempts, lockUntil, user.id]
                );
                await logAction(user.id, 'ACCOUNT_LOCKED', { reason: 'Too many failed attempts' }, req);
                return res.status(423).json({
                    error: 'Account locked due to too many failed attempts. Try again in 15 minutes.'
                });
            }

            await pool.query(
                'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
                [newFailedAttempts, user.id]
            );

            try {
                await logAction(user.id, 'LOGIN_FAILED', { reason: 'Invalid password' }, req);
            } catch (logError) {
                console.error('Failed to log login attempt:', logError);
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`[LOGIN] Password verified successfully for: ${user.email}`);

        // Check MFA if required
        if (user.mfa_enabled) {
            if (!mfaToken) {
                return res.status(200).json({
                    mfaRequired: true,
                    userId: user.id
                });
            }

            const verified = speakeasy.totp.verify({
                secret: user.mfa_secret,
                encoding: 'base32',
                token: mfaToken,
                window: 2,
            });

            if (!verified) {
                try {
                    await logAction(user.id, 'MFA_FAILED', {}, req);
                } catch (logError) {
                    console.error('Failed to log MFA failure:', logError);
                }
                return res.status(401).json({ error: 'Invalid MFA token' });
            }
        }

        // RuBAC - Check time-based access control
        if (!checkTimeBasedAccess(user.after_hours_access)) {
            try {
                await logAction(user.id, 'ACCESS_DENIED', { reason: 'Outside business hours' }, req);
            } catch (logError) {
                console.error('Failed to log access denial:', logError);
            }
            return res.status(403).json({
                error: 'Access denied: System is only available Monday-Friday, 08:00-18:00 EAT. Contact HR for after-hours access.'
            });
        }

        // Reset failed attempts on successful login
        await pool.query(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Generate tokens
        const accessToken = generateToken(user);
        const refreshToken = generateRefreshToken();
        const accessTokenHash = hashToken(accessToken);
        const refreshTokenHash = hashToken(refreshToken);

        // Calculate expiration (30 minutes for access, 7 days for refresh)
        const accessTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Create session in database (with error handling)
        try {
            // Check if sessions table exists first
            const tableCheck = await pool.query(
                `SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'sessions'
                )`
            );

            if (tableCheck.rows[0].exists) {
                await pool.query(
                    `INSERT INTO sessions 
                     (user_id, access_token_hash, refresh_token, refresh_token_hash, ip_address, user_agent, expires_at) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        user.id,
                        accessTokenHash,
                        refreshToken,
                        refreshTokenHash,
                        req.ip || req.connection.remoteAddress || 'Unknown',
                        req.headers['user-agent'] || 'Unknown',
                        refreshTokenExpiry
                    ]
                );
                console.log(`[LOGIN] Session created for user: ${user.email}`);
            } else {
                console.log('[LOGIN] Sessions table not found - skipping session creation');
            }
        } catch (sessionError) {
            console.error('[LOGIN] Failed to create session:', sessionError.message);
            // Continue with login even if session creation fails (for backward compatibility)
        }

        try {
            await logAction(user.id, 'LOGIN_SUCCESS', { ip: req.ip }, req);
        } catch (logError) {
            console.error('Failed to log login success:', logError);
            // Continue anyway - don't fail login due to logging error
        }

        res.json({
            success: true,
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: 30 * 60, // 30 minutes in seconds
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                department: user.department,
                clearanceLevel: user.clearance_level,
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            code: error.code
        });
        res.status(500).json({
            error: `Login failed: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * Logout
 * POST /api/auth/logout
 * Invalidates the current session
 */
app.post('/api/auth/logout', authenticate, async (req, res) => {
    try {
        // Invalidate session
        if (req.session && req.session.id) {
            await pool.query(
                'UPDATE sessions SET is_active = FALSE WHERE id = $1',
                [req.session.id]
            );
        }

        await logAction(req.user.id, 'LOGOUT', {}, req);
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * Logout All Sessions
 * POST /api/auth/logout-all
 * Invalidates all sessions for the user
 */
app.post('/api/auth/logout-all', authenticate, async (req, res) => {
    try {
        // Invalidate all active sessions for user
        await pool.query(
            'UPDATE sessions SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE',
            [req.user.id]
        );

        await logAction(req.user.id, 'LOGOUT_ALL', {}, req);
        res.json({ success: true, message: 'All sessions logged out successfully' });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * Refresh Access Token
 * POST /api/auth/refresh
 * Generates a new access token using refresh token
 */
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        const refreshTokenHash = hashToken(refreshToken);

        // Find active session with refresh token
        const sessionResult = await pool.query(
            `SELECT s.*, u.* 
             FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.refresh_token_hash = $1 
             AND s.is_active = TRUE 
             AND s.expires_at > NOW()`,
            [refreshTokenHash]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        const session = sessionResult.rows[0];
        const user = {
            id: session.user_id,
            email: session.email,
            name: session.name,
            role: session.role,
        };

        // Generate new access token
        const newAccessToken = generateToken(user);
        const newAccessTokenHash = hashToken(newAccessToken);

        // Update session with new access token hash
        await pool.query(
            'UPDATE sessions SET access_token_hash = $1, last_used_at = NOW() WHERE id = $2',
            [newAccessTokenHash, session.id]
        );

        await logAction(user.id, 'TOKEN_REFRESHED', {}, req);

        res.json({
            success: true,
            accessToken: newAccessToken,
            expiresIn: 30 * 60, // 30 minutes in seconds
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

/**
 * Change Password
 * POST /api/auth/change-password
 */
app.post('/api/auth/change-password', authenticate, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 })
        .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/)
        .withMessage('Password must be at least 8 characters with uppercase, digit, and special character'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Get user
        const result = await pool.query('SELECT hashed_password FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].hashed_password);
        if (!validPassword) {
            await logAction(userId, 'PASSWORD_CHANGE_FAILED', { reason: 'Invalid current password' }, req);
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Check if new password is same as current
        const samePassword = await bcrypt.compare(newPassword, result.rows[0].hashed_password);
        if (samePassword) {
            return res.status(400).json({ error: 'New password must be different from current password' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE users SET hashed_password = $1, updated_at = NOW() WHERE id = $2',
            [hashedPassword, userId]
        );

        await logAction(userId, 'PASSWORD_CHANGED', {}, req);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: `Failed to change password: ${error.message}` });
    }
});

/**
 * Update User Profile
 * POST /api/auth/profile
 */
app.post('/api/auth/profile', authenticate, [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('department').optional().trim().notEmpty().withMessage('Department cannot be empty'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const userId = req.user.id;
        const { name, department } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }

        if (department) {
            updates.push(`department = $${paramIndex++}`);
            params.push(department);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(userId);

        const query = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING id, email, name, role, department`;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await logAction(userId, 'PROFILE_UPDATED', { updates: req.body }, req);

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: `Failed to update profile: ${error.message}` });
    }
});

/**
 * Get Active Sessions
 * GET /api/auth/sessions
 * Returns all active sessions for the authenticated user
 */
app.get('/api/auth/sessions', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, ip_address, user_agent, created_at, last_used_at, expires_at
             FROM sessions 
             WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()
             ORDER BY last_used_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            sessions: result.rows
        });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: `Failed to get sessions: ${error.message}` });
    }
});

/**
 * Cleanup expired sessions (should be run periodically)
 * This function can be called by a cron job or scheduled task
 */
async function cleanupExpiredSessions() {
    try {
        const result = await pool.query(
            'UPDATE sessions SET is_active = FALSE WHERE expires_at < NOW() AND is_active = TRUE'
        );
        console.log(`🧹 Cleaned up ${result.rowCount} expired sessions`);
    } catch (error) {
        console.error('Session cleanup error:', error);
    }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

/**
 * Get User Profile
 * GET /api/auth/profile
 */
app.get('/api/auth/profile', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, name, role, department, clearance_level, 
                    after_hours_access, mfa_enabled, created_at, updated_at 
             FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: `Failed to get profile: ${error.message}` });
    }
});

/**
 * Get MFA QR Code for User
 * GET /api/auth/mfa/qrcode
 * Returns QR code for setting up Google Authenticator
 */
app.get('/api/auth/mfa/qrcode', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user's MFA secret
        const result = await pool.query(
            'SELECT email, mfa_secret, mfa_enabled FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Generate secret if missing
        let mfaSecret = user.mfa_secret;
        if (!mfaSecret) {
            const secret = speakeasy.generateSecret({
                name: `SEPBAS (${user.email})`,
                issuer: 'AASTU SEPBAS',
            });
            mfaSecret = secret.base32;

            // Save to database
            await pool.query(
                'UPDATE users SET mfa_secret = $1 WHERE id = $2',
                [mfaSecret, userId]
            );
        }

        // Generate QR code
        const otpauth = speakeasy.otpauthURL({
            secret: mfaSecret,
            encoding: 'base32',
            label: user.email,
            issuer: 'AASTU SEPBAS'
        });

        const qrCodeUrl = await QRCode.toDataURL(otpauth);

        await logAction(userId, 'MFA_QR_REQUESTED', {}, req);

        res.json({
            success: true,
            qrCodeUrl: qrCodeUrl,
            email: user.email,
            message: 'Scan this QR code with Google Authenticator'
        });

    } catch (error) {
        console.error('MFA QR code error:', error);
        res.status(500).json({ error: `Failed to generate QR code: ${error.message}` });
    }
});

// ============================================================================
// NOMINATION ROUTES
// ============================================================================

/**
 * Create Nomination
 * POST /api/nominations
 */
app.post('/api/nominations', authenticate, async (req, res) => {
    try {
        const { employeeId, type, bonusAmount, promotionTo, justification } = req.body;

        // RuBAC - Check time-based access
        if (!checkTimeBasedAccess(req.user.after_hours_access)) {
            await logAction(req.user.id, 'ACCESS_DENIED', {
                action: 'create_nomination',
                reason: 'Outside business hours'
            }, req);
            return res.status(403).json({
                error: 'Nominations can only be created during business hours'
            });
        }

        // Get employee details
        const employeeResult = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [employeeId]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const employee = employeeResult.rows[0];

        // ABAC - Check if manager can nominate this employee
        if (!evaluateAbacPolicy(req.user, { department: employee.department }, 'nominate')) {
            await logAction(req.user.id, 'ACCESS_DENIED', {
                action: 'create_nomination',
                reason: 'ABAC policy violation'
            }, req);
            return res.status(403).json({
                error: 'You can only nominate employees in your department'
            });
        }

        // Determine MAC label based on bonus amount
        let macLabel = 1; // Public
        if (bonusAmount > 50000) macLabel = 3; // Confidential
        else if (bonusAmount > 20000) macLabel = 2; // Internal

        // Determine status: if manager creates it, it's implicitly approved by manager
        const status = req.user.role === 'manager' ? 'pending_dept_head' : 'pending_manager';

        // Create nomination
        const result = await pool.query(
            `INSERT INTO nominations 
            (employee_id, manager_id, department, type, bonus_amount, promotion_to, 
             justification, mac_label, owner_id, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *`,
            [employeeId, req.user.id, employee.department, type, bonusAmount || 0,
                promotionTo, justification, macLabel, req.user.id, status]
        );

        const nomination = result.rows[0];

        await logAction(req.user.id, 'NOMINATION_CREATED', {
            nominationId: nomination.id,
            employeeId,
            type,
            bonusAmount
        }, req);

        res.status(201).json({
            success: true,
            nomination
        });

    } catch (error) {
        console.error('Create nomination error:', error);
        res.status(500).json({ error: `Failed to create nomination: ${error.message}` });
    }
});

/**
 * Get Nominations
 * GET /api/nominations
 */
// Get available departments
app.get('/api/departments', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT department FROM users WHERE department IS NOT NULL ORDER BY department ASC');
        const departments = result.rows.map(r => r.department);
        res.json({ departments });
    } catch (error) {
        console.error('Error fetching departments:', error.message);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

app.get('/api/nominations', authenticate, async (req, res) => {
    try {
        let query = `
            SELECT n.*, 
                   e.name as employee_name, 
                   m.name as manager_name
            FROM nominations n
            JOIN users e ON n.employee_id = e.id
            JOIN users m ON n.manager_id = m.id
            WHERE 1=1
        `;
        const params = [];

        // RBAC + Role-specific filtering
        if (req.user.role === 'employee') {
            query += ' AND n.employee_id = $1';
            params.push(req.user.id);
        } else if (req.user.role === 'manager') {
            query += ' AND (n.manager_id = $1 OR n.department = $2)';
            params.push(req.user.id, req.user.department);
        } else if (req.user.role === 'dept_head') {
            query += ' AND n.department = $1';
            params.push(req.user.department);
        }
        // hr_admin and system_admin can see all

        query += ' ORDER BY n.created_at DESC';

        const result = await pool.query(query, params);

        // MAC - Filter based on clearance level
        const nominations = result.rows.filter(nom => {
            return checkMacClearance(req.user.clearance_level, nom.mac_label);
        });

        await logAction(req.user.id, 'NOMINATIONS_VIEWED', { count: nominations.length }, req);

        res.json({ nominations });

    } catch (error) {
        console.error('Get nominations error:', error);
        res.status(500).json({ error: `Failed to get nominations: ${error.message}` });
    }
});

// (Department employees endpoint is implemented further below with stricter checks)

/**
 * Approve Nomination
 * POST /api/nominations/:id/approve
 */
app.post('/api/nominations/:id/approve', authenticate, async (req, res) => {
    try {
        const nominationId = req.params.id;

        // Get nomination
        const result = await pool.query(
            'SELECT * FROM nominations WHERE id = $1',
            [nominationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nomination not found' });
        }

        const nomination = result.rows[0];

        // MAC - Check clearance
        if (!checkMacClearance(req.user.clearance_level, nomination.mac_label)) {
            await logAction(req.user.id, 'ACCESS_DENIED', {
                action: 'approve_nomination',
                nominationId,
                reason: 'Insufficient MAC clearance'
            }, req);
            return res.status(403).json({
                error: 'Insufficient security clearance to approve this nomination'
            });
        }

        // ABAC - Check for high-value bonus approval
        if (req.user.role === 'hr_admin' &&
            !evaluateAbacPolicy(req.user, { bonusAmount: nomination.bonus_amount }, 'approve_hr')) {
            await logAction(req.user.id, 'ACCESS_DENIED', {
                action: 'approve_nomination',
                nominationId,
                reason: 'ABAC policy: high-value bonus outside business hours'
            }, req);
            return res.status(403).json({
                error: 'High-value bonuses can only be approved during business hours (08:00-18:00 EAT)'
            });
        }

        // Workflow approval logic
        let newStatus = nomination.status;
        let updateQuery = '';

        if (nomination.status === 'pending_manager' && req.user.role === 'manager') {
            newStatus = 'pending_dept_head';
            updateQuery = `UPDATE nominations 
                          SET status = $1, level1_approved_by = $2, level1_approved_at = NOW() 
                          WHERE id = $3 RETURNING *`;
        } else if (nomination.status === 'pending_dept_head' && req.user.role === 'dept_head') {
            newStatus = 'pending_hr';
            updateQuery = `UPDATE nominations 
                          SET status = $1, level2_approved_by = $2, level2_approved_at = NOW() 
                          WHERE id = $3 RETURNING *`;
        } else if (nomination.status === 'pending_hr' && req.user.role === 'hr_admin') {
            newStatus = 'approved';
            updateQuery = `UPDATE nominations 
                          SET status = $1, level3_approved_by = $2, level3_approved_at = NOW() 
                          WHERE id = $3 RETURNING *`;
        } else {
            return res.status(403).json({
                error: 'You cannot approve this nomination at this stage'
            });
        }

        const updateResult = await pool.query(updateQuery, [newStatus, req.user.id, nominationId]);

        await logAction(req.user.id, 'NOMINATION_APPROVED', {
            nominationId,
            newStatus
        }, req);

        res.json({
            success: true,
            nomination: updateResult.rows[0]
        });

    } catch (error) {
        console.error('Approve nomination error:', error);
        res.status(500).json({ error: `Failed to approve nomination: ${error.message}` });
    }
});

/**
 * Reject Nomination
 * POST /api/nominations/:id/reject
 */
app.post('/api/nominations/:id/reject', authenticate, async (req, res) => {
    try {
        const nominationId = req.params.id;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        // Only managers, dept heads, and HR can reject
        if (!['manager', 'dept_head', 'hr_admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to reject' });
        }

        const result = await pool.query(
            `UPDATE nominations 
             SET status = 'rejected', rejected_by = $1, rejection_reason = $2, rejected_at = NOW() 
             WHERE id = $3 
             RETURNING *`,
            [req.user.id, reason, nominationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nomination not found' });
        }

        await logAction(req.user.id, 'NOMINATION_REJECTED', { nominationId, reason }, req);

        res.json({
            success: true,
            nomination: result.rows[0]
        });

    } catch (error) {
        console.error('Reject nomination error:', error);
        res.status(500).json({ error: `Failed to reject nomination: ${error.message}` });
    }
});

/**
 * Grant DAC Permission
 * POST /api/nominations/:id/grant-permission
 */
app.post('/api/nominations/:id/grant-permission', authenticate, async (req, res) => {
    try {
        const nominationId = req.params.id;
        const { targetUserId, permission } = req.body;

        // Get nomination
        const result = await pool.query(
            'SELECT * FROM nominations WHERE id = $1',
            [nominationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nomination not found' });
        }

        const nomination = result.rows[0];

        // DAC - Only owner can grant permissions
        if (nomination.owner_id !== req.user.id) {
            return res.status(403).json({
                error: 'Only the owner can grant permissions'
            });
        }

        // Update DAC permissions
        const dacPermissions = nomination.dac_permissions || {};
        dacPermissions[targetUserId] = permission;

        await pool.query(
            'UPDATE nominations SET dac_permissions = $1 WHERE id = $2',
            [JSON.stringify(dacPermissions), nominationId]
        );

        await logAction(req.user.id, 'DAC_PERMISSION_GRANTED', {
            nominationId,
            targetUserId,
            permission
        }, req);

        res.json({ success: true });

    } catch (error) {
        console.error('Grant permission error:', error);
        res.status(500).json({ error: `Failed to grant permission: ${error.message}` });
    }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * Get All Users
 * GET /api/admin/users
 */
app.get('/api/admin/users',
    authenticate,
    authorize('hr_admin', 'system_admin', 'manager'),
    async (req, res) => {
        try {
            let query;
            let params = [];

            // Managers can only see users from their department
            if (req.user.role === 'manager') {
                console.log(`[GET /api/admin/users] Manager ${req.user.email} requesting users from department: ${req.user.department}`);
                // Do a case-insensitive match and ignore leading/trailing whitespace when matching department
                query = `SELECT id, email, name, role, department, clearance_level, 
                           after_hours_access, mfa_enabled, created_at 
                       FROM users 
                       WHERE LOWER(TRIM(department)) = LOWER(TRIM($1))
                       ORDER BY created_at DESC`;
                params = [req.user.department || ''];
            } else {
                // HR Admin and System Admin can see all users
                console.log(`[GET /api/admin/users] ${req.user.role} ${req.user.email} requesting all users`);
                query = `SELECT id, email, name, role, department, clearance_level, 
                        after_hours_access, mfa_enabled, created_at 
                 FROM users 
                 ORDER BY created_at DESC`;
            }

            const result = await pool.query(query, params);
            console.log(`[GET /api/admin/users] Returning ${result.rows.length} users`);

            // Log department breakdown for debugging
            const deptBreakdown = result.rows.reduce((acc, u) => {
                acc[u.department] = (acc[u.department] || 0) + 1;
                return acc;
            }, {});
            console.log(`[GET /api/admin/users] Department breakdown:`, deptBreakdown);

            res.json({ users: result.rows });

        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ error: `Failed to get users: ${error.message}` });
        }
    }
);

/**
 * Get employees in a department
 * GET /api/departments/:department/employees
 * - managers and dept_heads may only fetch their own department
 * - hr_admin and system_admin may fetch any department
 */
app.get('/api/departments/:department/employees', authenticate, authorize('manager', 'dept_head', 'hr_admin', 'system_admin'), async (req, res) => {
    try {
        const fs = require('fs');
        const departmentParam = decodeURIComponent(req.params.department || '');
        const logMsg1 = `\n[${new Date().toISOString()}] GET /departments/${req.params.department}/employees\nDecoded param: "${departmentParam}"\nUser dept: "${req.user.department}"\nUser role: "${req.user.role}"\n`;
        try { fs.appendFileSync('debug.log', logMsg1); } catch (e) { }
        console.log(`[GET /api/departments/${req.params.department}/employees] Decoded param: "${departmentParam}", User dept: "${req.user.department}"`);

        // Managers and dept_heads are restricted to their own department
        if (req.user.role === 'manager' || req.user.role === 'dept_head') {
            // compare normalized strings
            const normalize = (s) => (s || '').toString().toLowerCase().trim();
            if (normalize(departmentParam) !== normalize(req.user.department)) {
                const logMsg2 = `[Department Check Failed] Param: "${normalize(departmentParam)}" !== User: "${normalize(req.user.department)}"\n`;
                try { fs.appendFileSync('debug.log', logMsg2); } catch (e) { }
                console.log(logMsg2);
                return res.status(403).json({ error: 'Insufficient permissions to list employees for this department' });
            }
        }

        const query = `SELECT id, email, name, role, department, clearance_level, after_hours_access, mfa_enabled, created_at
                       FROM users
                       WHERE LOWER(TRIM(department)) = LOWER(TRIM($1))
                       AND role = 'employee'
                       ORDER BY created_at DESC`;

        const result = await pool.query(query, [departmentParam]);
        await logAction(req.user.id, 'DEPARTMENT_EMPLOYEES_LISTED', { department: departmentParam, count: result.rows.length }, req);
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Get department employees error:', error);
        res.status(500).json({ error: `Failed to get department employees: ${error.message}` });
    }
});

/**
 * Update User
 * POST /api/admin/users/:id/update
 */
app.post('/api/admin/users/:id/update',
    authenticate,
    authorize('hr_admin', 'system_admin'),
    async (req, res) => {
        try {
            const userId = req.params.id;
            const { clearanceLevel, afterHoursAccess, role } = req.body;

            const updates = [];
            const params = [];
            let paramIndex = 1;

            // System admin can update clearance levels (MAC)
            if (req.user.role === 'system_admin' && clearanceLevel !== undefined) {
                updates.push(`clearance_level = $${paramIndex++}`);
                params.push(clearanceLevel);
            }

            // HR admin can grant after-hours access (RuBAC)
            if (afterHoursAccess !== undefined) {
                updates.push(`after_hours_access = $${paramIndex++}`);
                params.push(afterHoursAccess);
            }

            // Update role
            if (role) {
                updates.push(`role = $${paramIndex++}`);
                params.push(role);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No updates provided' });
            }

            params.push(userId);

            const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            await logAction(req.user.id, 'USER_UPDATED', {
                userId,
                updates: req.body
            }, req);

            res.json({
                success: true,
                user: result.rows[0]
            });

        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ error: `Failed to update user: ${error.message}` });
        }
    }
);

/**
 * Get Audit Logs
 * GET /api/admin/logs
 */
app.get('/api/admin/logs',
    authenticate,
    authorize('hr_admin', 'system_admin'),
    async (req, res) => {
        try {
            const { action, userId, startDate, endDate, limit = 1000 } = req.query;

            let query = `
                SELECT l.*, u.name as user_name, u.email as user_email
                 FROM audit_logs l
                 LEFT JOIN users u ON l.user_id = u.id
                 WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;

            if (action) {
                query += ` AND l.action = $${paramIndex++}`;
                params.push(action);
            }

            if (userId) {
                query += ` AND l.user_id = $${paramIndex++}`;
                params.push(userId);
            }

            if (startDate) {
                query += ` AND l.timestamp >= $${paramIndex++}`;
                params.push(startDate);
            }

            if (endDate) {
                query += ` AND l.timestamp <= $${paramIndex++}`;
                params.push(endDate);
            }

            query += ` ORDER BY l.timestamp DESC LIMIT $${paramIndex++}`;
            params.push(parseInt(limit));

            const result = await pool.query(query, params);

            // Decrypt encrypted details if present
            const logs = result.rows.map(log => {
                if (log.encrypted_details) {
                    try {
                        const encrypted = JSON.parse(log.encrypted_details);
                        const decrypted = securityEnhancements.decryptLogData(encrypted);
                        if (decrypted) {
                            log.decrypted_details = decrypted;
                        }
                    } catch (err) {
                        // Keep encrypted if decryption fails
                    }
                }
                return log;
            });

            res.json({ logs });

        } catch (error) {
            console.error('Get logs error:', error);
            res.status(500).json({ error: `Failed to get logs: ${error.message}` });
        }
    }
);

/**
 * Get Alerts
 * GET /api/admin/alerts
 */
app.get('/api/admin/alerts',
    authenticate,
    authorize('hr_admin', 'system_admin'),
    async (req, res) => {
        try {
            const { severity, acknowledged } = req.query;
            const alerts = securityEnhancements.getAlerts(
                severity || null,
                acknowledged === 'true'
            );

            res.json({ alerts });
        } catch (error) {
            console.error('Get alerts error:', error);
            res.status(500).json({ error: `Failed to get alerts: ${error.message}` });
        }
    }
);

/**
 * Acknowledge Alert
 * POST /api/admin/alerts/:id/acknowledge
 */
app.post('/api/admin/alerts/:id/acknowledge',
    authenticate,
    authorize('hr_admin', 'system_admin'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const acknowledged = securityEnhancements.acknowledgeAlert(id);

            if (acknowledged) {
                await logAction(req.user.id, 'ALERT_ACKNOWLEDGED', { alertId: id }, req);
                res.json({ success: true, message: 'Alert acknowledged' });
            } else {
                res.status(404).json({ error: 'Alert not found' });
            }
        } catch (error) {
            console.error('Acknowledge alert error:', error);
            res.status(500).json({ error: `Failed to acknowledge alert: ${error.message}` });
        }
    }
);

/**
 * Get CAPTCHA Challenge
 * GET /api/auth/captcha
 */
app.get('/api/auth/captcha', (req, res) => {
    try {
        const captcha = generateCaptcha();
        captchaChallenges.set(captcha.id, {
            answer: captcha.answer,
            timestamp: Date.now()
        });

        // Clean up old CAPTCHAs (older than 10 minutes)
        for (const [id, data] of captchaChallenges.entries()) {
            if (Date.now() - data.timestamp > 10 * 60 * 1000) {
                captchaChallenges.delete(id);
            }
        }

        res.json({
            captchaId: captcha.id,
            question: captcha.question
        });
    } catch (error) {
        console.error('CAPTCHA generation error:', error);
        res.status(500).json({ error: 'Failed to generate CAPTCHA' });
    }
});

/**
 * Verify Email
 * GET /api/auth/verify-email/:token
 */
app.get('/api/auth/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const result = await pool.query(
            'SELECT id, email FROM users WHERE email_verification_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const user = result.rows[0];

        // Mark email as verified
        await pool.query(
            'UPDATE users SET email_verified = true, email_verification_token = NULL WHERE id = $1',
            [user.id]
        );

        await logAction(user.id, 'EMAIL_VERIFIED', { email: user.email }, req);

        res.json({
            success: true,
            message: 'Email verified successfully'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: `Failed to verify email: ${error.message}` });
    }
});

/**
 * Request Phone Verification Code
 * POST /api/auth/verify-phone/request
 */
app.post('/api/auth/verify-phone/request', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Validate phone format
        if (!/^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s/g, ''))) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        // Generate 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Update user's phone and verification code
        await pool.query(
            `UPDATE users 
             SET phone = $1, phone_verification_code = $2, phone_verification_code_expires = $3 
             WHERE id = $4`,
            [phone, code, expiresAt, userId]
        );

        // Send SMS
        const smsSent = await sendVerificationSMS(phone, code);

        await logAction(userId, 'PHONE_VERIFICATION_REQUESTED', { phone }, req);

        res.json({
            success: true,
            message: smsSent
                ? 'Verification code sent to your phone'
                : 'Verification code generated (SMS service not configured)',
            code: process.env.NODE_ENV === 'development' ? code : undefined // Only show in dev
        });

    } catch (error) {
        console.error('Phone verification request error:', error);
        res.status(500).json({ error: `Failed to send verification code: ${error.message}` });
    }
});

/**
 * Verify Phone Number
 * POST /api/auth/verify-phone/verify
 */
app.post('/api/auth/verify-phone/verify', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Verification code is required' });
        }

        // Get user's verification code
        const result = await pool.query(
            `SELECT phone, phone_verification_code, phone_verification_code_expires 
             FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        if (!user.phone_verification_code) {
            return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
        }

        // Check if code is expired
        if (new Date() > new Date(user.phone_verification_code_expires)) {
            await pool.query(
                'UPDATE users SET phone_verification_code = NULL, phone_verification_code_expires = NULL WHERE id = $1',
                [userId]
            );
            return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
        }

        // Verify code
        if (user.phone_verification_code !== code) {
            await logAction(userId, 'PHONE_VERIFICATION_FAILED', { reason: 'Invalid code' }, req);
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Mark phone as verified
        await pool.query(
            `UPDATE users 
             SET phone_verified = true, phone_verification_code = NULL, phone_verification_code_expires = NULL 
             WHERE id = $1`,
            [userId]
        );

        await logAction(userId, 'PHONE_VERIFIED', { phone: user.phone }, req);

        res.json({
            success: true,
            message: 'Phone number verified successfully'
        });

    } catch (error) {
        console.error('Phone verification error:', error);
        res.status(500).json({ error: `Failed to verify phone: ${error.message}` });
    }
});

/**
 * Create Backup
 * POST /api/admin/backup
 */
app.post('/api/admin/backup',
    authenticate,
    authorize('system_admin'),
    async (req, res) => {
        try {
            const backupType = req.body.type || 'full'; // 'full' or 'incremental'

            // Get all data
            const users = await pool.query(
                `SELECT id, email, name, role, department, clearance_level, 
                        after_hours_access, mfa_enabled, created_at, updated_at 
                 FROM users`
            );

            const nominations = await pool.query('SELECT * FROM nominations');

            // For incremental backup, only get recent logs
            const logQuery = backupType === 'incremental'
                ? `SELECT * FROM audit_logs WHERE timestamp > NOW() - INTERVAL '24 hours' ORDER BY timestamp DESC`
                : `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50000`;

            const logs = await pool.query(logQuery);

            const backup = {
                type: backupType,
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                users: users.rows,
                nominations: nominations.rows,
                logs: logs.rows,
                summary: {
                    userCount: users.rows.length,
                    nominationCount: nominations.rows.length,
                    logCount: logs.rows.length
                }
            };

            await logAction(req.user.id, 'BACKUP_CREATED', { type: backupType, summary: backup.summary }, req);
            await logSystemEvent('BACKUP_CREATED', { type: backupType, userId: req.user.id });

            res.json({
                success: true,
                backup,
                message: `${backupType} backup created successfully`
            });

        } catch (error) {
            console.error('Backup error:', error);
            await logSystemEvent('ERROR', { type: 'BACKUP_FAILED', error: error.message });
            res.status(500).json({ error: `Failed to create backup: ${error.message}` });
        }
    }
);

/**
 * Automated Backup Scheduler (runs daily at 2 AM)
 */
function scheduleAutomatedBackups() {
    const scheduleBackup = async () => {
        try {
            console.log('🔄 Running automated daily backup...');

            // Get system admin user for logging
            const adminResult = await pool.query(
                "SELECT id FROM users WHERE role = 'system_admin' LIMIT 1"
            );

            const adminId = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;

            // Create incremental backup
            const users = await pool.query(
                `SELECT id, email, name, role, department, clearance_level, 
                        after_hours_access, mfa_enabled, created_at, updated_at 
                 FROM users`
            );

            const nominations = await pool.query('SELECT * FROM nominations');
            const logs = await pool.query(
                `SELECT * FROM audit_logs WHERE timestamp > NOW() - INTERVAL '24 hours' ORDER BY timestamp DESC`
            );

            const backup = {
                type: 'automated',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                users: users.rows,
                nominations: nominations.rows,
                logs: logs.rows,
                summary: {
                    userCount: users.rows.length,
                    nominationCount: nominations.rows.length,
                    logCount: logs.rows.length
                }
            };

            if (adminId) {
                await logAction(adminId, 'AUTOMATED_BACKUP_CREATED', { summary: backup.summary }, { ip: 'SYSTEM' });
            }

            await logSystemEvent('AUTOMATED_BACKUP', { summary: backup.summary });

            console.log('✅ Automated backup completed');

        } catch (error) {
            console.error('❌ Automated backup failed:', error);
            await logSystemEvent('ERROR', { type: 'AUTOMATED_BACKUP_FAILED', error: error.message });
        }
    };

    // Run backup immediately on startup (for testing)
    if (process.env.RUN_BACKUP_ON_STARTUP === 'true') {
        scheduleBackup();
    }

    // Schedule daily backup at 2 AM
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);

    const msUntilBackup = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
        scheduleBackup();
        // Then schedule every 24 hours
        setInterval(scheduleBackup, 24 * 60 * 60 * 1000);
    }, msUntilBackup);

    console.log(`📅 Automated backups scheduled (next: ${tomorrow.toISOString()})`);
}

// ============================================================================
// API INFO ROUTE
// ============================================================================

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'SEPBAS Backend',
        version: '1.0.0'
    });
});

// Root API endpoint for debugging
app.get('/api', (req, res) => {
    res.json({
        message: 'SEPBAS API',
        version: '1.0.0',
        endpoints: {
            auth: ['/api/auth/login', '/api/auth/register', '/api/auth/logout'],
            nominations: ['/api/nominations', '/api/nominations/:id/approve', '/api/nominations/:id/reject'],
            admin: ['/api/admin/users', '/api/admin/logs', '/api/admin/backup']
        }
    });
});

// ============================================================================
// STATIC FILE SERVING (for HTML frontend)
// ============================================================================

// Favicon handler - return 204 for missing favicon requests to avoid noisy 404s
// A real favicon.ico file in ./public is preferred; this keeps logs clean while
// providing a useful default during development.
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Serve static files from public directory (after API routes)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 Handler
app.use((req, res) => {
    console.log(`❌ 404 - ${req.method} ${req.path} - Not found`);
    res.status(404).json({ error: 'Endpoint not found', path: req.path, method: req.method });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============================================================================
// START SERVER
// ============================================================================

// START SERVER WITH RESILIENT ERROR HANDLING
// Attempt to bind to the configured PORT. If it's already in use, try the next ports
// up to a small limit so nodemon doesn't immediately crash with EADDRINUSE.
async function listenOnPort(port) {
    return new Promise((resolve, reject) => {
        try {
            const server = app.listen(port, async () => {
                resolve(server);
            });

            // Listen for immediate errors from the underlying server
            server.on('error', (err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
}

async function startServer(initialPort) {
    let port = Number(initialPort || PORT || 3000);
    const maxAttempts = 10; // try up to (initialPort + maxAttempts)

    for (let i = 0; i <= maxAttempts; i++) {
        try {
            const server = await listenOnPort(port);

            // Successful start
            console.log('='.repeat(60));
            console.log('🚀 SEPBAS Backend Server Started');
            console.log('='.repeat(60));
            console.log(`📡 Server running on http://localhost:${port}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔒 Security: Helmet, CORS, Rate Limiting enabled`);
            console.log(`   Login Rate Limit: ${ENABLE_LOGIN_RATELIMIT ? 'ENABLED' : 'DISABLED'}; max=${LOGIN_RATE_MAX}; window_min=${LOGIN_RATE_WINDOW_MINUTES}`);
            console.log(`📊 Database: PostgreSQL (${process.env.DB_NAME})`);
            console.log('='.repeat(60));
            console.log('\nAvailable endpoints:');
            console.log('  POST   /api/auth/register');
            console.log('  POST   /api/auth/login');
            console.log('  POST   /api/auth/logout');
            console.log('  POST   /api/auth/change-password');
            console.log('  GET    /api/auth/profile');
            console.log('  POST   /api/auth/profile');
            console.log('  GET    /api/auth/captcha');
            console.log('  GET    /api/auth/verify-email/:token');
            console.log('  POST   /api/nominations');
            console.log('  GET    /api/nominations');
            console.log('  POST   /api/nominations/:id/approve');
            console.log('  POST   /api/nominations/:id/reject');
            console.log('  GET    /api/admin/users');
            console.log('  POST   /api/admin/users/:id/update');
            console.log('  GET    /api/admin/logs');
            console.log('  GET    /api/admin/alerts');
            console.log('  POST   /api/admin/alerts/:id/acknowledge');
            console.log('  POST   /api/admin/backup');
            console.log('  GET    /api/health');
            console.log('='.repeat(60));

            // Log system startup event
            try {
                await logSystemEvent('STARTUP', {
                    port,
                    environment: process.env.NODE_ENV || 'development',
                    timestamp: new Date().toISOString()
                });

                // Start automated backup scheduler
                if (process.env.ENABLE_AUTOMATED_BACKUPS === 'true') {
                    scheduleAutomatedBackups();
                }
            } catch (error) {
                console.error('Failed to log system startup:', error);
            }

            return server;

        } catch (err) {
            // Port already in use - try next port unless we've exhausted attempts
            if (err && err.code === 'EADDRINUSE') {
                console.warn(`⚠️  Port ${port} is already in use. Trying port ${port + 1}...`);
                port++;
                // small delay to allow the OS to settle
                await new Promise(r => setTimeout(r, 150));
                continue;
            }

            // For other errors, log and rethrow to allow process-level handlers to pick it up
            console.error('Server failed to start:', err);
            throw err;
        }
    }

    console.error(`❌ Failed to start server after trying ports ${initialPort}..${Number(initialPort) + maxAttempts}`);
    process.exit(1);
}
// Start the server (try initial configured port first)
startServer(PORT).catch((err) => {
    // If startServer rejects, we still want to capture the failure and exit
    console.error('Fatal error starting server:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');

    try {
        await logSystemEvent('SHUTDOWN', {
            reason: 'SIGTERM',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to log system shutdown:', error);
    }

    pool.end(() => {
        console.log('✅ Database connections closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received. Shutting down gracefully...');

    try {
        await logSystemEvent('SHUTDOWN', {
            reason: 'SIGINT',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to log system shutdown:', error);
    }

    pool.end(() => {
        console.log('✅ Database connections closed');
        process.exit(0);
    });
});

// Log uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);

    try {
        await logSystemEvent('ERROR', {
            type: 'uncaughtException',
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        securityEnhancements.generateAlert(
            'system_error',
            'critical',
            'Uncaught exception occurred',
            { error: error.message }
        );
    } catch (logError) {
        console.error('Failed to log error:', logError);
    }

    process.exit(1);
});

// Log unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);

    try {
        await logSystemEvent('ERROR', {
            type: 'unhandledRejection',
            reason: reason?.toString() || 'Unknown',
            timestamp: new Date().toISOString()
        });

        securityEnhancements.generateAlert(
            'system_error',
            'high',
            'Unhandled promise rejection',
            { reason: reason?.toString() }
        );
    } catch (logError) {
        console.error('Failed to log error:', logError);
    }
});

// Handle SIGTERM signal for graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    pool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
    });
});
