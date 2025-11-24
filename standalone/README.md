# SEPBAS - Secure Employee Promotion & Bonus Approval System

**Addis Ababa Science and Technology University**  
**Department of Software Engineering**  
**Computer System Security - Project Two**

A comprehensive employee promotion and bonus approval system demonstrating multiple access control models and advanced security features.

---

## 📘 Assignment Scope (Minimal, Realistic & Focused)

**Project Title:** Secure Employee Promotion & Bonus Approval System (SEPBAS)  
**Core Objective:** Web portal where managers nominate employees while demonstrating **MAC, DAC, RBAC, RuBAC, ABAC, strong authentication, and audit logging.**

### User Roles (RBAC Foundation)

| Role            | Description                                                  |
|-----------------|--------------------------------------------------------------|
| Employee        | View own data, submit self-nomination                        |
| Manager         | Nominate/reporting employees, approve Level‑1                |
| Department Head | Approve Level‑2                                             |
| HR Admin        | Approve Level‑3, manage roles & rules                        |
| System Admin    | Full system control, MAC enforcement                         |

### Access Control Models (All Required)

| Model  | Minimal Implementation                                                                                                                         |
|--------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| RBAC   | Assign one role per user; role drives menus, buttons, approvals                                                                                |
| DAC    | Each nomination has an owner who can grant view/edit rights (checkbox list)                                                                    |
| MAC    | Sensitivity labels (Public/Internal/Confidential). Bonus > 50,000 ETB ⇒ Confidential. Only System Admin can relabel. Clearance ≥ label required|
| RuBAC  | No access 18:00–08:00 weekdays or weekends unless “After-Hours Access” flag set by HR                                                          |
| ABAC   | Runtime policies, e.g. Manager + same department ⇒ can nominate; HR + business hours ⇒ can approve high-value bonuses                         |

### Authentication & Identification

| Feature              | Requirement                                                                                       |
|----------------------|----------------------------------------------------------------------------------------------------|
| Registration         | System Admin only (or admin form + reCAPTCHA + email verify)                                       |
| Credentials          | Username + password                                                                                |
| Password policy      | ≥8 chars, 1 uppercase, 1 digit, 1 special                                                          |
| Hashing              | bcrypt or Argon2                                                                                   |
| Account lockout      | 5 failed attempts ⇒ 15‑minute lock                                                                 |
| MFA                  | TOTP (Google Authenticator) for Manager+ roles                                                     |
| Sessions             | JWT access (30 min), refresh token, logout invalidates                                             |
| Transport security   | HTTPS everywhere (Let’s Encrypt acceptable for dev/demo)                                           |

### Audit Trails & Logging

- Log every action (user, timestamp, IP, action description)
- Store logs in database table, **no plain text files**
- Encrypt sensitive log fields (AES‑256)
- Admin UI to search/view logs

### Data Backups

- Admin “Export Backup” button → encrypted ZIP of DB **or** automated daily local backup.

### Core Features (Keep Minimal)

| Feature              | Description                                                                                                  |
|----------------------|--------------------------------------------------------------------------------------------------------------|
| Login + MFA          | With policies above                                                                                          |
| Dashboard            | Pending nominations visible to relevant user                                                                 |
| Submit Nomination    | Manager selects employee, fills info, uploads one PDF justification                                          |
| Approval Workflow    | Three levels (Manager → Department Head → HR)                                                                |
| Employee View        | Employees track their own nominations                                                                        |
| Admin Panel          | Manage users, roles, MAC labels, RuBAC flags, audits, backups                                                |

### Suggested Tech Stack

| Layer      | Technology                                             |
|------------|--------------------------------------------------------|
| Frontend   | HTML/CSS/Bootstrap + Vanilla JS **or** React (current) |
| Backend    | Node.js + Express (current) or Python Flask/Django     |
| Database   | PostgreSQL or MySQL (current: PostgreSQL)              |
| Auth       | Passport.js / custom JWT (current implementation)      |
| MFA        | speakeasy + qrcode (current)                           |
| Policies   | In-code policy engine / rules                          |
| Hosting    | Local demo or free-tier cloud                          |

📝 **Skip** bulk upload, biometrics, mobile app, delegation, complex reporting, payments. Focus on demonstrating the five access models + hardened authentication + encrypted logging.

---

## 🎯 Project Features

### Access Control Models (All 5 Implemented)

1. **RBAC (Role-Based Access Control)**
   - Five roles: Employee, Manager, Department Head, HR Admin, System Admin
   - Role-specific permissions and UI access

2. **MAC (Mandatory Access Control)**
   - Three-tier classification: Public (L1), Internal (L2), Confidential (L3)
   - Automatic labeling based on bonus amounts
   - Clearance-based data access enforcement

