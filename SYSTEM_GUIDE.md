# SEPBAS System Guide

## 🚀 System Status

✅ **Backend Server:** Running on `http://localhost:3000`  
✅ **Frontend Server:** Running on `http://localhost:5173`  
✅ **Database:** PostgreSQL connected

---

## 🌐 Access the System

**Open your browser and navigate to:** `http://localhost:5173`

---

## 📋 How the System Works

### 1. Landing Page

When you first visit the system, you'll see a **landing page** with:

- **System Overview:** Description of SEPBAS
- **Key Features:** 6 feature cards showcasing:
  - 5 Access Control Models
  - Multi-Factor Authentication
  - Comprehensive Audit Logging
  - Time-Based Access Control
  - Role-Based Permissions
  - Approval Workflow
- **How It Works:** 4-step process visualization
- **Security Features:** List of security implementations

**Actions Available:**
- **Sign In Button:** Navigate to login page
- **Register New User Button:** Navigate to signup page (admin only)

---

### 2. Sign Up Page (Registration)

**Access:** Click "Register New User" on landing page

**Purpose:** System administrators can register new users

**Required Information:**
- Full Name
- Email Address
- Password (must meet security requirements)
- Confirm Password
- Role (Employee, Manager, Dept Head, HR Admin, System Admin)
- Department
- **Admin Registration Token** (required: `ADMIN_REGISTRATION_TOKEN`)

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 digit
- At least 1 special character (@$!%*?&#)

**MFA Setup:**
- If registering a Manager+ role, a QR code will be displayed
- Scan with Google Authenticator app
- Required for login

**After Registration:**
- Success message displayed
- Option to go back to landing or navigate to login

---

### 3. Login Page

**Access:** Click "Sign In" on landing page

**Login Process:**

1. **Enter Credentials:**
   - Email address
   - Password

2. **MFA (if required):**
   - For Manager+ roles, MFA is required
   - Enter 6-digit code from Google Authenticator
   - Codes refresh every 30 seconds

3. **Time-Based Access Check:**
   - System checks if access is within business hours
   - Business hours: Monday-Friday, 08:00-18:00 EAT
   - If outside hours, access denied (unless after-hours access granted)

4. **Account Lockout:**
   - After 5 failed login attempts, account locked for 15 minutes
   - Prevents brute force attacks

**Test Accounts (Password: `Test@123`):**
- `employee1@aastu.edu.et` - Employee (no MFA)
- `john.manager@aastu.edu.et` - Manager (MFA required)
- `jane.head@aastu.edu.et` - Department Head (MFA required)
- `hr@aastu.edu.et` - HR Admin (MFA required)
- `admin@aastu.edu.et` - System Admin (MFA required)

---

### 4. Dashboard (After Login)

Once logged in, you'll see the main dashboard with different views based on your role:

#### **Employee View:**
- View own nominations
- Track nomination status
- Limited access (RBAC)

#### **Manager View:**
- Create new nominations
- Approve Level-1 nominations
- View department nominations
- Cannot see confidential data (MAC)

#### **Department Head View:**
- Approve Level-2 nominations
- View department nominations
- Cannot approve outside department (ABAC)

#### **HR Admin View:**
- Approve Level-3 nominations
- Manage users
- View audit logs
- Grant after-hours access (RuBAC)
- Cannot approve high-value bonuses outside business hours (ABAC)

#### **System Admin View:**
- Full system access
- Modify clearance levels (MAC)
- View all data
- Create backups
- After-hours access enabled by default

---

## 🔐 Access Control Models in Action

### 1. RBAC (Role-Based Access Control)

**How it works:**
- Each user has a role assigned
- Role determines what they can see and do
- Enforced via middleware in backend

**Example:**
- Employee can only see their own nominations
- Manager can create nominations and approve Level-1
- HR Admin can approve Level-3 and manage users

**Location:** `standalone/server.js:237-252, 636-679`

---

### 2. MAC (Mandatory Access Control)

**How it works:**
- Data automatically classified into 3 levels:
  - **Public (L1):** Bonus ≤ 20,000 ETB
  - **Internal (L2):** Bonus 20,001-50,000 ETB
  - **Confidential (L3):** Bonus > 50,000 ETB
- Users have clearance levels (1-3)
- System automatically filters data based on clearance

**Example:**
- Employee (L1 clearance) cannot see nominations with L3 label
- System Admin (L3 clearance) can see all data
- Only System Admin can change clearance levels

**Location:** `standalone/server.js:134-136, 596-599, 667-669`

---

### 3. DAC (Discretionary Access Control)

**How it works:**
- Each nomination has an owner (the manager who created it)
- Owner can grant view/edit permissions to other users
- Permissions stored in database

**Example:**
- Manager creates nomination (becomes owner)
- Manager can grant "view" permission to specific employee
- Only owner can grant/revoke permissions

**Location:** `standalone/server.js:816-861`

---

### 4. RuBAC (Rule-Based Access Control)

**How it works:**
- Time-based rules: Access only Monday-Friday, 08:00-18:00 EAT
- After-hours access can be granted by HR Admin
- Enforced at login and during operations

**Example:**
- User tries to login on Saturday → Denied
- User tries to login at 20:00 → Denied (unless after-hours access)
- HR Admin grants after-hours access → User can login anytime

**Location:** `standalone/server.js:98-129, 436-442`

---

### 5. ABAC (Attribute-Based Access Control)

**How it works:**
- Dynamic policies based on multiple attributes:
  - User role
  - User department
  - Resource properties (bonus amount)
  - Environmental conditions (time of day)

**Examples:**
- Manager can only nominate employees in their department
- HR Admin cannot approve high-value bonuses (>50K) outside business hours
- Department Head can only approve nominations in their department

**Location:** `standalone/server.js:141-164, 585-594, 713-724`

---

## 📊 Workflow: Creating and Approving a Nomination

### Step 1: Manager Creates Nomination

1. Manager logs in
2. Navigates to Dashboard
3. Clicks "Create Nomination"
4. Fills in:
   - Employee to nominate
   - Type (Bonus or Promotion)
   - Bonus amount (if applicable)
   - Justification
5. System automatically:
   - Assigns MAC label based on bonus amount
   - Sets owner to manager
   - Sets status to "pending_manager"
   - Checks ABAC: Manager can only nominate in their department

### Step 2: Manager Approves (Level-1)

1. Manager sees pending nominations
2. Reviews and approves
3. Status changes to "pending_dept_head"
4. Logged in audit trail

### Step 3: Department Head Approves (Level-2)

1. Department Head sees nominations in their department
2. Reviews and approves
3. Status changes to "pending_hr"
4. ABAC check: Must be in same department

### Step 4: HR Admin Approves (Level-3)

1. HR Admin sees all pending nominations
2. Reviews and approves
3. Status changes to "approved"
4. ABAC check: High-value bonuses (>50K) require business hours
5. Final approval logged

### Step 5: Employee Views Result

1. Employee logs in
2. Sees their nomination status
3. Can view approval history
4. MAC check: Cannot see confidential nominations

---

## 🔍 Admin Panel Features

**Access:** Only HR Admin and System Admin

**Features:**

1. **User Management:**
   - View all users
   - Update user roles
   - Grant after-hours access
   - Modify clearance levels (System Admin only)

2. **Audit Logs:**
   - View all system actions
   - Filter by user, action type, date
   - See IP addresses and timestamps
   - Complete audit trail

3. **Backups:**
   - Create system backups (System Admin only)
   - Export all data as JSON

---

## 🛡️ Security Features

### Authentication
- ✅ Strong password policy
- ✅ bcrypt password hashing
- ✅ Multi-factor authentication (TOTP)
- ✅ Account lockout (5 attempts = 15 min)
- ✅ JWT session tokens (30 min expiry)

### Authorization
- ✅ 5 access control models working together
- ✅ Role-based permissions
- ✅ Clearance-based data filtering
- ✅ Time-based restrictions
- ✅ Attribute-based policies

### Audit & Compliance
- ✅ All actions logged
- ✅ IP address tracking
- ✅ User agent logging
- ✅ Timestamp recording
- ✅ Admin log viewer

---

## 📱 User Roles Explained

| Role | Clearance | MFA | Permissions |
|------|-----------|-----|-------------|
| **Employee** | L1 (Public) | No | View own nominations only |
| **Manager** | L1 (Public) | Yes | Create nominations, approve L1, view department |
| **Dept Head** | L2 (Internal) | Yes | Approve L2, view department |
| **HR Admin** | L2 (Internal) | Yes | Approve L3, manage users, view all |
| **System Admin** | L3 (Confidential) | Yes | Full access, modify clearances |

---

## 🧪 Testing the System

### Test Scenario 1: Employee Login
1. Go to `http://localhost:5173`
2. Click "Sign In"
3. Login: `employee1@aastu.edu.et` / `Test@123`
4. View own nominations (limited access)

### Test Scenario 2: Manager Creates Nomination
1. Login as manager: `john.manager@aastu.edu.et` / `Test@123`
2. Create nomination for employee
3. System assigns MAC label automatically
4. Approve at Level-1

### Test Scenario 3: Test MAC (Clearance Levels)
1. Create nomination with 60,000 ETB bonus (L3 - Confidential)
2. Login as employee (L1 clearance)
3. Employee cannot see the nomination
4. Login as System Admin (L3 clearance)
5. System Admin can see all nominations

### Test Scenario 4: Test RuBAC (Time-Based)
1. Try to login outside business hours (if possible)
2. Access denied
3. HR Admin grants after-hours access
4. User can now login anytime

### Test Scenario 5: Test ABAC (Department-Based)
1. Manager tries to nominate employee from different department
2. Access denied
3. Manager nominates employee from same department
4. Success

---

## 📝 Key Points

1. **Landing Page:** First thing users see - explains system features
2. **Sign Up:** Admin-only registration with token requirement
3. **Login:** Secure authentication with MFA for privileged roles
4. **Dashboard:** Role-specific views and permissions
5. **Access Control:** 5 models working together seamlessly
6. **Audit Trail:** Everything is logged for compliance

---

## 🎓 For Your Academic Report

**System Demonstrates:**
- ✅ All 5 access control models (MAC, DAC, RBAC, RuBAC, ABAC)
- ✅ Multi-factor authentication (TOTP)
- ✅ Comprehensive security features
- ✅ Real-world workflow implementation
- ✅ Complete audit logging

**All requirements are fully implemented and functional!** 🎉

---

## 🆘 Troubleshooting

**Can't login?**
- Check if MFA is required (Manager+ roles)
- Verify password meets requirements
- Check if account is locked (5 failed attempts)
- Verify business hours (Mon-Fri, 08:00-18:00 EAT)

**Can't see nominations?**
- Check your role permissions (RBAC)
- Check your clearance level (MAC)
- Verify department match (ABAC)

**Registration fails?**
- Verify admin token: `ADMIN_REGISTRATION_TOKEN`
- Check password requirements
- Ensure email is unique

---

## 🌐 System URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/api/health

---

**Enjoy exploring SEPBAS!** 🚀

