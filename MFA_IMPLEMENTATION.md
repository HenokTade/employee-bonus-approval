# Multi-Factor Authentication (MFA) Implementation

## ✅ Implementation Status

### a) Username/Password Authentication ✅

**Status:** Fully Implemented

**Location:** `standalone/server.js` - Login endpoint (`POST /api/auth/login`)

**Features:**
- ✅ Email/username and password authentication
- ✅ Strong password policy enforcement (min 8 chars, 1 uppercase, 1 digit, 1 special character)
- ✅ bcrypt password hashing (10 rounds)
- ✅ Account lockout after 5 failed attempts (15-minute lockout)
- ✅ Failed login attempt tracking
- ✅ Session management with JWT tokens (30-minute expiry)

**Code Example:**
```javascript
// Password verification
const validPassword = await bcrypt.compare(password, user.hashed_password);

if (!validPassword) {
    // Increment failed attempts
    const newFailedAttempts = user.failed_login_attempts + 1;
    
    if (newFailedAttempts >= 5) {
        // Lock account for 15 minutes
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query(
            'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
            [newFailedAttempts, lockUntil, user.id]
        );
        return res.status(423).json({ 
            error: 'Account locked due to too many failed attempts. Try again in 15 minutes.' 
        });
    }
}
```

---

### b) Multi-Factor Authentication (MFA) ✅

**Status:** Fully Implemented

**MFA Method:** **TOTP (Time-based One-Time Password)** using Google Authenticator

**Location:** 
- Backend: `standalone/server.js` (Registration & Login endpoints)
- Frontend: `components/Login.tsx`

**Technology Stack:**
- **speakeasy** - TOTP secret generation and verification
- **qrcode** - QR code generation for easy setup
- **Google Authenticator** - Mobile app for generating 6-digit codes

---

## 🔐 MFA Implementation Details

### 1. MFA Secret Generation

**When:** During user registration (for Manager+ roles)

**Code Location:** `standalone/server.js` lines 313-320

```javascript
// Generate MFA secret if required
if (requiresMfa) {
    const secret = speakeasy.generateSecret({
        name: `SEPBAS (${email})`,
        issuer: 'AASTU SEPBAS',
    });
    mfaSecret = secret.base32;
    qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
}
```

**What it does:**
- Generates a unique base32-encoded secret for each user
- Creates a QR code (data URL) for easy mobile app setup
- Stores the secret securely in the database

---

### 2. QR Code Generation

**Format:** Data URL (base64-encoded PNG image)

**Example Response:**
```json
{
  "success": true,
  "userId": "123",
  "mfaRequired": true,
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "message": "User registered. Please scan QR code with Google Authenticator."
}
```

**How to Use:**
1. Copy the `qrCodeUrl` from the response
2. Paste it in a browser address bar (or display as `<img src={qrCodeUrl} />`)
3. Scan with Google Authenticator app

---

### 3. MFA Verification During Login

**Code Location:** `standalone/server.js` lines 414-434

```javascript
// Check MFA if required
if (user.mfa_enabled) {
    if (!mfaToken) {
        return res.status(200).json({ 
            mfaRequired: true, 
            userId: user.id 
        });
    }
    
    // Verify TOTP token
    const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: mfaToken,
        window: 2,  // Allow ±2 time steps (60 seconds tolerance)
    });
    
    if (!verified) {
        await logAction(user.id, 'MFA_FAILED', {}, req);
        return res.status(401).json({ error: 'Invalid MFA token' });
    }
}
```

**How it works:**
1. User enters email and password
2. If MFA is enabled, server returns `mfaRequired: true`
3. User enters 6-digit code from Google Authenticator
4. Server verifies code using TOTP algorithm
5. If valid, login succeeds

---

### 4. MFA Roles

**MFA Required For:**
- ✅ Manager
- ✅ Department Head
- ✅ HR Admin
- ✅ System Admin

**MFA Optional For:**
- Employee (can be enabled manually)

**Code Location:** `standalone/server.js` line 307

```javascript
const requiresMfa = ['manager', 'dept_head', 'hr_admin', 'system_admin'].includes(role);
```

---

## 📱 User Flow

### First-Time Setup

1. **Admin registers user** with Manager+ role
   ```bash
   POST /api/auth/register
   {
     "email": "manager@aastu.edu.et",
     "password": "Secure@Pass123",
     "name": "John Manager",
     "role": "manager",
     "department": "Engineering",
     "adminToken": "ADMIN_REGISTRATION_TOKEN"
   }
   ```

2. **Response includes QR code:**
   ```json
   {
     "success": true,
     "mfaRequired": true,
     "qrCodeUrl": "data:image/png;base64,..."
   }
   ```

