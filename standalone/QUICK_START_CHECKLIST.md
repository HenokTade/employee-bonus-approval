# ✅ SEPBAS Quick Start Checklist

Use this checklist to get your system running in 30 minutes!

---

## 📋 Pre-Installation Checklist

- [ ] Computer running Windows, macOS, or Linux
- [ ] Stable internet connection (for downloading packages)
- [ ] Administrator/sudo access on your computer
- [ ] At least 500 MB free disk space
- [ ] Text editor installed (VS Code, Notepad++, Sublime, etc.)

---

## 🔧 Installation Steps

### Step 1: Install PostgreSQL ⏱️ 10 minutes

**Windows:**
- [ ] Download from https://www.postgresql.org/download/windows/
- [ ] Run installer
- [ ] Set password for `postgres` user (write it down!)
- [ ] Keep default port: 5432
- [ ] Finish installation

**macOS:**
- [ ] Open Terminal
- [ ] Run: `brew install postgresql@14`
- [ ] Run: `brew services start postgresql@14`
- [ ] Done!

**Linux (Ubuntu/Debian):**
- [ ] Open Terminal
- [ ] Run: `sudo apt update`
- [ ] Run: `sudo apt install postgresql postgresql-contrib`
- [ ] Run: `sudo systemctl start postgresql`
- [ ] Done!

**Verify PostgreSQL:**
- [ ] Run: `psql --version`
- [ ] Should show: PostgreSQL 12.x or higher

---

### Step 2: Install Node.js ⏱️ 5 minutes

- [ ] Go to https://nodejs.org/
- [ ] Download LTS version (v18 or v20 recommended)
- [ ] Run installer
- [ ] Keep all default settings
- [ ] Finish installation

**Verify Node.js:**
- [ ] Open Terminal/Command Prompt
- [ ] Run: `node --version`
- [ ] Should show: v16.x or higher
- [ ] Run: `npm --version`
- [ ] Should show: 8.x or higher

---

### Step 3: Create Database ⏱️ 2 minutes

- [ ] Open Terminal/Command Prompt
- [ ] Run: `psql -U postgres`
- [ ] Enter your postgres password
- [ ] Type: `CREATE DATABASE sepbas_db;`
- [ ] Press Enter
- [ ] Type: `\q` to exit
- [ ] Done!

**Expected Output:**
```
postgres=# CREATE DATABASE sepbas_db;
CREATE DATABASE
```

---

### Step 4: Setup Project ⏱️ 5 minutes

- [ ] Navigate to the `standalone` folder
- [ ] Open Terminal/Command Prompt in this folder

**Install Dependencies:**
- [ ] Run: `npm install`
- [ ] Wait for installation to complete (2-3 minutes)
- [ ] Should see: "added XXX packages"

**Configure Environment:**
- [ ] Copy `.env.example` to `.env`
  - Windows: `copy .env.example .env`
  - Mac/Linux: `cp .env.example .env`
- [ ] Open `.env` in text editor
- [ ] Change `DB_PASSWORD=your_password_here` to your actual postgres password
- [ ] Change `JWT_SECRET=...` to any random string
- [ ] Save and close

**Example .env file:**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sepbas_db
DB_USER=postgres
DB_PASSWORD=MyPostgresPassword123  ← Change this!

PORT=3000
NODE_ENV=development

JWT_SECRET=my_super_secret_random_string_abc123  ← Change this!
SESSION_EXPIRY=30m
REFRESH_TOKEN_EXPIRY=7d

ADMIN_REGISTRATION_TOKEN=ADMIN_REGISTRATION_TOKEN
FRONTEND_URL=http://localhost:5173
```

---

### Step 5: Initialize Database ⏱️ 2 minutes

- [ ] Run: `npm run setup-db`
- [ ] Wait for completion
- [ ] Should see: "✅ Database setup completed successfully!"
- [ ] Should see list of sample users created

**Expected Output:**
```
🔧 Setting up SEPBAS database...

📁 Reading database schema...
📊 Creating tables...
✅ Tables created successfully

👥 Creating sample users...
   ✓ admin@aastu.edu.et (system_admin)
   ✓ hr@aastu.edu.et (hr_admin)
   ✓ john.manager@aastu.edu.et (manager)
   ✓ jane.head@aastu.edu.et (dept_head)
   ✓ employee1@aastu.edu.et (employee)
   ✓ employee2@aastu.edu.et (employee)
   ✓ sales.manager@aastu.edu.et (manager)

