/**
 * Security Enhancements Module
 * Adds: Log Encryption, System Events, Alerting, Enhanced Audit Logging
 */

const crypto = require('crypto');

// Encryption key for logs (should be in .env in production)
const LOG_ENCRYPTION_KEY = process.env.LOG_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const LOG_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive log data
 */
function encryptLogData(data) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(LOG_ENCRYPTION_ALGORITHM, Buffer.from(LOG_ENCRYPTION_KEY.slice(0, 32), 'hex'), iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    } catch (error) {
        console.error('Encryption error:', error);
        return { encrypted: null, error: error.message };
    }
}

/**
 * Decrypt log data
 */
function decryptLogData(encryptedData) {
    try {
        const decipher = crypto.createDecipheriv(
            LOG_ENCRYPTION_ALGORITHM,
            Buffer.from(LOG_ENCRYPTION_KEY.slice(0, 32), 'hex'),
            Buffer.from(encryptedData.iv, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

/**
 * Alert thresholds
 */
const ALERT_THRESHOLDS = {
    FAILED_LOGIN_ATTEMPTS: 3,
    ACCOUNT_LOCKOUTS: 1,
    UNAUTHORIZED_ACCESS: 1,
    CONFIG_CHANGES: 1,
    SYSTEM_ERRORS: 5
};

/**
 * Alert storage (in production, use database or external service)
 */
const alerts = [];

/**
 * Generate alert for critical events
 */
function generateAlert(type, severity, message, details = {}) {
    const alert = {
        id: crypto.randomBytes(16).toString('hex'),
        type,
        severity, // 'low', 'medium', 'high', 'critical'
        message,
        details,
        timestamp: new Date().toISOString(),
        acknowledged: false
    };
    
    alerts.push(alert);
    
    // Log alert
    console.log(`🚨 ALERT [${severity.toUpperCase()}]: ${message}`, details);
    
    // In production, send to monitoring service, email, SMS, etc.
    if (severity === 'critical' || severity === 'high') {
        // Send immediate notification
        console.log('⚠️  CRITICAL ALERT - Immediate action required!');
    }
    
    return alert;
}

/**
 * Check for alert conditions
 */
function checkAlertConditions(action, details, userId) {
    // Failed login attempts
    if (action === 'LOGIN_FAILED') {
        const recentFailures = alerts.filter(a => 
            a.type === 'failed_login' && 
            new Date(a.timestamp) > new Date(Date.now() - 15 * 60 * 1000)
        ).length;
        
        if (recentFailures >= ALERT_THRESHOLDS.FAILED_LOGIN_ATTEMPTS) {
            generateAlert(
                'failed_login',
                'high',
                `Multiple failed login attempts detected for user ${userId}`,
                { userId, count: recentFailures + 1 }
            );
        }
    }
    
    // Account lockout
    if (action === 'ACCOUNT_LOCKED') {
        generateAlert(
            'account_lockout',
            'high',
            `Account locked: ${details.email || userId}`,
            details
        );
    }
    
    // Unauthorized access
    if (action === 'AUTHORIZATION_FAILED' || action === 'ACCESS_DENIED') {
        generateAlert(
            'unauthorized_access',
            'high',
            `Unauthorized access attempt by user ${userId}`,
            { userId, action, details }
        );
    }
    
    // Configuration changes
    if (action === 'CONFIG_CHANGED' || action === 'USER_UPDATED') {
        if (details.clearanceLevel || details.role) {
            generateAlert(
                'config_change',
                'medium',
                `Configuration change: ${action}`,
                { userId, details }
            );
        }
    }
    
    // System errors
    if (action === 'SYSTEM_ERROR') {
        const recentErrors = alerts.filter(a => 
            a.type === 'system_error' && 
            new Date(a.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
        ).length;
        
        if (recentErrors >= ALERT_THRESHOLDS.SYSTEM_ERRORS) {
            generateAlert(
                'system_error',
                'critical',
                `Multiple system errors detected`,
                { count: recentErrors + 1 }
            );
        }
    }
}

/**
 * Get all alerts
 */
function getAlerts(severity = null, acknowledged = false) {
    let filtered = alerts;
    
    if (severity) {
        filtered = filtered.filter(a => a.severity === severity);
    }
    
    if (!acknowledged) {
        filtered = filtered.filter(a => !a.acknowledged);
    }
    
    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Acknowledge alert
 */
function acknowledgeAlert(alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date().toISOString();
        return true;
    }
    return false;
}

module.exports = {
    encryptLogData,
    decryptLogData,
    generateAlert,
    checkAlertConditions,
    getAlerts,
    acknowledgeAlert,
    ALERT_THRESHOLDS
};


