
const http = require('http');

async function run() {
    const loginData = JSON.stringify({
        email: 'manager@aastu.edu.et',
        password: 'Password@123'
    });

    const loginReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginData)
        }
    }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            // ... handling login ...
            const session = JSON.parse(data);
            const token = session.accessToken;
            const dept = 'Software Engineering';

            const req = http.request({
                hostname: 'localhost',
                port: 3000,
                path: `/api/departments/${encodeURIComponent(dept)}/employees`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }, (res2) => {
                let d2 = '';
                res2.on('data', c => d2 += c);
                res2.on('end', () => {
                    console.log('--- RESPONSE ---');
                    console.log(d2);
                    console.log('--- END ---');
                });
            });
            req.end();
        });
    });
    loginReq.write(loginData);
    loginReq.end();
}
run();
