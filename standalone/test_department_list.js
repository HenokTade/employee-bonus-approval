const http = require('http');

async function testDepartmentList() {
    // 1. Login as Manager (eamman)
    const loginData = JSON.stringify({
        email: 'eamman@aastu.edu.et',
        password: 'Password@123'
    });

    const loginReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': loginData.length
        }
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (res.statusCode !== 200) {
                console.error('Login failed:', res.statusCode, data);
                return;
            }
            const session = JSON.parse(data);
            const token = session.accessToken;
            const department = session.user.department;
            console.log('Login success. Token obtained.');
            console.log('User Department:', department);

            // 2. Fetch Employees
            const empPath = `/api/departments/${encodeURIComponent(department)}/employees`;
            console.log('Fetching:', empPath);

            const empReq = http.request({
                hostname: 'localhost',
                port: 3000,
                path: empPath,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }, (empRes) => {
                let empData = '';
                empRes.on('data', (chunk) => empData += chunk);
                empRes.on('end', () => {
                    console.log('Employee List Status:', empRes.statusCode);
                    console.log('Employee List Response:', empData);
                });
            });
            empReq.end();
        });
    });

    loginReq.write(loginData);
    loginReq.end();
}

testDepartmentList();
