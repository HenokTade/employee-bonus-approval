
const http = require('http');

function request(method, path, token, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('--- FINAL VERIFICATION ---');

    console.log('1. Testing Dept Head Flow...');
    const mgrLogin = await request('POST', '/api/auth/login', null, { email: 'manager@aastu.edu.et', password: 'Password@123' });
    const mgrToken = mgrLogin.body.accessToken;

    // Create nomination
    const nomRes = await request('POST', '/api/nominations', mgrToken, {
        employeeId: 10, type: 'bonus', bonusAmount: 5000, justification: 'Final Test'
    });

    const nomId = nomRes.body.nomination?.id;
    const status = nomRes.body.nomination?.status;
    console.log(`Created Nomination ID ${nomId}. Status: '${status}'`);

    if (status === 'pending_dept_head') {
        console.log('✅ Dept Head Fix: Status correctly auto-promoted.');
    } else {
        console.log('❌ Dept Head Fix: Status failed (stuck in pending_manager?).');
    }

    console.log('\n2. Testing Alert Logging...');
    // Trigger a failed login to generate an alert (threshold is 3)
    // We'll just call the alert generation endpoint implicitly if possible, or assume manual triggering works.
    // Instead, let's just check the DB for 'SYSTEM_STARTUP' which should have been logged on restart (if nodemon restarted).

    // To properly test Alerting hook, we need to trigger an alert.
    // Let's try to fail login 4 times.
    for (let i = 0; i < 4; i++) {
        await request('POST', '/api/auth/login', null, { email: 'manager@aastu.edu.et', password: 'WRONG_PASSWORD' });
    }
    console.log(' triggered 4 failed logins.');

    // Wait a sec for async logging
    await new Promise(r => setTimeout(r, 1000));

    // Check DB for Alert Log
}

run();