3. **User scans QR code:**
   - Open Google Authenticator app
   - Tap "+" button
   - Choose "Scan a QR code"
   - Scan the QR code from browser/email

4. **User can now login:**
   - Enter email and password
   - Enter 6-digit code from Google Authenticator
   - Access granted!

---

### Login Flow

```
┌─────────────┐
│   User      │
│  Enters     │
│ Email + PWD │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Backend        │
│  Verifies PWD   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│  MFA Enabled?   │ YES  │ Return      │
│                 │─────▶│ mfaRequired  │
└─────────────────┘      └──────┬───────┘
       │                        │
       │ NO                     ▼
       │                 ┌──────────────┐
       │                 │ User Enters  │
       │                 │ 6-Digit Code │
       │                 └──────┬───────┘
       │                        │
       ▼                        ▼
┌─────────────────┐      ┌──────────────┐
│  Generate JWT   │      │ Verify TOTP   │
│  Return Token   │      │ Generate JWT  │
└─────────────────┘      └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ Return Token │
                          └──────────────┘
```

---

## 🧪 Testing MFA

### Test 1: Register User with MFA

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mfatest@aastu.edu.et",
    "password": "Test@123",
    "name": "MFA Test User",
    "role": "manager",
    "department": "IT",
    "adminToken": "ADMIN_REGISTRATION_TOKEN"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "userId": "...",
  "mfaRequired": true,
  "qrCodeUrl": "data:image/png;base64,...",
  "message": "User registered. Please scan QR code with Google Authenticator."
}
```

---

### Test 2: Login Without MFA Code

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mfatest@aastu.edu.et",
    "password": "Test@123"
  }'
```

**Expected Response:**
```json
{
  "mfaRequired": true,
  "userId": "..."
}
```

---

### Test 3: Login With Valid MFA Code

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mfatest@aastu.edu.et",
    "password": "Test@123",
    "mfaToken": "123456"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "mfatest@aastu.edu.et",
    "name": "MFA Test User",
    "role": "manager",
    "department": "IT",
    "clearanceLevel": 1
  }
}
```

---

### Test 4: Login With Invalid MFA Code

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mfatest@aastu.edu.et",
    "password": "Test@123",
    "mfaToken": "000000"
  }'
```

**Expected Response:**
```json
{
  "error": "Invalid MFA token"
}
```

---

## 🛠️ Setup Scripts

### Setup MFA for Existing Users

Run this script to generate QR codes for existing users:

```bash
node standalone/setup-mfa.js
```

This will:
- Generate MFA secrets for Manager+ roles
- Create QR code images in `standalone/qr-codes/` folder
- Update database with MFA secrets

---

### Get QR Code via API

After logging in, users can get their QR code:

```bash
GET /api/auth/mfa/qrcode
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "qrCodeUrl": "data:image/png;base64,...",
  "email": "user@aastu.edu.et",
  "message": "Scan this QR code with Google Authenticator"
}
```

---

## 📊 Database Schema

**Users Table:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    department VARCHAR(100),
    clearance_level INTEGER DEFAULT 1,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),  -- Base32-encoded TOTP secret
    ...
);
```

---

## 🔒 Security Features

1. **Secret Storage:** MFA secrets stored in database (can be encrypted in production)
2. **Time Window:** TOTP verification allows ±2 time steps (60 seconds tolerance)
3. **Audit Logging:** All MFA attempts logged (success and failure)
4. **Rate Limiting:** Login endpoint protected with rate limiting
5. **Account Lockout:** Prevents brute force attacks

---

## 📝 Summary

✅ **Username/Password Authentication:** Fully implemented with:
- Strong password policy
- bcrypt hashing
- Account lockout protection
- Failed attempt tracking

✅ **Multi-Factor Authentication:** Fully implemented using:
- **TOTP (Time-based One-Time Password)**
- Google Authenticator compatible
- QR code generation for easy setup
- Automatic verification during login

**MFA Method:** TOTP via Google Authenticator (Industry Standard)

**Status:** Production Ready ✅

---

## 🎓 Academic Report Notes

For your report, you can document:

1. **Authentication Method:** Username/Password + TOTP MFA
2. **MFA Implementation:** TOTP using speakeasy library
3. **QR Code Setup:** Automated QR code generation for mobile app pairing
4. **Security:** Time-based codes, 30-second validity window
5. **Compliance:** Industry-standard TOTP (RFC 6238)

**Code References:**
- Registration: `standalone/server.js:264-354`
- Login: `standalone/server.js:361-472`
- MFA Verification: `standalone/server.js:414-434`
- QR Code Generation: `standalone/server.js:313-320`

