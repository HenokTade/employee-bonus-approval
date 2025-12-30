const http = require('http');

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

async function testBadAuth() {
    try {
        console.log('Accessing with bad token...');
        const res = await getRequest('/api/nominations', 'BAD_TOKEN_123');
        console.log('Status:', res.status);
        console.log('Body:', res.body);
    } catch (error) {
        console.log('Error:', error.message);
    }
}

testBadAuth();
