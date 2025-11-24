# SEPBAS Quick Start Guide

## Super Fast Setup (5 Minutes)

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install -y postgresql
sudo systemctl start postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Download installer from: https://www.postgresql.org/download/windows/

### 2. Create Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Run these commands in PostgreSQL prompt:
CREATE DATABASE sepbas_db;
\c sepbas_db
\i database.sql
\q
```

### 3. Setup Node.js Project

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and set your database password
# nano .env  (or use any text editor)
```

**Minimal .env file:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sepbas_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD_HERE
JWT_SECRET=change_this_to_a_very_long_random_string_minimum_32_chars
PORT=3000
```

### 4. Start Server

```bash
npm start
```

You should see:
```
✅ Database connected successfully
🚀 Server running on: http://localhost:3000
```

---

## Quick Test

### Register Admin User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@aastu.edu.et",
    "password": "Admin@123",
    "name": "System Admin",
    "role": "system_admin",
    "department": "IT",
    "adminToken": "ADMIN_REGISTRATION_TOKEN"
  }'
```

**Save the QR code URL** from response to setup Google Authenticator.

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@aastu.edu.et",
    "password": "Admin@123",
    "mfaToken": "YOUR_6_DIGIT_CODE"
  }'
```

**Save the accessToken** from response.

### Test API

```bash
# Get users (replace YOUR_TOKEN with actual token)
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Testing with Postman

1. **Download Postman**: https://www.postman.com/downloads/
2. **Import Collection**: Click "Import" and create requests for each endpoint
3. **Set Authorization**: Use "Bearer Token" type with your JWT

### Sample Postman Requests:

**Register User:**
- Method: POST
- URL: `http://localhost:3000/api/auth/register`
- Body (JSON):
```json
{
  "email": "user@aastu.edu.et",
  "password": "Password@123",
  "name": "Test User",
  "role": "employee",
  "department": "Engineering",
  "adminToken": "ADMIN_REGISTRATION_TOKEN"
}
```

**Login:**
- Method: POST
- URL: `http://localhost:3000/api/auth/login`
- Body (JSON):
```json
{
  "email": "user@aastu.edu.et",
  "password": "Password@123"
}
```

**Create Nomination:**
- Method: POST
- URL: `http://localhost:3000/api/nominations`
- Headers: `Authorization: Bearer YOUR_TOKEN`
- Body (JSON):
```json
{
  "employeeId": "EMPLOYEE_UUID",
  "type": "bonus",
  "bonusAmount": 25000,
  "justification": "Excellent work on the project"
}
```

---

## Common Issues & Solutions

### ❌ "Database connection error"

**Check if PostgreSQL is running:**
```bash
# Linux
sudo systemctl status postgresql

# macOS
brew services list

# Windows
# Open Services app and check PostgreSQL service
```

**Restart PostgreSQL:**
```bash
# Linux
sudo systemctl restart postgresql

# macOS
brew services restart postgresql@15
```

### ❌ "Port 3000 already in use"

**Find and kill process:**
```bash
# Linux/macOS
lsof -ti:3000 | xargs kill

# Windows
netstat -ano | findstr :3000
taskkill /PID [PID] /F
```

**Or change port in .env:**
```env
PORT=3001
```

### ❌ "Invalid MFA token"

- Make sure your phone time is synced
- Wait for next code (codes change every 30 seconds)
- Verify you scanned the correct QR code

### ❌ "Cannot find module 'xyz'"

```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

---

## Default Test Users

After running the database.sql, you have:

**Email:** `admin@aastu.edu.et`  
**Password:** `Admin@123`  
**Role:** System Admin  
**Clearance:** Level 3  
**MFA:** Not enabled (for quick testing)

You can create more users via the `/api/auth/register` endpoint.

---

## Quick Reference - All Roles

| Role | Permissions | MFA Required |
|------|------------|--------------|
| Employee | View own nominations | No |
| Manager | Create & approve L1 nominations | Yes |
| Dept Head | Approve L2 nominations | Yes |
| HR Admin | Approve L3, manage users | Yes |
| System Admin | Full system access | Yes |

---

## Access Control Quick Tests

### Test RBAC
Login as different roles → each sees different nominations

### Test MAC
- Create 15,000 ETB bonus (Public - L1)
- Create 60,000 ETB bonus (Confidential - L3)
- Login as user with L1 clearance → only sees first one

### Test DAC
Owner grants permission: `/api/nominations/:id/grant-permission`

### Test RuBAC
Login outside 08:00-18:00 Mon-Fri → denied (unless after_hours_access)

### Test ABAC
- Manager tries to nominate employee from different dept → denied
- HR approves 60K bonus at 20:00 → denied

---

## Next Steps

1. ✅ **Test all endpoints** with Postman
2. ✅ **Create sample data** (users, nominations)
3. ✅ **Test all 5 access control models**
4. ✅ **Test security features** (lockout, MFA, audit logs)
5. ✅ **Prepare demonstration scenarios**
6. ✅ **Document your findings**

---

## Need Help?

- Read the full **README.md** for detailed documentation
- Check **server.js** comments for implementation details
- Review **database.sql** for schema understanding
- Test with **curl** or **Postman** for API verification

**Good luck! 🚀**
