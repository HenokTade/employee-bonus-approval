
const http = require('http');
const fs = require('fs');

const logFile = 'auth_debug.log';
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
};

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

async function run() {
    const loginData = JSON.stringify({
        email: 'employee1@aastu.edu.et',
        password: 'Password@123'
    });

    log('--- START ---');

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
            log(`Login Status: ${res.statusCode}`);
            if (res.statusCode !== 200) {
                log(`Login Failed Body: ${data}`);
                return;
            }

            try {
                const session = JSON.parse(data);
                if (!session.accessToken) {
                    log('No accessToken');
                    return;
                }

                const token = session.accessToken;
                log('Token obtained.');

                const req = http.request({
                    hostname: 'localhost',
                    port: 3000,
                    path: '/api/departments/Software%20Engineering/employees',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                }, (res2) => {
                    let d2 = '';
                    res2.on('data', c => d2 += c);
                    res2.on('end', () => {
                        log(`Protected Status: ${res2.statusCode}`);
                        log(`Protected Body: ${d2}`);
                    });
                });
                req.end();

            } catch (e) {
                log(`JSON Parse Error: ${e}`);
            }
        });
    });

    loginReq.on('error', (e) => {
        log(`Request Error: ${e}`);
    });

    loginReq.write(loginData);
    loginReq.end();
}

run();
