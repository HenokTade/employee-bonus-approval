
const http = require('http');

function checkDepartments() {
    const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/departments',
        method: 'GET'
    }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log('Status:', res.statusCode);
            console.log('Body:', data);
        });
    });
    req.on('error', (e) => console.error(e));
    req.end();
}

checkDepartments();
