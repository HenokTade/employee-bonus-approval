# SEPBAS Testing Guide

Complete testing scenarios for demonstrating all access control models and security features.

---

## 🧪 Testing Scenarios

### 1. RBAC (Role-Based Access Control) Testing

#### Scenario 1.1: Employee Role Restrictions
**Expected:** Employees can only view their own nominations

```bash
# Login as employee
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"employee1@aastu.edu.et","password":"Test@123"}'

# Save the token from response
TOKEN="<paste_token_here>"

# Try to access admin users endpoint (should fail)
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"

# Expected: 403 Forbidden - "Insufficient permissions"
```

#### Scenario 1.2: Manager Can Create Nominations
```bash
# Login as manager (requires MFA)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.manager@aastu.edu.et","password":"Test@123"}'

# If MFA required, you'll get: {"mfaRequired":true}
# Temporarily disable MFA in database for testing:
# UPDATE users SET mfa_enabled = false WHERE email = 'john.manager@aastu.edu.et';

# After getting token, create nomination
curl -X POST http://localhost:3000/api/nominations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 5,
    "type": "bonus",
    "bonusAmount": 25000,
    "justification": "Excellent performance in Q4"
  }'

# Expected: Success with nomination created
```

#### Scenario 1.3: System Admin Can Access Everything
```bash
# Login as system admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aastu.edu.et","password":"Test@123"}'

# Access admin endpoints
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"

# Create backup
curl -X POST http://localhost:3000/api/admin/backup \
  -H "Authorization: Bearer $TOKEN"

# Expected: Full access to all features
```

---

### 2. MAC (Mandatory Access Control) Testing

#### Scenario 2.1: Public Data (L1) - Everyone Can Access
```sql
-- In PostgreSQL, create a low-value nomination
psql -U postgres -d sepbas_db

INSERT INTO nominations (employee_id, manager_id, department, type, bonus_amount, justification, mac_label, owner_id, status)
VALUES (5, 3, 'Engineering', 'bonus', 5000, 'Good work', 1, 3, 'pending_manager');
```

```bash
# Login as employee (clearance L1)
# Get nominations - should see L1 data
curl -X GET http://localhost:3000/api/nominations \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"

# Expected: Can see nominations with mac_label = 1
```

#### Scenario 2.2: Confidential Data (L3) - Restricted Access
```sql
-- Create high-value nomination (automatically gets L3)
INSERT INTO nominations (employee_id, manager_id, department, type, bonus_amount, justification, mac_label, owner_id, status)
VALUES (5, 3, 'Engineering', 'bonus', 75000, 'Critical project delivery', 3, 3, 'pending_manager');
```

```bash
# Login as employee (clearance L1)
curl -X GET http://localhost:3000/api/nominations \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"

# Expected: Will NOT see the 75,000 ETB nomination (filtered by MAC)

# Login as system admin (clearance L3)
curl -X GET http://localhost:3000/api/nominations \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: WILL see the confidential nomination
```

#### Scenario 2.3: System Admin Updates Clearance Levels
```bash
# Login as system admin
curl -X POST http://localhost:3000/api/admin/users/5/update \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clearanceLevel": 3
  }'

# Now employee can see confidential data
# Expected: Success - clearance level updated
```

---

### 3. DAC (Discretionary Access Control) Testing

#### Scenario 3.1: Owner Grants View Permission
```bash
# Login as manager (nomination owner)
curl -X POST http://localhost:3000/api/nominations/1/grant-permission \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUserId": 7,
    "permission": "view"
  }'

# Expected: Success - permission granted
```

#### Scenario 3.2: Non-Owner Cannot Grant Permissions
```bash
# Login as different user (not owner)
curl -X POST http://localhost:3000/api/nominations/1/grant-permission \
  -H "Authorization: Bearer $OTHER_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUserId": 7,
    "permission": "view"
  }'

# Expected: 403 Forbidden - "Only the owner can grant permissions"
```

---

### 4. RuBAC (Rule-Based Access Control) Testing

#### Scenario 4.1: Access Denied Outside Business Hours
```bash
# Try to login on Saturday or outside 08:00-18:00 EAT
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"employee1@aastu.edu.et","password":"Test@123"}'

# Expected (if outside hours): 403 Forbidden
# "Access denied: System is only available Monday-Friday, 08:00-18:00 EAT"
```

#### Scenario 4.2: After-Hours Access Granted
```bash
# Login as HR admin (during business hours)
# Grant after-hours access to user
curl -X POST http://localhost:3000/api/admin/users/5/update \
  -H "Authorization: Bearer $HR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "afterHoursAccess": true
  }'

# Now that user can login anytime
# Expected: User can access system 24/7
```

