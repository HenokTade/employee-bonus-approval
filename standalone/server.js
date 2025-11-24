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

const app = express();
const PORT = process.env.PORT || 3000;

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
    }
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
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many login attempts. Please try again later.',
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
        const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
        const userAgent = req.get('user-agent') || 'Unknown';
        
        // Get username if userId provided
        let username = null;
        if (userId) {
            try {
                const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
                if (userResult.rows.length > 0) {
                    username = userResult.rows[0].email;
                }
            } catch (err) {
                // Ignore if user not found
            }
        }
        
        // Encrypt sensitive details (passwords, tokens, etc.)
        const sensitiveFields = ['password', 'token', 'secret', 'mfaSecret', 'adminToken'];
        const encryptedDetails = { ...details };
        const hasSensitiveData = Object.keys(details).some(key => 
            sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))
        );
        
        let encryptedData = null;
        if (hasSensitiveData) {
            encryptedData = securityEnhancements.encryptLogData(details);
        }
        
        // Store in database
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
        
        // Check for alert conditions
        securityEnhancements.checkAlertConditions(action, details, userId);
        
    } catch (error) {
        console.error('Audit logging error:', error);
        // Log system error
        securityEnhancements.generateAlert('system_error', 'medium', 'Audit logging failed', { error: error.message });
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
 * Authentication Middleware
 */
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const token = authHeader.substring(7);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const result = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [decoded.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }
        return res.status(401).json({ error: 'Invalid authentication token' });
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
            
            const { email, password, name, role, department, adminToken, captchaId, captchaAnswer } = req.body;
            
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
                (email, name, hashed_password, role, department, clearance_level, mfa_enabled, mfa_secret, email_verified) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                RETURNING id, email, name, role, department`,
                [email, name, hashedPassword, role, department, clearanceLevel, requiresMfa, mfaSecret, emailVerified]
            );
            
            const newUser = result.rows[0];
            
            // Generate email verification token (simplified - in production, send email)
            const verificationToken = crypto.randomBytes(32).toString('hex');
            await pool.query(
                'UPDATE users SET email_verification_token = $1 WHERE id = $2',
                [verificationToken, newUser.id]
            );
            
            await logAction(newUser.id, 'USER_REGISTERED', { email, role, emailVerified }, req);
            
            // Log system event
            await logSystemEvent('USER_REGISTERED', { email, role });
            
            res.status(201).json({
                success: true,
                userId: newUser.id,
                mfaRequired: requiresMfa,
                qrCodeUrl: qrCodeUrl || undefined,
                emailVerified: emailVerified,
                verificationToken: emailVerified ? undefined : verificationToken,
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
        
        // Find user
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            await logAction(null, 'LOGIN_FAILED', { email, reason: 'User not found' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Check account lockout
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            return res.status(423).json({ 
                error: `Account locked. Try again in ${remainingMinutes} minutes.` 
            });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.hashed_password);
        
        if (!validPassword) {
            // Increment failed attempts
            const newFailedAttempts = user.failed_login_attempts + 1;
            
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
            
            await logAction(user.id, 'LOGIN_FAILED', { reason: 'Invalid password' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
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
                await logAction(user.id, 'MFA_FAILED', {}, req);
                return res.status(401).json({ error: 'Invalid MFA token' });
            }
        }
        
        // RuBAC - Check time-based access control
        if (!checkTimeBasedAccess(user.after_hours_access)) {
            await logAction(user.id, 'ACCESS_DENIED', { reason: 'Outside business hours' }, req);
            return res.status(403).json({ 
                error: 'Access denied: System is only available Monday-Friday, 08:00-18:00 EAT. Contact HR for after-hours access.' 
            });
        }
        
        // Reset failed attempts on successful login
        await pool.query(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
            [user.id]
        );
        
        // Generate JWT token
        const token = generateToken(user);
        
        await logAction(user.id, 'LOGIN_SUCCESS', {}, req);
        
        res.json({
            success: true,
            accessToken: token,
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
        res.status(500).json({ error: `Login failed: ${error.message}` });
    }
});

/**
 * Logout
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', authenticate, async (req, res) => {
    try {
        await logAction(req.user.id, 'LOGOUT', {}, req);
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
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
        
        // Create nomination
        const result = await pool.query(
            `INSERT INTO nominations 
            (employee_id, manager_id, department, type, bonus_amount, promotion_to, 
             justification, mac_label, owner_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *`,
            [employeeId, req.user.id, employee.department, type, bonusAmount || 0, 
             promotionTo, justification, macLabel, req.user.id]
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
            const result = await pool.query(
                `SELECT id, email, name, role, department, clearance_level, 
                        after_hours_access, mfa_enabled, created_at 
                 FROM users 
                 ORDER BY created_at DESC`
            );
            
            res.json({ users: result.rows });
            
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ error: `Failed to get users: ${error.message}` });
        }
    }
);

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

app.listen(PORT, async () => {
    console.log('='.repeat(60));
    console.log('🚀 SEPBAS Backend Server Started');
    console.log('='.repeat(60));
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 Security: Helmet, CORS, Rate Limiting enabled`);
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
            port: PORT,
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
