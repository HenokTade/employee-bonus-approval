-- SEPBAS Database Schema for PostgreSQL
-- Secure Employee Promotion & Bonus Approval System
-- AASTU - Computer System Security Project

-- Create database (run this separately if needed)
-- CREATE DATABASE sepbas_db;

-- Connect to database
-- \c sepbas_db;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('employee', 'manager', 'dept_head', 'hr_admin', 'system_admin')),
    department VARCHAR(100) NOT NULL,
    
    -- MFA fields
    mfa_secret VARCHAR(255),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    
    -- MAC - Mandatory Access Control
    clearance_level INTEGER DEFAULT 1 CHECK (clearance_level BETWEEN 1 AND 3),
    -- 1 = Public, 2 = Internal, 3 = Confidential
    
    -- RuBAC - Rule-Based Access Control
    after_hours_access BOOLEAN DEFAULT FALSE,
    
    -- Account security
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Sessions table (for JWT token management)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token_hash VARCHAR(255) NOT NULL,
    refresh_token VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_access_token ON sessions(access_token_hash);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Nominations table
CREATE TABLE nominations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Employee and manager info
    employee_id UUID NOT NULL REFERENCES users(id),
    manager_id UUID NOT NULL REFERENCES users(id),
    department VARCHAR(100) NOT NULL,
    
    -- Nomination details
    type VARCHAR(20) NOT NULL CHECK (type IN ('bonus', 'promotion')),
    bonus_amount DECIMAL(12, 2) DEFAULT 0,
    promotion_to VARCHAR(255),
    justification TEXT NOT NULL,
    
    -- Approval workflow
    status VARCHAR(50) NOT NULL DEFAULT 'pending_manager' 
        CHECK (status IN ('pending_manager', 'pending_dept_head', 'pending_hr', 'approved', 'rejected')),
    
    level1_approved_by UUID REFERENCES users(id),
    level1_approved_at TIMESTAMP,
    level2_approved_by UUID REFERENCES users(id),
    level2_approved_at TIMESTAMP,
    level3_approved_by UUID REFERENCES users(id),
    level3_approved_at TIMESTAMP,
    
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- MAC - Mandatory Access Control
    mac_label INTEGER DEFAULT 1 CHECK (mac_label BETWEEN 1 AND 3),
    -- Automatically set based on bonus amount:
    -- > 50000 ETB = 3 (Confidential)
    -- > 20000 ETB = 2 (Internal)
    -- <= 20000 ETB = 1 (Public)
    
    -- DAC - Discretionary Access Control
    owner_id UUID NOT NULL REFERENCES users(id),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DAC Permissions table (Discretionary Access Control)
CREATE TABLE dac_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomination_id UUID NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(10) NOT NULL CHECK (permission IN ('view', 'edit')),
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(nomination_id, user_id)
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_nominations_employee ON nominations(employee_id);
CREATE INDEX idx_nominations_manager ON nominations(manager_id);
CREATE INDEX idx_nominations_status ON nominations(status);
CREATE INDEX idx_nominations_department ON nominations(department);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_dac_permissions_nomination ON dac_permissions(nomination_id);
CREATE INDEX idx_dac_permissions_user ON dac_permissions(user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nominations_updated_at
    BEFORE UPDATE ON nominations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically set MAC label based on bonus amount
CREATE OR REPLACE FUNCTION set_mac_label()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'bonus' THEN
        IF NEW.bonus_amount > 50000 THEN
            NEW.mac_label = 3; -- Confidential
        ELSIF NEW.bonus_amount > 20000 THEN
            NEW.mac_label = 2; -- Internal
        ELSE
            NEW.mac_label = 1; -- Public
        END IF;
    ELSE
        NEW.mac_label = 2; -- Promotions are Internal by default
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set MAC label on nomination creation/update
CREATE TRIGGER set_nomination_mac_label
    BEFORE INSERT OR UPDATE ON nominations
    FOR EACH ROW
    EXECUTE FUNCTION set_mac_label();

-- Sample data (optional - for testing)
-- Create a default system admin user
-- Password: Admin@123 (hashed with bcrypt)
INSERT INTO users (email, name, hashed_password, role, department, clearance_level, mfa_enabled)
VALUES (
    'admin@aastu.edu.et',
    'System Administrator',
    '$2a$10$8Z1xYqJ5p0JzQxYqJ5p0JeZxYqJ5p0JzQxYqJ5p0JzQxYqJ5p0Jz.',
    'system_admin',
    'IT',
    3,
    FALSE
) ON CONFLICT (email) DO NOTHING;

-- Views for reporting and analytics

-- View: Nomination statistics by department
CREATE VIEW nomination_stats_by_dept AS
SELECT 
    department,
    COUNT(*) as total_nominations,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
    COUNT(CASE WHEN status LIKE 'pending%' THEN 1 END) as pending,
    AVG(CASE WHEN type = 'bonus' THEN bonus_amount END) as avg_bonus_amount,
    SUM(CASE WHEN type = 'bonus' AND status = 'approved' THEN bonus_amount ELSE 0 END) as total_approved_bonuses
FROM nominations
GROUP BY department;

-- View: User activity summary
CREATE VIEW user_activity_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    u.department,
    COUNT(DISTINCT al.id) as total_actions,
    MAX(al.timestamp) as last_activity,
    u.last_login
FROM users u
LEFT JOIN audit_logs al ON u.id = al.user_id
GROUP BY u.id, u.name, u.email, u.role, u.department, u.last_login;

-- Grant permissions (adjust as needed for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_db_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_db_user;

-- Display table information
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
