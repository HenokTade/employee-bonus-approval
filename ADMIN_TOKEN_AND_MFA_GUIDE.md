# ADMIN_REGISTRATION_TOKEN & MFA Guide

## 🔑 ADMIN_REGISTRATION_TOKEN

### Where to Find It

The `ADMIN_REGISTRATION_TOKEN` is stored in the **`.env` file** in the `standalone` folder.

**Location:** `standalone/.env`

**Current Value:** `ADMIN_REGISTRATION_TOKEN`

### How to Check/View It

**Option 1: View in File**
```bash
# Navigate to standalone folder
cd standalone

# View the .env file (Windows PowerShell)
Get-Content .env | Select-String "ADMIN_REGISTRATION_TOKEN"

# Or open in notepad
notepad .env
```

**Option 2: Check via Command Line**
```bash
# Windows PowerShell
Get-Content standalone\.env | Select-String "ADMIN_REGISTRATION_TOKEN"
```

### Current Token Value

**Default Token:** `ADMIN_REGISTRATION_TOKEN`

This is the default value set during setup. You can use this exact value when registering new users.

### How It Works

1. **Backend Check:** When you register a new user, the backend checks if the provided `adminToken` matches the value in `.env`
2. **Security:** Only users with the correct token can register new users
3. **Location in Code:** `standalone/server.js:287`

```javascript
if (adminToken !== process.env.ADMIN_REGISTRATION_TOKEN) {
    return res.status(401).json({ 
        error: 'Unauthorized: Only system admin can register users' 
    });
}
```

### How to Use It

**In Sign Up Form:**
1. Go to Sign Up page
2. Fill in all user details
3. In the "Admin Registration Token" field, enter: `ADMIN_REGISTRATION_TOKEN`
4. Click "Register"

**Via API:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@aastu.edu.et",
    "password": "Secure@Pass123",
    "name": "New User",
    "role": "manager",
    "department": "Engineering",
    "adminToken": "ADMIN_REGISTRATION_TOKEN"
  }'
```

### Change the Token (Optional)

If you want to change it for security:

1. **Edit `.env` file:**
   ```env
   ADMIN_REGISTRATION_TOKEN=YourNewSecureToken123
   ```

2. **Restart the backend server** for changes to take effect

3. **Use the new token** when registering users

---

## 🔐 How MFA (Multi-Factor Authentication) Works

### Overview

MFA adds an extra layer of security by requiring:
1. **Something you know:** Password
2. **Something you have:** 6-digit code from Google Authenticator app

### MFA Technology: TOTP (Time-based One-Time Password)

**Standard:** RFC 6238 (Industry Standard)  
**Library:** `speakeasy` (Node.js)  
**App:** Google Authenticator (or any TOTP-compatible app)

---

## 📱 Step-by-Step: How MFA Works

### Phase 1: MFA Setup (During Registration)

**When:** User is registered with Manager+ role

**What Happens:**

1. **Secret Generation** (`standalone/server.js:314-318`)
   ```javascript
   const secret = speakeasy.generateSecret({
       name: `SEPBAS (${email})`,
       issuer: 'AASTU SEPBAS',
   });
   mfaSecret = secret.base32;  // Base32-encoded secret
   ```

2. **QR Code Creation** (`standalone/server.js:319`)
   ```javascript
   qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
   ```

3. **Storage**
   - Secret stored in database: `users.mfa_secret`
   - MFA enabled flag set: `users.mfa_enabled = true`

4. **QR Code Display**
   - QR code shown in registration response
   - User scans with Google Authenticator app
   - App stores the secret securely

**Example Response:**
```json
{
  "success": true,
  "userId": "...",
  "mfaRequired": true,
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "message": "User registered. Please scan QR code with Google Authenticator."
}
```

---

### Phase 2: MFA Verification (During Login)

**When:** User with MFA enabled tries to login

**Step 1: Initial Login Attempt**

1. User enters email and password
2. Backend verifies password
3. Backend checks: `if (user.mfa_enabled)`

**Step 2: MFA Required Response**

If MFA is enabled and no token provided:
```javascript
if (!mfaToken) {
    return res.status(200).json({ 
        mfaRequired: true, 
        userId: user.id 
    });
}
```

**Frontend Response:**
- Shows MFA input field
- User opens Google Authenticator app
- App displays 6-digit code (changes every 30 seconds)

**Step 3: TOTP Verification**

User enters 6-digit code, backend verifies:

```javascript
const verified = speakeasy.totp.verify({
    secret: user.mfa_secret,      // Secret from database
    encoding: 'base32',            // Encoding format
    token: mfaToken,               // 6-digit code from user
    window: 2,                     // ±2 time steps (60 seconds tolerance)
});
```

**How TOTP Works:**
1. **Time-based:** Code changes every 30 seconds
2. **Algorithm:** HMAC-SHA1 with current time
3. **Tolerance:** Allows ±60 seconds (window: 2)
4. **Synchronization:** Both server and app use same secret and time

**Step 4: Login Success or Failure**

**If Verified:**
```javascript
if (verified) {
    // Generate JWT token
    const token = generateToken(user);
    res.json({ success: true, accessToken: token, user: {...} });
}
```

**If Not Verified:**
```javascript
if (!verified) {
    await logAction(user.id, 'MFA_FAILED', {}, req);
    return res.status(401).json({ error: 'Invalid MFA token' });
}
```

---

## 🔄 Complete MFA Flow Diagram

```
┌─────────────┐
│   User      │
│  Registers  │
│ (Manager+)  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Backend        │
│  Generates      │
│  MFA Secret     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  QR Code        │
│  Generated      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  User Scans     │
│  QR Code with   │
│  Google Auth    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Secret Stored  │
│  in App         │
└─────────────────┘

       ┌─────────────┐
       │   User      │
       │   Logs In   │
       └──────┬──────┘
              │
              ▼
       ┌─────────────────┐
       │  Password       │
       │  Verified       │
       └──────┬──────────┘
              │
              ▼
       ┌─────────────────┐
       │  MFA Required?  │
       │  YES            │
       └──────┬──────────┘
              │
              ▼
       ┌─────────────────┐
       │  User Opens     │
       │  Google Auth    │
       │  Gets 6-Digit   │
       │  Code           │
       └──────┬──────────┘
              │
              ▼
       ┌─────────────────┐
       │  Backend        │
       │  Verifies TOTP  │
       │  Using Secret   │
       └──────┬──────────┘
              │
         ┌────┴────┐
         │         │
    Valid?      Invalid?
         │         │
         ▼         ▼
    ┌────────┐ ┌──────────┐
    │ Login  │ │  Error   │
    │Success │ │ 401      │
    └────────┘ └──────────┘
