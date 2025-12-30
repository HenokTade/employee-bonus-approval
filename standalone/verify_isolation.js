
const http = require('http');

function loginAndGetEmployees(email, password, department) {
    return new Promise((resolve, reject) => {
        const loginData = JSON.stringify({ email, password });

        const loginReq = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode !== 200) return resolve(`Login Failed for ${email}: ${data}`);
                const token = JSON.parse(data).accessToken;

                const req = http.request({
                    hostname: 'localhost',
                    port: 3000,
                    path: `/api/departments/${encodeURIComponent(department)}/employees`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                }, (res2) => {
                    let d2 = '';
                    res2.on('data', c => d2 += c);
                    res2.on('end', () => {
                        try {
                            const employees = JSON.parse(d2).users.map(u => u.email);
                            resolve({ manager: email, employees });
                        } catch (e) {
                            resolve(`Error parsing response for ${email}`);
                        }
                    });
                });
                req.end();
            });
        });
        loginReq.write(loginData);
        loginReq.end();
    });
}

async function run() {
    console.log('--- Verifying Isolation ---');
    const res1 = await loginAndGetEmployees('manager@aastu.edu.et', 'Password@123', 'Software Engineering');
    console.log('Software Engineering Manager sees:', res1);

    const res2 = await loginAndGetEmployees('john.manager@aastu.edu.et', 'Password@123', 'Engineering');
    console.log('Engineering Manager sees:', res2);
}

run();
