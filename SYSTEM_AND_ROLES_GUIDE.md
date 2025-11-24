# SEPBAS System & Roles Guide

## 🏢 System Overview

**SEPBAS** (Secure Employee Promotion & Bonus Approval System) is an enterprise-grade web application designed to manage employee promotions and bonus approvals with comprehensive security controls.

### Core Purpose
- Manage employee nomination workflows
- Enforce multi-level approval processes
- Demonstrate 5 access control models
- Provide complete audit trails
- Ensure data security and confidentiality

### System Architecture

```
┌─────────────┐
│   Frontend  │  React + TypeScript + Tailwind CSS
│  (Port 5173)│  Landing Page, Login, Dashboard, Admin Panel
└──────┬──────┘
       │ HTTP/REST API
       ▼
┌─────────────┐
│   Backend   │  Node.js + Express
│  (Port 3000)│  Authentication, Authorization, Business Logic
└──────┬──────┘
       │ SQL Queries
       ▼
┌─────────────┐
│  PostgreSQL │  Database
│             │  Users, Nominations, Audit Logs
└─────────────┘
```

---

## 👥 User Roles Explained

The system has **5 distinct roles**, each with specific permissions, clearance levels, and responsibilities.

---

## 1. 👤 Employee

### Role Characteristics
- **Clearance Level:** L1 (Public)
- **MFA Required:** No
- **After-Hours Access:** No (unless granted)
- **Hierarchy Level:** Base level

### Permissions & Capabilities

#### ✅ What Employees CAN Do:

1. **View Own Nominations**
   - See only nominations where they are the employee
   - Track status of their own nominations
   - View approval history for their nominations
   - **RBAC:** Filtered by `employee_id = user.id`

2. **View Public Data Only**
   - Can only see nominations with MAC label = 1 (Public)
   - Cannot see Internal (L2) or Confidential (L3) nominations
   - **MAC:** `clearance_level >= mac_label` check

3. **Submit Self-Nominations** (if implemented)
   - Can create nominations for themselves
   - Limited to their own data

#### ❌ What Employees CANNOT Do:

1. **Create Nominations for Others**
   - Cannot nominate other employees
   - Only managers can create nominations

2. **Approve Nominations**
   - No approval authority at any level
   - Cannot change nomination status

3. **View Other Employees' Data**
   - Cannot see nominations for other employees
   - Cannot access department-wide data

4. **Access Admin Functions**
   - Cannot view audit logs
   - Cannot manage users
   - Cannot modify system settings

5. **View Confidential Data**
   - Cannot see high-value bonuses (>50,000 ETB)
   - Cannot see Internal-level data (>20,000 ETB)

### Access Control Models Applied

- **RBAC:** Limited to employee role permissions
- **MAC:** L1 clearance - only Public data
- **RuBAC:** Business hours only (unless granted after-hours)
- **ABAC:** Can only access own data
- **DAC:** Can receive permissions from nomination owners

### Example Workflow

1. Employee logs in
2. Views dashboard showing only their nominations
3. Sees status: "pending_manager", "pending_dept_head", "approved", etc.
4. Cannot see nominations for other employees
5. Cannot see confidential bonus amounts

### Test Account
- **Email:** `employee1@aastu.edu.et`
- **Password:** `Test@123`
- **Department:** Engineering

---

## 2. 👔 Manager

### Role Characteristics
- **Clearance Level:** L1 (Public)
- **MFA Required:** ✅ Yes
- **After-Hours Access:** No (unless granted)
- **Hierarchy Level:** Level 1 (First approval level)

### Permissions & Capabilities

#### ✅ What Managers CAN Do:

1. **Create Nominations**
   - Nominate employees for promotions or bonuses
   - Fill in justification and details
   - **ABAC:** Can only nominate employees in their department
   - **RuBAC:** Can only create during business hours

2. **Approve Level-1 Nominations**
   - Approve nominations at the first level
   - Status changes: `pending_manager` → `pending_dept_head`
   - **RBAC:** Only managers can approve Level-1

