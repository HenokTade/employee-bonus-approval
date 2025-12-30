
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
    console.log('--- Testing Nomination Flow ---');

    // 1. Login Manager
    const mgrLogin = await request('POST', '/api/auth/login', null, { email: 'manager@aastu.edu.et', password: 'Password@123' });
    const mgrToken = mgrLogin.body.accessToken;
    console.log('Manager Login:', mgrLogin.status);

    // 2. Create Nomination
    // Need employee ID. Assuming 10 or 11 exists from previous tests.
    const nomRes = await request('POST', '/api/nominations', mgrToken, {
        employeeId: 10,
        type: 'bonus',
        bonusAmount: 5000,
        justification: 'Automated Test Nomination'
    });
    console.log('Create Nomination:', nomRes.status);
    console.log('Nomination Status (Expect pending_dept_head):', nomRes.body.nomination?.status);

    const nomId = nomRes.body.nomination?.id;
    if (!nomId) return console.log('Nomination failed');

    // 3. Login Dept Head
    const headLogin = await request('POST', '/api/auth/login', null, { email: 'head@aastu.edu.et', password: 'Password@123' });
    const headToken = headLogin.body.accessToken;
    console.log('Dept Head Login:', headLogin.status);

    // 4. Fetch Nominations as Dept Head
    const listRes = await request('GET', '/api/nominations', headToken);
    const myNom = listRes.body.nominations.find(n => n.id === nomId);
    console.log('Dept Head sees status:', myNom?.status);

    if (myNom?.status === 'pending_dept_head') {
        console.log('SUCCESS: Status is correct for Dept Head approval.');
    } else {
        console.log('FAILURE: Status mismatch.');
    }
}

run();