3. **DAC (Discretionary Access Control)**
   - Resource owners can grant view/edit permissions
   - Implemented in nomination sharing feature

4. **RuBAC (Rule-Based Access Control)**
   - Time-based restrictions: Monday-Friday, 08:00-18:00 EAT
   - After-hours access flag (granted by HR Admin)

5. **ABAC (Attribute-Based Access Control)**
   - Dynamic policies based on user attributes (role, department)
   - Resource properties (bonus amount)
   - Environmental conditions (time of day)

### Security Features

#### Authentication & Identification
- ✅ User registration (admin-only)
- ✅ Strong password policy (min 8 chars, 1 uppercase, 1 digit, 1 special)
- ✅ bcrypt password hashing
- ✅ Multi-Factor Authentication (TOTP via Google Authenticator)
- ✅ Account lockout (5 failed attempts = 15-minute lockout)
- ✅ JWT session management (30-minute expiry)
- ✅ HTTPS-ready

#### Audit & Compliance
- ✅ Comprehensive audit logging (all actions tracked)
- ✅ IP address and user agent tracking
- ✅ Encrypted log storage
- ✅ Admin dashboard for log viewing
- ✅ Database backup functionality

---

## 🛠️ Tech Stack

| Component       | Technology          |
|-----------------|---------------------|
| Backend         | Node.js + Express   |
| Database        | PostgreSQL          |
| Authentication  | JWT + bcryptjs      |
| MFA             | speakeasy + QRCode  |
| Security        | Helmet + CORS       |
| Frontend        | React + Vite        |

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **npm** or **yarn** package manager
- **Git** (optional, for cloning)

---

## 🚀 Installation & Setup

### Step 1: Install PostgreSQL

**Windows:**
```bash
# Download and install from: https://www.postgresql.org/download/windows/
# During installation, remember your postgres user password
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Step 2: Create Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE sepbas_db;

# Exit
\q
```

### Step 3: Clone/Download Project

```bash
# If using Git
git clone <your-repository-url>
cd sepbas/standalone

# OR simply navigate to the standalone folder
cd standalone
```

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env file with your settings
```

**Edit `.env` file:**
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sepbas_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret (Change this!)
JWT_SECRET=change_this_to_a_random_long_string_for_production

# Session Configuration
SESSION_EXPIRY=30m
REFRESH_TOKEN_EXPIRY=7d

# Admin Registration Token
ADMIN_REGISTRATION_TOKEN=ADMIN_REGISTRATION_TOKEN

# CORS
FRONTEND_URL=http://localhost:5173
```

### Step 6: Setup Database Schema & Sample Data

```bash
npm run setup-db
```

This will:
- Create all database tables
- Set up indexes and triggers
- Create sample users with hashed passwords

**Sample Users Created:**

| Email | Role | Password | MFA Required |
|-------|------|----------|--------------|
| admin@aastu.edu.et | System Admin | Test@123 | Yes |
| hr@aastu.edu.et | HR Admin | Test@123 | Yes |
| john.manager@aastu.edu.et | Manager | Test@123 | Yes |
| jane.head@aastu.edu.et | Dept Head | Test@123 | Yes |
| employee1@aastu.edu.et | Employee | Test@123 | No |
| employee2@aastu.edu.et | Employee | Test@123 | No |

### Step 7: Start the Server

```bash
# Production mode
npm start

# Development mode (auto-restart on changes)
npm run dev
```

You should see:
```
🚀 SEPBAS Backend Server Started
📡 Server running on http://localhost:3000
🌍 Environment: development
🔒 Security: Helmet, CORS, Rate Limiting enabled
📊 Database: PostgreSQL (sepbas_db)
```

---

## 🧪 Testing the API

### Using cURL

**1. Register a new user:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@aastu.edu.et",
    "password": "Test@123",
    "name": "Test User",
    "role": "employee",
    "department": "Engineering",
    "adminToken": "ADMIN_REGISTRATION_TOKEN"
  }'
```

**2. Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee1@aastu.edu.et",
    "password": "Test@123"
  }'
```

**3. Get nominations (requires token):**
```bash
curl http://localhost:3000/api/nominations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Using Postman

1. Import the API endpoints
2. Set environment variable for `baseURL` = `http://localhost:3000`
3. After login, save the `accessToken` to use in subsequent requests
4. Add `Authorization: Bearer {token}` header to protected routes

---

## 📱 Frontend Setup (Optional)

The backend works standalone, but you can connect a React frontend:

### Option A: Use the React frontend from this project

```bash
# In a new terminal, navigate to project root
cd ..

# Install dependencies
npm install

# Start development server
npm run dev
```

### Option B: Build custom frontend