3. **View Department Nominations**
   - See all nominations in their department
   - View nominations they created
   - **RBAC:** Filtered by `department = user.department`

4. **Grant DAC Permissions**
   - As nomination owner, can grant view/edit permissions
   - Share nominations with specific users
   - **DAC:** Owner-based permission control

5. **View Public Data**
   - Can see Public (L1) nominations
   - Cannot see Internal (L2) or Confidential (L3) nominations
   - **MAC:** L1 clearance limitation

#### ❌ What Managers CANNOT Do:

1. **Approve Level-2 or Level-3**
   - Cannot approve beyond Level-1
   - Cannot bypass approval workflow

2. **Nominate Outside Department**
   - Cannot nominate employees from other departments
   - **ABAC:** Department-based restriction

3. **View Confidential Data**
   - Cannot see high-value bonuses (>50,000 ETB)
   - Cannot see Internal-level data (>20,000 ETB)

4. **Access Admin Functions**
   - Cannot manage users
   - Cannot view audit logs
   - Cannot modify system settings

5. **Create Nominations Outside Business Hours**
   - **RuBAC:** Restricted to Mon-Fri, 08:00-18:00 EAT

### Access Control Models Applied

- **RBAC:** Manager role permissions
- **MAC:** L1 clearance - Public data only
- **RuBAC:** Business hours for creating nominations
- **ABAC:** Department-based nomination restriction
- **DAC:** Can grant permissions as owner

### Example Workflow

1. Manager logs in (with MFA)
2. Creates nomination for employee in their department
3. System assigns MAC label based on bonus amount
4. Manager approves at Level-1
5. Nomination moves to Department Head for Level-2 approval

### Test Account
- **Email:** `john.manager@aastu.edu.et`
- **Password:** `Test@123`
- **Department:** Engineering
- **MFA:** Required (need Google Authenticator)

---

## 3. 🎯 Department Head

### Role Characteristics
- **Clearance Level:** L2 (Internal)
- **MFA Required:** ✅ Yes
- **After-Hours Access:** No (unless granted)
- **Hierarchy Level:** Level 2 (Second approval level)

### Permissions & Capabilities

#### ✅ What Department Heads CAN Do:

1. **Approve Level-2 Nominations**
   - Approve nominations after Manager approval
   - Status changes: `pending_dept_head` → `pending_hr`
   - **RBAC:** Only dept heads can approve Level-2

2. **View Department Nominations**
   - See all nominations in their department
   - **RBAC:** Filtered by `department = user.department`
   - **ABAC:** Can only approve in their department

3. **View Public and Internal Data**
   - Can see Public (L1) and Internal (L2) nominations
   - Cannot see Confidential (L3) nominations
   - **MAC:** L2 clearance allows up to Internal level

4. **Review Approval History**
   - See who approved at Level-1
   - Track nomination progress

#### ❌ What Department Heads CANNOT Do:

1. **Create Nominations**
   - Cannot create new nominations
   - Only managers can create

