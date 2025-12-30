const http = require('http');

// Simple script to hitting the departments endpoint to trigger the error
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/departments/Electrical%20and%20Mechanical/employees',
    method: 'GET',
    headers: {
        // We need a valid token. Since I can't easily get one if login fails/script fails, well...
        // I can try to login first.
        'Content-Type': 'application/json'
    }
};

async function run() {
    // 1. LOGIN
    const loginData = JSON.stringify({
        email: 'eamman@aastu.edu.et',
        password: 'Password@123'
    });

    const loginReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
    }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log('Login Status:', res.statusCode);
            const session = JSON.parse(data);
            if (!session.accessToken) {
                console.error('Login failed, cannot test auth error');
                return;
            }

            // 2. TRIGGER ERROR
            const req = http.request({
                hostname: 'localhost',
                port: 3000,
                path: '/api/departments/Electrical%20and%20Mechanical/employees',
                method: 'GET',
                headers: { 'Authorization': `Bearer ${session.accessToken}` }
            }, (res2) => {
                let d2 = '';
                res2.on('data', c => d2 += c);
                res2.on('end', () => console.log('Emp Status:', res2.statusCode, d2));
            });
            req.end();
        });
    });
    loginReq.write(loginData);
    loginReq.end();
}

run();