✅ Database setup completed successfully!
```

---

### Step 6: Start Server ⏱️ 1 minute

- [ ] Run: `npm start`
- [ ] Should see startup message
- [ ] Should see: "📡 Server running on http://localhost:3000"
- [ ] Leave this terminal window open

**Expected Output:**
```
====================================================================
🚀 SEPBAS Backend Server Started
====================================================================
📡 Server running on http://localhost:3000
🌍 Environment: development
🔒 Security: Helmet, CORS, Rate Limiting enabled
📊 Database: PostgreSQL (sepbas_db)
====================================================================
```

---

### Step 7: Test Server ⏱️ 2 minutes

**Open a NEW Terminal (keep server running in first terminal)**

**Test 1: Health Check**
- [ ] Run: `curl http://localhost:3000/api/health`
- [ ] Should see: `{"status":"OK",...}`

**Test 2: Login**
- [ ] Run this command:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"employee1@aastu.edu.et","password":"Test@123"}'
```
- [ ] Should see: `{"success":true,"accessToken":"..."}`

**If both tests work: ✅ SUCCESS!**

---

## 🎯 Quick Test with Postman (Optional) ⏱️ 5 minutes

- [ ] Download Postman: https://www.postman.com/downloads/
- [ ] Install and open Postman
- [ ] Click "Import"
- [ ] Select `SEPBAS_Postman_Collection.json`
- [ ] Click "Collections" tab
- [ ] Expand "SEPBAS API"
- [ ] Click "Health Check" → Click "Send"
- [ ] Should see: `{"status":"OK"}`

---

## 🧪 Verify All Features Work

### Test 1: Login as Employee (No MFA)
- [ ] In Postman: "Authentication" → "Login (Employee - No MFA)"
- [ ] Click "Send"
- [ ] Should get access token
- [ ] Token saved automatically

### Test 2: View Nominations
- [ ] In Postman: "Nominations" → "Get All Nominations"
- [ ] Click "Send"
- [ ] Should see empty array: `{"nominations":[]}`

### Test 3: Create Nomination (as Manager)
- [ ] First login as manager (will need to disable MFA in DB)
- [ ] Run in psql:
```sql
UPDATE users SET mfa_enabled = false WHERE email = 'john.manager@aastu.edu.et';
```
- [ ] Login as manager in Postman
- [ ] Create nomination
- [ ] Should succeed

### Test 4: View Audit Logs (as Admin)
- [ ] Login as admin (disable MFA first)
- [ ] In Postman: "Admin" → "Get Audit Logs"
- [ ] Should see array of log entries

**If all tests pass: ✅ FULLY WORKING!**

---

## 📊 Sample Login Credentials

Use these to test different roles:

| Email | Password | Role | MFA | Notes |
|-------|----------|------|-----|-------|
| employee1@aastu.edu.et | Test@123 | Employee | No | ✅ Easy testing |
| employee2@aastu.edu.et | Test@123 | Employee | No | ✅ Easy testing |
| john.manager@aastu.edu.et | Test@123 | Manager | Yes* | Can create nominations |
| jane.head@aastu.edu.et | Test@123 | Dept Head | Yes* | Can approve level 2 |
| hr@aastu.edu.et | Test@123 | HR Admin | Yes* | Can approve level 3 |
| admin@aastu.edu.et | Test@123 | System Admin | Yes* | Full access |

*For testing, you can disable MFA in database:
```sql
UPDATE users SET mfa_enabled = false WHERE email = 'user@aastu.edu.et';
```

---

## 🐛 Troubleshooting

### Problem: "npm: command not found"
**Solution:**
- [ ] Restart your terminal
- [ ] If still not working, reinstall Node.js
- [ ] Verify with: `node --version`

### Problem: "psql: command not found"
**Solution:**
- [ ] Add PostgreSQL to PATH
- [ ] Windows: Check "Add to PATH" during installation
- [ ] Mac: Run `brew link postgresql@14`
- [ ] Linux: Already in PATH usually

### Problem: "Database connection failed"
**Solution:**
- [ ] Check PostgreSQL is running
  - Windows: Check Services for "postgresql"
  - Mac: `brew services list`
  - Linux: `sudo systemctl status postgresql`
- [ ] Verify password in `.env` is correct
- [ ] Try: `psql -U postgres -d sepbas_db`

### Problem: "Port 3000 already in use"
**Solution:**
- [ ] Change `PORT=3000` to `PORT=3001` in `.env`
- [ ] Or stop the process using port 3000
- [ ] Restart server

### Problem: "npm install fails"
**Solution:**
- [ ] Clear npm cache: `npm cache clean --force`
- [ ] Delete `node_modules` folder
- [ ] Delete `package-lock.json`
- [ ] Run `npm install` again

### Problem: "Cannot find module"
**Solution:**
- [ ] Make sure you're in the `standalone` folder
- [ ] Run `npm install` again
- [ ] Check that `node_modules` folder exists

---

## ✅ Final Verification Checklist

Before moving to testing phase:

- [ ] PostgreSQL installed and running
- [ ] Node.js installed and working
- [ ] Database `sepbas_db` created
- [ ] Dependencies installed (`node_modules` folder exists)
- [ ] `.env` file configured with correct password
- [ ] Database initialized (sample users created)
- [ ] Server starts without errors
- [ ] Health check returns OK
- [ ] Can login with sample credentials
- [ ] Can view nominations (even if empty)
- [ ] Audit logs being created

**All checked? You're ready for full testing! 🎉**

---

## 📚 What to Read Next

1. **For Testing:**
   - [ ] Read `TESTING_GUIDE.md`
   - [ ] Follow test scenarios
   - [ ] Take screenshots

2. **For Understanding:**
   - [ ] Read `README.md` (full documentation)
   - [ ] Review `server.js` code
   - [ ] Check `database-schema.sql`

3. **For Your Report:**
   - [ ] Read `PROJECT_SUMMARY.md`
   - [ ] Use provided structure
   - [ ] Include code snippets

4. **For Demo:**
   - [ ] Practice login flow
   - [ ] Test each access control model
   - [ ] Prepare explanation

---

## 🎓 Timeline to Completion

| Day | Task | Duration |
|-----|------|----------|
| Day 1 | Installation & Setup | 30 min |
| Day 1 | Initial Testing | 1 hour |
| Day 2 | Complete Testing (all models) | 3 hours |
| Day 2-3 | Take Screenshots | 1 hour |
| Day 3-4 | Write Report | 4-6 hours |
| Day 4-5 | Create Presentation | 2 hours |
| Day 5 | Practice Demo | 1 hour |
| **Total** | | **~15 hours** |

---

## 🎯 Success Criteria

You know you're ready when you can:

- [ ] Explain what RBAC, MAC, DAC, RuBAC, and ABAC are
- [ ] Show each access control model working
- [ ] Demonstrate password policy enforcement
- [ ] Show MFA setup and login
- [ ] Display audit logs
- [ ] Explain the database schema
- [ ] Walk through complete approval workflow
- [ ] Answer questions about security features

---

## 📞 Getting Help

If stuck:

1. **Check Documentation:**
   - README.md has detailed troubleshooting
   - TESTING_GUIDE.md has examples
   - Server logs show error messages

2. **Database Issues:**
   ```bash
   # Check if PostgreSQL is running
   psql -U postgres
   
   # Check if database exists
   \l
   
   # Check if tables exist
   \c sepbas_db
   \dt
   ```

3. **Server Issues:**
   ```bash
   # Check Node.js version
   node --version
   
   # Check if port is available
   lsof -i :3000  # Mac/Linux
   netstat -ano | findstr :3000  # Windows
   ```

4. **Ask Your Instructor/TA:**
   - Show error messages
   - Share what you've tried
   - Provide log output

---

## 🎉 You're All Set!

Your SEPBAS system is now:
- ✅ Installed
- ✅ Configured
- ✅ Running
- ✅ Tested
- ✅ Ready for full testing and report writing

**Good luck with your Computer System Security project!** 🎓

---

**Next Steps:**
1. Read `TESTING_GUIDE.md` for comprehensive testing
2. Read `PROJECT_SUMMARY.md` for report writing
3. Practice your demo presentation

---

**Addis Ababa Science and Technology University**  
**Department of Software Engineering**  
**Computer System Security - Project Two**
