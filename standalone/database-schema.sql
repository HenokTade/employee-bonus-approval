-- SEPBAS Database Schema
-- Secure Employee Promotion & Bonus Approval System
-- PostgreSQL Database

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS nominations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    hashed_password TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('employee', 'manager', 'dept_head', 'hr_admin', 'system_admin')),
    department VARCHAR(100) NOT NULL,
    
    -- MAC (Mandatory Access Control)
    clearance_level INTEGER NOT NULL DEFAULT 1 CHECK (clearance_level BETWEEN 1 AND 3),
    
    -- RuBAC (Rule-Based Access Control)
    after_hours_access BOOLEAN DEFAULT FALSE,
    
    -- MFA (Multi-Factor Authentication)
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    
    -- Account Security
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Nominations Table
CREATE TABLE nominations (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    
    -- Nomination Details
    type VARCHAR(20) NOT NULL CHECK (type IN ('bonus', 'promotion')),
    bonus_amount DECIMAL(10, 2) DEFAULT 0,
    promotion_to VARCHAR(255),
    justification TEXT NOT NULL,
    
    -- Workflow Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending_manager' 
        CHECK (status IN ('pending_manager', 'pending_dept_head', 'pending_hr', 'approved', 'rejected')),
    
    -- Approval Tracking
    level1_approved_by INTEGER REFERENCES users(id),
    level1_approved_at TIMESTAMP,
    level2_approved_by INTEGER REFERENCES users(id),
    level2_approved_at TIMESTAMP,
    level3_approved_by INTEGER REFERENCES users(id),
    level3_approved_at TIMESTAMP,
    
    -- Rejection Tracking
    rejected_by INTEGER REFERENCES users(id),
    rejection_reason TEXT,
    rejected_at TIMESTAMP,
    
    -- MAC (Mandatory Access Control)
    mac_label INTEGER NOT NULL DEFAULT 1 CHECK (mac_label BETWEEN 1 AND 3),
    
    -- DAC (Discretionary Access Control)
    owner_id INTEGER NOT NULL REFERENCES users(id),
    dac_permissions JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_nominations_employee ON nominations(employee_id);
CREATE INDEX idx_nominations_manager ON nominations(manager_id);
CREATE INDEX idx_nominations_status ON nominations(status);
CREATE INDEX idx_nominations_department ON nominations(department);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nominations_updated_at BEFORE UPDATE ON nominations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample Data (Optional - for testing)
-- Password for all users: Test@123

INSERT INTO users (email, name, hashed_password, role, department, clearance_level, after_hours_access, mfa_enabled) VALUES
('admin@aastu.edu.et', 'System Administrator', '$2a$10$rXK9v8zEZpYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5u', 'system_admin', 'IT', 3, true, true),
('hr@aastu.edu.et', 'HR Manager', '$2a$10$rXK9v8zEZpYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5u', 'hr_admin', 'HR', 2, false, true),
('john.manager@aastu.edu.et', 'John Manager', '$2a$10$rXK9v8zEZpYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5u', 'manager', 'Engineering', 1, false, true),
('jane.head@aastu.edu.et', 'Jane Head', '$2a$10$rXK9v8zEZpYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5u', 'dept_head', 'Engineering', 2, false, true),
('employee1@aastu.edu.et', 'Alice Employee', '$2a$10$rXK9v8zEZpYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5gK5qOYvH5qK5u', 'employee', 'Engineering', 1, false, false);

-- Note: The hashed_password above is a placeholder. Run setup-database.js to create proper hashed passwords.

COMMENT ON TABLE users IS 'Stores user accounts with RBAC roles and MAC clearance levels';
COMMENT ON TABLE nominations IS 'Employee promotion and bonus nominations with multi-level approval workflow';
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all system actions for security compliance';
COMMENT ON COLUMN users.clearance_level IS 'MAC: 1=Public, 2=Internal, 3=Confidential';
COMMENT ON COLUMN users.after_hours_access IS 'RuBAC: Allows access outside business hours (Mon-Fri 08:00-18:00)';
COMMENT ON COLUMN nominations.mac_label IS 'MAC: Data sensitivity classification (1=Public, 2=Internal, 3=Confidential)';
COMMENT ON COLUMN nominations.dac_permissions IS 'DAC: Owner-granted permissions as JSON {userId: "view"|"edit"}';