Update your fetch URLs to point to `http://localhost:3000/api/...`

Example:
```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password })
});
```

---

## 🔐 Security Features Demonstration

### 1. Password Policy Enforcement
Try registering with weak password:
```bash
# This will fail
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aastu.edu.et","password":"weak","name":"Test","role":"employee","department":"IT","adminToken":"ADMIN_REGISTRATION_TOKEN"}'
```

### 2. Account Lockout
Try logging in with wrong password 5 times:
```bash
# Attempt 5 times with wrong password
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"employee1@aastu.edu.et","password":"WrongPass"}'
done
```

### 3. Time-Based Access (RuBAC)
- Access is restricted to Monday-Friday, 08:00-18:00 EAT
- Test by trying to login outside business hours
- Grant after-hours access via admin panel

### 4. MAC Clearance Levels
```sql
-- In PostgreSQL, create a high-value nomination
INSERT INTO nominations (employee_id, manager_id, department, type, bonus_amount, justification, mac_label, owner_id)
VALUES (5, 3, 'Engineering', 'bonus', 60000, 'Exceptional performance', 3, 3);

-- Employee (clearance L1) cannot see this (L3 Confidential)
-- Only System Admin (clearance L3) can access
```

### 5. ABAC Policies
- Manager can only nominate employees in their department
- High-value bonuses (>50,000 ETB) require business hours for HR approval
- Department heads can only approve in their department

---

## 📊 Database Schema

### Users Table
- Stores user accounts with RBAC roles
- MAC clearance levels (1-3)
- RuBAC after-hours access flag
- MFA secrets and account lockout status

### Nominations Table
- Employee promotion/bonus requests
- Multi-level approval workflow
- MAC sensitivity labels
- DAC permission grants (JSONB)

### Audit Logs Table
- Complete audit trail of all actions
- User ID, timestamp, IP address
- Action type and details (JSON)

---

## 🎓 Academic Report Guidelines

### What to Document

1. **Introduction**
   - Problem statement
   - System overview
   - Security requirements

2. **Access Control Models**
   - Explain each model (RBAC, MAC, DAC, RuBAC, ABAC)
   - Show implementation with code snippets
   - Provide test scenarios

3. **Authentication & Authorization**
   - Password policy enforcement
   - MFA implementation
   - Session management
   - Account lockout mechanism

4. **Audit & Logging**
   - What is logged
   - How logs are stored
   - Log analysis capabilities

5. **Testing**
   - Test cases for each security feature
   - Screenshots of successful/failed access attempts
   - Performance metrics

6. **Conclusions**
   - Achievements
   - Limitations
   - Future improvements

### Code Snippets to Include

**RBAC Example:**
```javascript
function authorize(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
```

**MAC Example:**
```javascript
function checkMacClearance(userClearance, dataLabel) {
    return userClearance >= dataLabel;
}
```

**RuBAC Example:**
```javascript
function isWithinBusinessHours() {
    const now = new Date();
    const eatHour = now.getUTCHours() + 3;
    const day = now.getUTCDay();
    return !(day === 0 || day === 6 || eatHour < 8 || eatHour >= 18);
}
```

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list  # macOS

# Test connection
psql -U postgres -d sepbas_db
```

### Port Already in Use
```bash
# Change PORT in .env file
PORT=3001
```

### Dependencies Installation Fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### MFA Not Working
- Ensure your phone's time is synced correctly
- Check that the MFA secret is properly stored in database
- Use a 2-minute window for TOTP verification

---

## 📝 API Endpoints Reference

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/auth/register | Register new user | Admin Token |
| POST | /api/auth/login | User login | No |
| POST | /api/auth/logout | User logout | Yes |

### Nominations
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/nominations | Create nomination | Manager+ |
| GET | /api/nominations | Get nominations | Yes |
| POST | /api/nominations/:id/approve | Approve nomination | Manager/DeptHead/HR |
| POST | /api/nominations/:id/reject | Reject nomination | Manager/DeptHead/HR |
| POST | /api/nominations/:id/grant-permission | Grant DAC permission | Owner |

### Admin
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/admin/users | Get all users | HR/SysAdmin |
| POST | /api/admin/users/:id/update | Update user permissions | HR/SysAdmin |
| GET | /api/admin/logs | View audit logs | HR/SysAdmin |
| POST | /api/admin/backup | Create system backup | SysAdmin |

### Health
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/health | Server health check | No |

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

---

## 👥 Contributors

**AASTU Software Engineering Student**  
Computer System Security - Project Two

---

## 📄 License

This project is for academic purposes only.  
Addis Ababa Science and Technology University © 2024

---

## 🎉 Good Luck with Your Project!

For questions or issues, please consult your instructor or TA.