#### Scenario 4.3: Temporary Testing (Disable Time Check)
For testing purposes, you can temporarily disable time restrictions:

```javascript
// In server.js, modify checkTimeBasedAccess function:
function checkTimeBasedAccess(afterHoursAccess) {
    return true; // TESTING ONLY - allows access anytime
    
    // Original code:
    // if (isWithinBusinessHours()) {
    //     return true;
    // }
    // return afterHoursAccess === true;
}
```

**Remember to restore original code after testing!**

---

### 5. ABAC (Attribute-Based Access Control) Testing

#### Scenario 5.1: Manager Can Only Nominate in Their Department
```bash
# Login as Engineering manager
curl -X POST http://localhost:3000/api/nominations \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 7,
    "type": "bonus",
    "bonusAmount": 10000,
    "justification": "Good work"
  }'

# If employeeId 7 is in Sales department:
# Expected: 403 Forbidden - "You can only nominate employees in your department"

# If employeeId is in Engineering:
# Expected: Success
```

#### Scenario 5.2: High-Value Bonus Requires Business Hours
```bash
# Try to approve high-value bonus outside business hours
# (Temporarily set system time or test on weekend)

curl -X POST http://localhost:3000/api/nominations/1/approve \
  -H "Authorization: Bearer $HR_TOKEN"

# If nomination has bonus > 50,000 ETB and time is outside 08:00-18:00:
# Expected: 403 Forbidden
# "High-value bonuses can only be approved during business hours"
```

#### Scenario 5.3: Dynamic Policy Evaluation
```javascript
// In server.js, add custom ABAC policy for testing:

// Policy: Only HR can approve bonuses > 30,000 ETB
if (action === 'approve_bonus' && resource.bonusAmount > 30000) {
    return user.role === 'hr_admin';
}

// Policy: Department heads can only approve in their department
if (action === 'approve_dept' && user.role === 'dept_head') {
    return user.department === resource.department;
}
```

---

## 🔐 Security Feature Testing

### Password Policy Enforcement

```bash
# Weak password (should fail)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"weak@aastu.edu.et",
    "password":"weak",
    "name":"Weak User",
    "role":"employee",
    "department":"IT",
    "adminToken":"ADMIN_REGISTRATION_TOKEN"
  }'

# Expected: 400 Bad Request - Password validation error

# Strong password (should succeed)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"strong@aastu.edu.et",
    "password":"Strong@Pass123",
    "name":"Strong User",
    "role":"employee",
    "department":"IT",
    "adminToken":"ADMIN_REGISTRATION_TOKEN"
  }'

# Expected: Success
```

### Account Lockout Testing

> Note: A network-level rate limiter protects the login endpoint as well. If you're running rapid automated tests you may hit the endpoint rate-limit (HTTP 429) before account lockout triggers. To avoid this while testing you can either increase `LOGIN_RATE_MAX` / shorten `LOGIN_RATE_WINDOW_MINUTES`, or disable the login rate limiter by setting `ENABLE_LOGIN_RATELIMIT=false`.

```bash
# Make 5 failed login attempts
for i in {1..5}; do
  echo "Attempt $i:"
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"employee1@aastu.edu.et","password":"WrongPass"}'
  echo ""
done

# Expected: After 5 attempts, account locked for 15 minutes
# Message: "Account locked due to too many failed attempts. Try again in 15 minutes."
```

### List Department Employees (Manager)

Managers can list employees in their own department. HR/Admin can list any department.

```bash
# Manager (department = 'Engineering')
curl -X GET "http://localhost:3000/api/departments/Engineering/employees" \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# HR can list other departments
curl -X GET "http://localhost:3000/api/departments/Sales/employees" \
  -H "Authorization: Bearer $HR_TOKEN"
```
```

### MFA Testing

```bash
# Register user with MFA-required role
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"mfatest@aastu.edu.et",
    "password":"Test@123",
    "name":"MFA Test",
    "role":"manager",
    "department":"IT",
    "adminToken":"ADMIN_REGISTRATION_TOKEN"
  }'

# Response will include QR code URL
# Scan with Google Authenticator

# Login (first attempt)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mfatest@aastu.edu.et","password":"Test@123"}'

# Expected: {"mfaRequired":true}

# Login with MFA token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"mfatest@aastu.edu.et",
    "password":"Test@123",
    "mfaToken":"123456"
  }'