2. **Approve Level-1 or Level-3**
   - Cannot approve at Level-1 (manager's job)
   - Cannot approve at Level-3 (HR's job)

3. **Approve Outside Department**
   - Cannot approve nominations from other departments
   - **ABAC:** Department-based restriction

4. **View Confidential Data**
   - Cannot see high-value bonuses (>50,000 ETB)
   - **MAC:** L2 clearance limitation

5. **Access Admin Functions**
   - Cannot manage users
   - Cannot view audit logs
   - Cannot modify system settings

### Access Control Models Applied

- **RBAC:** Department Head role permissions
- **MAC:** L2 clearance - Public and Internal data
- **RuBAC:** Business hours only
- **ABAC:** Department-based approval restriction
- **DAC:** Can receive permissions from owners

### Example Workflow

1. Department Head logs in (with MFA)
2. Sees nominations pending Level-2 approval in their department
3. Reviews nomination details
4. Approves at Level-2
5. Nomination moves to HR Admin for final approval

### Test Account
- **Email:** `jane.head@aastu.edu.et`
- **Password:** `Test@123`
- **Department:** Engineering
- **MFA:** Required (need Google Authenticator)

---

## 4. 👨‍💼 HR Admin

### Role Characteristics
- **Clearance Level:** L2 (Internal)
- **MFA Required:** ✅ Yes
- **After-Hours Access:** Can grant to others
- **Hierarchy Level:** Level 3 (Final approval level)

### Permissions & Capabilities

#### ✅ What HR Admins CAN Do:

1. **Approve Level-3 Nominations (Final Approval)**
   - Final approval authority
   - Status changes: `pending_hr` → `approved`
   - **RBAC:** Only HR admins can approve Level-3
   - **ABAC:** High-value bonuses (>50K) require business hours

2. **View All Nominations**
   - Can see all nominations across all departments
   - **RBAC:** No department filtering

3. **View Public and Internal Data**
   - Can see Public (L1) and Internal (L2) nominations
   - Cannot see Confidential (L3) nominations
   - **MAC:** L2 clearance limitation

4. **Manage Users**
   - View all users
   - Update user roles
   - Grant after-hours access (RuBAC)
   - **RBAC:** HR Admin role required

5. **View Audit Logs**
   - Access complete audit trail
   - Filter by user, action, date
   - See IP addresses and timestamps
   - **RBAC:** Admin panel access

6. **Grant After-Hours Access**
   - Enable users to access system outside business hours
   - **RuBAC:** Controls time-based access

#### ❌ What HR Admins CANNOT Do:

1. **Create Nominations**
   - Cannot create new nominations
   - Only managers can create

2. **Approve Level-1 or Level-2**
   - Cannot approve at Level-1 (manager's job)
   - Cannot approve at Level-2 (dept head's job)

3. **View Confidential Data**
   - Cannot see high-value bonuses (>50,000 ETB)
   - **MAC:** L2 clearance limitation

4. **Modify Clearance Levels**
   - Cannot change user clearance levels
   - Only System Admin can modify MAC clearances

5. **Approve High-Value Bonuses Outside Business Hours**
   - **ABAC:** Policy requires business hours for >50K bonuses
   - Must be during Mon-Fri, 08:00-18:00 EAT

6. **Create Backups**
   - Cannot create system backups
   - Only System Admin can backup

### Access Control Models Applied

- **RBAC:** HR Admin role permissions
- **MAC:** L2 clearance - Public and Internal data
- **RuBAC:** Can grant after-hours access to others
- **ABAC:** Time-based approval restrictions for high-value bonuses
- **DAC:** Can receive permissions from owners

### Example Workflow

1. HR Admin logs in (with MFA)
2. Sees all nominations pending final approval
3. Reviews nomination details
4. For high-value bonus (>50K), checks if business hours
5. Approves at Level-3 (final approval)
6. Nomination status becomes "approved"

### Test Account
- **Email:** `hr@aastu.edu.et`
- **Password:** `Test@123`
- **Department:** HR
- **MFA:** Required (need Google Authenticator)

---

## 5. 🔐 System Admin

### Role Characteristics
- **Clearance Level:** L3 (Confidential) - **Highest**
- **MFA Required:** ✅ Yes
- **After-Hours Access:** ✅ Yes (by default)
- **Hierarchy Level:** System Level (Full control)

### Permissions & Capabilities

#### ✅ What System Admins CAN Do:

1. **Full System Access**
   - Can perform any action in the system
   - No restrictions on data access
   - **RBAC:** System Admin role bypasses most restrictions

2. **View All Data (Including Confidential)**
   - Can see Public (L1), Internal (L2), and Confidential (L3) nominations
   - Can see high-value bonuses (>50,000 ETB)
   - **MAC:** L3 clearance - highest level

3. **Modify Clearance Levels (MAC Enforcement)**
   - Can change user clearance levels
   - Can relabel data sensitivity
   - **MAC:** Only System Admin can modify clearances
   - **Location:** `standalone/server.js:908-912`

4. **Manage All Users**
   - View all users
   - Update any user's role
   - Grant/revoke after-hours access
   - Modify any user attribute

5. **View Complete Audit Logs**
   - Access all audit logs
   - No filtering restrictions
   - Complete system visibility

6. **Create System Backups**
   - Export all data
   - Create system backups
   - **RBAC:** Only System Admin can backup

7. **Register New Users**
   - Can register new users via API
   - Requires admin token
   - **Location:** `standalone/server.js:286-291`

8. **Access System Anytime**
   - After-hours access enabled by default
   - **RuBAC:** Not restricted by time

9. **Bypass Most Restrictions**
   - Can approve at any level (if needed)
   - Can view any department's data
   - Can access outside business hours

#### ❌ What System Admins CANNOT Do:

1. **Bypass Audit Logging**
   - All actions are still logged
   - Cannot disable audit trail
   - Security compliance maintained

2. **Modify Core System Logic**
   - Cannot change access control models
   - Cannot modify security policies
   - (Would require code changes)

### Access Control Models Applied

- **RBAC:** System Admin role - full permissions
- **MAC:** L3 clearance - can see all data levels
- **RuBAC:** After-hours access enabled
- **ABAC:** Can bypass most attribute-based restrictions
- **DAC:** Can access any resource

### Example Workflow

1. System Admin logs in (with MFA)
2. Views all nominations across all departments
3. Can see confidential high-value bonuses
4. Modifies user clearance levels if needed
5. Creates system backup
6. Reviews complete audit logs

### Test Account
- **Email:** `admin@aastu.edu.et`
- **Password:** `Test@123`
- **Department:** IT
- **MFA:** Required (need Google Authenticator)

---

## 📊 Role Comparison Table

| Feature | Employee | Manager | Dept Head | HR Admin | System Admin |
|---------|----------|---------|-----------|----------|--------------|
| **Clearance Level** | L1 | L1 | L2 | L2 | L3 |
| **MFA Required** | No | Yes | Yes | Yes | Yes |
| **After-Hours Access** | No* | No* | No* | Can Grant | Yes |
| **Create Nominations** | No | Yes | No | No | Yes |
| **Approve Level-1** | No | Yes | No | No | Yes |
| **Approve Level-2** | No | No | Yes | No | Yes |
| **Approve Level-3** | No | No | No | Yes | Yes |
| **View Own Data** | Yes | Yes | Yes | Yes | Yes |
| **View Department Data** | No | Yes | Yes | Yes | Yes |
| **View All Data** | No | No | No | Yes | Yes |
| **View Confidential (L3)** | No | No | No | No | Yes |
| **Manage Users** | No | No | No | Yes | Yes |
| **Modify Clearances** | No | No | No | No | Yes |
| **View Audit Logs** | No | No | No | Yes | Yes |
| **Create Backups** | No | No | No | No | Yes |
| **Grant After-Hours** | No | No | No | Yes | Yes |

*Can be granted by HR Admin or System Admin

---

## 🔄 Approval Workflow

### Complete Flow

```
┌─────────────┐
│   Manager   │ Creates Nomination
│             │ Status: pending_manager
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Manager   │ Approves Level-1
│             │ Status: pending_dept_head
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Dept Head   │ Approves Level-2
│             │ Status: pending_hr
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  HR Admin   │ Approves Level-3
│             │ Status: approved ✅
└─────────────┘
```

### Who Can Approve What

1. **Level-1 Approval:**
   - **Who:** Manager
   - **Status Change:** `pending_manager` → `pending_dept_head`
   - **RBAC:** Only manager role

2. **Level-2 Approval:**
   - **Who:** Department Head
   - **Status Change:** `pending_dept_head` → `pending_hr`
   - **RBAC:** Only dept_head role
   - **ABAC:** Must be in same department

3. **Level-3 Approval:**
   - **Who:** HR Admin
   - **Status Change:** `pending_hr` → `approved`
   - **RBAC:** Only hr_admin role
   - **ABAC:** High-value bonuses require business hours

---

## 🛡️ Access Control Models Per Role

### RBAC (Role-Based Access Control)
- **Employee:** Limited to own data
- **Manager:** Can create and approve L1
- **Dept Head:** Can approve L2
- **HR Admin:** Can approve L3 and manage users
- **System Admin:** Full access

### MAC (Mandatory Access Control)
- **Employee:** L1 clearance - Public only
- **Manager:** L1 clearance - Public only
- **Dept Head:** L2 clearance - Public + Internal
- **HR Admin:** L2 clearance - Public + Internal
- **System Admin:** L3 clearance - All levels

### DAC (Discretionary Access Control)
- **All Roles:** Can receive permissions from nomination owners
- **Manager:** Can grant permissions (as owner)
- **System Admin:** Can access any resource

### RuBAC (Rule-Based Access Control)
- **Employee/Manager/Dept Head:** Business hours only
- **HR Admin:** Can grant after-hours access
- **System Admin:** After-hours access by default

### ABAC (Attribute-Based Access Control)
- **Manager:** Can only nominate in their department
- **Dept Head:** Can only approve in their department
- **HR Admin:** High-value bonuses require business hours
- **System Admin:** Can bypass most restrictions

---

## 📝 Real-World Scenarios

### Scenario 1: Employee Views Their Nomination

**User:** Employee  
**Action:** Views dashboard  
**What They See:**
- Only their own nominations
- Status updates
- Cannot see other employees' data
- Cannot see confidential bonuses

**Access Control:**
- **RBAC:** Filtered by `employee_id = user.id`
- **MAC:** Only Public (L1) nominations visible

---

### Scenario 2: Manager Creates and Approves Nomination

**User:** Manager  
**Actions:**
1. Creates nomination for employee in their department
2. Approves at Level-1

**What Happens:**
- System assigns MAC label based on bonus amount
- Manager becomes nomination owner (DAC)
- Status: `pending_manager` → `pending_dept_head`
- Cannot nominate employee from different department (ABAC)

**Access Control:**
- **RBAC:** Manager role permissions
- **ABAC:** Department-based restriction
- **RuBAC:** Must be business hours
- **DAC:** Manager is owner

---

### Scenario 3: HR Admin Approves High-Value Bonus

**User:** HR Admin  
**Action:** Approves nomination with 60,000 ETB bonus  
**What Happens:**
- System checks if business hours (ABAC)
- If outside hours → Access denied
- If business hours → Approval succeeds
- Status: `pending_hr` → `approved`

**Access Control:**
- **RBAC:** HR Admin role
- **ABAC:** Time-based policy for high-value bonuses
- **MAC:** Can see Internal (L2) but not Confidential (L3)

---

### Scenario 4: System Admin Modifies Clearance

**User:** System Admin  
**Action:** Changes employee clearance from L1 to L2  
**What Happens:**
- Employee can now see Internal-level data
- Only System Admin can do this
- Action logged in audit trail

**Access Control:**
- **RBAC:** System Admin role
- **MAC:** Only System Admin can modify clearances

---

## 🎯 Key Takeaways

1. **Hierarchical Structure:**
   - Employee → Manager → Dept Head → HR Admin → System Admin
   - Each level has increasing permissions

2. **Clearance Levels:**
   - L1 (Public): Employee, Manager
   - L2 (Internal): Dept Head, HR Admin
   - L3 (Confidential): System Admin only

3. **MFA Requirement:**
   - Manager+ roles require MFA
   - Employees don't need MFA

4. **Approval Chain:**
   - Must go through all levels
   - Cannot skip levels
   - Each level has specific authority

5. **Access Restrictions:**
   - Multiple access control models work together
   - No single point of failure
   - Comprehensive security

---

## 📚 Summary

**SEPBAS** implements a comprehensive role-based system where:

- **5 distinct roles** with clear responsibilities
- **3-level approval workflow** for nominations
- **5 access control models** working together
- **Complete audit trail** for all actions
- **Time-based restrictions** for security
- **Data classification** based on sensitivity

Each role has specific permissions, and the system enforces these through multiple security layers to ensure data integrity and confidentiality.

**All roles are fully implemented and functional!** ✅


