const http = require('http');

function postRequest(path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: body }));
        });

        req.on('error', error => reject(error));
        req.write(data);
        req.end();
    });
}

function getRequest(path, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: body }));
        });

        req.on('error', error => reject(error));
        req.end();
    });
}

async function testAuth() {
    try {
        // 1. Login
        console.log('Attempting login...');
        const loginData = JSON.stringify({
            email: 'manager@aastu.edu.et',
            password: 'Password@123'
        });

        const loginRes = await postRequest('/api/auth/login', loginData);
        console.log('Login status:', loginRes.status);

        const data = JSON.parse(loginRes.body);

        if (data.mfaRequired) {
            console.log('MFA Required.');
            return;
        }

        const accessToken = data.accessToken;
        console.log('Got token:', accessToken ? accessToken.substring(0, 20) + '...' : 'null');

        if (!accessToken) {
            console.log('No access token returned. Response:', data);
            return;
        }

        // 2. Access protected route
        console.log('Accessing protected route...');
        const protectedRes = await getRequest('/api/nominations', accessToken);
        console.log('Protected route status:', protectedRes.status);

        if (protectedRes.status !== 200) {
            console.log('Protected route error body:', protectedRes.body);
        } else {
            console.log('Success accessing protected route!');
        }

    } catch (error) {
        console.log('Error:', error.message);
    }
}

testAuth();