```

---

## 🎯 MFA Roles

**MFA Required For:**
- ✅ Manager
- ✅ Department Head
- ✅ HR Admin
- ✅ System Admin

**MFA Optional For:**
- Employee (can be enabled manually)

**Code Location:** `standalone/server.js:307`
```javascript
const requiresMfa = ['manager', 'dept_head', 'hr_admin', 'system_admin'].includes(role);
```

---

## 📱 Setting Up Google Authenticator

### Step 1: Download App

- **Android:** [Google Play Store](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2)
- **iOS:** [App Store](https://apps.apple.com/app/google-authenticator/id388497605)

### Step 2: Scan QR Code

1. After registering a Manager+ user, QR code is displayed
2. Open Google Authenticator app
3. Tap the **"+"** button
4. Choose **"Scan a QR code"**
5. Point camera at QR code
6. App automatically adds the account

### Step 3: Get Code

1. Open Google Authenticator
2. Find "SEPBAS (your-email@aastu.edu.et)"
3. See 6-digit code (updates every 30 seconds)
4. Enter this code when logging in

---

## 🔍 Technical Details

### TOTP Algorithm

1. **Time Step:** 30 seconds
2. **Hash Function:** HMAC-SHA1
3. **Code Length:** 6 digits
4. **Tolerance Window:** ±60 seconds (2 time steps)

### Secret Storage

- **Format:** Base32-encoded string
- **Location:** `users.mfa_secret` column in database
- **Security:** Should be encrypted in production

### Verification Process

```javascript
speakeasy.totp.verify({
    secret: user.mfa_secret,    // From database
    encoding: 'base32',
    token: mfaToken,             // From user input
    window: 2                   // ±2 time steps = ±60 seconds
})
```

**Returns:** `true` if valid, `false` if invalid

---

## 🧪 Testing MFA

### Test 1: Register User with MFA

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mfatest@aastu.edu.et",
    "password": "Test@123",
    "name": "MFA Test",
    "role": "manager",
    "department": "IT",
    "adminToken": "ADMIN_REGISTRATION_TOKEN"
  }'
```

**Response includes QR code URL**

### Test 2: Login Without MFA Code

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mfatest@aastu.edu.et",
    "password": "Test@123"
  }'
```

**Response:**
```json
{
  "mfaRequired": true,
  "userId": "..."
}
```

### Test 3: Login With MFA Code

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mfatest@aastu.edu.et",
    "password": "Test@123",
    "mfaToken": "123456"
  }'
```

**Response:** Success with access token (if code is valid)

---

## ⚠️ Common Issues

### Issue 1: "Invalid MFA token"

**Causes:**
- Code expired (older than 60 seconds)
- Wrong code entered
- Clock not synchronized

**Solutions:**
- Wait for next code (30 seconds)
- Check phone time is correct
- Re-enter code carefully

### Issue 2: QR Code Not Showing

**Causes:**
- User already has MFA secret
- Registration didn't complete

**Solutions:**
- Check registration response
- Use API endpoint to get QR code: `GET /api/auth/mfa/qrcode`

### Issue 3: Can't Scan QR Code

**Solutions:**
- Copy QR code data URL
- Paste in browser to display image
- Or use manual entry in Google Authenticator

---

## 📝 Summary

### ADMIN_REGISTRATION_TOKEN
- **Location:** `standalone/.env`
- **Default Value:** `ADMIN_REGISTRATION_TOKEN`
- **Usage:** Required when registering new users
- **Security:** Change for production use

### MFA (Multi-Factor Authentication)
- **Technology:** TOTP (Time-based One-Time Password)
- **App:** Google Authenticator
- **Required For:** Manager+ roles
- **How It Works:**
  1. Secret generated during registration
  2. QR code displayed for scanning
  3. User scans with Google Authenticator
  4. During login, user enters 6-digit code
  5. Backend verifies code using TOTP algorithm
  6. Login succeeds if code is valid

**Both are fully implemented and working!** ✅