# Expected: Success with access token
```

---

## 📊 Audit Logging Verification

### View Audit Logs
```bash
# Login as HR admin or system admin
curl -X GET http://localhost:3000/api/admin/logs \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: Array of audit log entries showing:
# - User actions (login, logout, create, approve, etc.)
# - Timestamps
# - IP addresses
# - Action details
```

### Verify Specific Actions Are Logged
```sql
-- In PostgreSQL
psql -U postgres -d sepbas_db

-- Check recent login attempts
SELECT user_id, action, timestamp, ip_address 
FROM audit_logs 
WHERE action LIKE '%LOGIN%' 
ORDER BY timestamp DESC 
LIMIT 10;

-- Check failed access attempts
SELECT user_id, action, details, timestamp 
FROM audit_logs 
WHERE action = 'ACCESS_DENIED' 
ORDER BY timestamp DESC;

-- Check nomination approvals
SELECT user_id, action, details, timestamp 
FROM audit_logs 
WHERE action = 'NOMINATION_APPROVED' 
ORDER BY timestamp DESC;
```

---

## 🎯 Complete Workflow Test

### End-to-End Nomination Process

```bash
# Step 1: Manager creates nomination
curl -X POST http://localhost:3000/api/nominations \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 5,
    "type": "bonus",
    "bonusAmount": 30000,
    "justification": "Exceptional Q4 performance"
  }'

# Save nomination ID from response

# Step 2: Manager approves (Level 1)
curl -X POST http://localhost:3000/api/nominations/1/approve \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Step 3: Department Head approves (Level 2)
curl -X POST http://localhost:3000/api/nominations/1/approve \
  -H "Authorization: Bearer $DEPT_HEAD_TOKEN"

# Step 4: HR Admin approves (Level 3)
curl -X POST http://localhost:3000/api/nominations/1/approve \
  -H "Authorization: Bearer $HR_TOKEN"

# Step 5: Verify final status
curl -X GET http://localhost:3000/api/nominations \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Expected: Nomination status = "approved"
```

---

## 📋 Testing Checklist

### RBAC
- [ ] Employee cannot access admin endpoints
- [ ] Manager can create nominations
- [ ] Department Head can approve level 2
- [ ] HR Admin can approve level 3
- [ ] System Admin has full access

### MAC
- [ ] L1 users cannot see L3 data
- [ ] L3 users can see all data
- [ ] High-value bonuses auto-labeled L3
- [ ] System Admin can change clearance levels

### DAC
- [ ] Owner can grant permissions
- [ ] Non-owner cannot grant permissions
- [ ] Granted users can access shared resources

### RuBAC
- [ ] Access denied outside business hours
- [ ] After-hours flag allows 24/7 access
- [ ] HR Admin can grant after-hours access

### ABAC
- [ ] Manager restricted to own department
- [ ] High-value bonuses require business hours
- [ ] Dynamic policies evaluated correctly

### Security Features
- [ ] Password policy enforced
- [ ] Account lockout works (5 attempts)
- [ ] MFA required for Manager+ roles
- [ ] JWT tokens expire after 30 minutes
- [ ] All actions logged in audit trail

---

## 🐛 Common Testing Issues

### Issue: "Cannot connect to database"
**Solution:** Ensure PostgreSQL is running
```bash
sudo systemctl status postgresql  # Linux
brew services list  # macOS
```

### Issue: "Authentication required"
**Solution:** Include Bearer token in Authorization header
```bash
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Issue: "MFA token invalid"
**Solution:** 
- Ensure phone time is synced
- Check 2-minute window
- Verify secret is correct
- For testing, disable MFA temporarily:
```sql
UPDATE users SET mfa_enabled = false WHERE email = 'user@aastu.edu.et';
```

### Issue: "Outside business hours"
**Solution:** 
- Test during Mon-Fri 08:00-18:00 EAT
- Grant after-hours access
- Temporarily disable time check in code

---

## 📸 Screenshots for Report

Capture these test results:

1. Successful login with valid credentials
2. Failed login with wrong password
3. Account lockout after 5 attempts
4. MFA QR code generation
5. RBAC - Access denied to admin endpoint
6. MAC - Confidential data filtered
7. RuBAC - Access denied outside hours
8. ABAC - Department restriction
9. Audit log entries
10. Three-level approval workflow

---

## 🎓 For Your Project Report

### What to Include:

1. **Test Plan**
   - List of test scenarios
   - Expected vs actual results
   - Screenshots

2. **Security Features Demonstration**
   - Each access control model
   - Authentication mechanisms
   - Audit logging

3. **Code Snippets**
   - Implementation of each feature
   - Explain how it works

4. **Conclusion**
   - What works well
   - Limitations
   - Future improvements

Good luck with your testing! 🚀
