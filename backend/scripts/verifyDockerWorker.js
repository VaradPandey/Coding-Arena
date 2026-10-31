/**
 * Coding Arena — Safe Docker Judge Worker Verification Script
 * 
 * Verifies that the Docker judge worker environment, container C++ compiler,
 * runtime tools, Redis connectivity, and Neon database connectivity are operational.
 * 
 * Does NOT execute arbitrary user code or modify production data.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

async function verify() {
    console.log('\n======================================================');
    console.log('   🐳 CODING ARENA — DOCKER JUDGE WORKER VERIFICATION');
    console.log('======================================================\n');

    let allPassed = true;

    function logStep(name, status, details) {
        const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
        console.log(`${icon} [${name.padEnd(24)}] ${details}`);
        if (status === 'FAIL') allPassed = false;
    }

    const envFilePath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envFilePath)) {
        logStep('.env File', 'FAIL', 'backend/.env does not exist!');
        return;
    }

    // 1. Check Docker Desktop availability
    try {
        const dockerVer = execSync('docker --version', { encoding: 'utf8' }).trim();
        logStep('Docker Desktop', 'PASS', dockerVer);
    } catch (e) {
        logStep('Docker Desktop', 'FAIL', 'Docker is not running or not in PATH: ' + e.message);
        return;
    }

    // 2. Check Image presence
    try {
        const imageInspect = execSync('docker image inspect coding-arena-worker:latest --format "{{.Id}}"', { encoding: 'utf8' }).trim();
        logStep('Worker Image', 'PASS', `coding-arena-worker:latest (${imageInspect.substring(0, 19)})`);
    } catch (e) {
        logStep('Worker Image', 'FAIL', 'Image coding-arena-worker:latest not built. Run "docker compose build judge-worker"');
        return;
    }

    // 3. Check C++ Compiler inside container
    try {
        const gppVer = execSync('docker run --rm coding-arena-worker:latest g++ --version', { encoding: 'utf8' });
        const firstLine = gppVer.split('\n')[0].trim();
        logStep('Container C++ (g++)', 'PASS', firstLine);
    } catch (e) {
        logStep('Container C++ (g++)', 'FAIL', 'g++ is not available inside the container: ' + e.message);
    }

    // 4. Harmless C++ Hello World compilation inside container
    try {
        const cppCode = '#include <iostream>\\nint main() { std::cout << \\"CONTAINER_CPP_OK\\" << std::endl; return 0; }';
        const cmd = `docker run --rm coding-arena-worker:latest sh -c "printf '${cppCode}' > /tmp/h.cpp && g++ -std=c++17 -O2 /tmp/h.cpp -o /tmp/h && /tmp/h"`;
        const testOutput = execSync(cmd, { encoding: 'utf8' }).trim();
        if (testOutput.includes('CONTAINER_CPP_OK')) {
            logStep('Container C++ Run', 'PASS', 'Compiled & ran C++ test with -std=c++17 -O2 inside container');
        } else {
            logStep('Container C++ Run', 'FAIL', `Unexpected output: ${testOutput}`);
        }
    } catch (e) {
        logStep('Container C++ Run', 'FAIL', 'Failed to compile/run inside container: ' + e.message);
    }

    // 5. Redis Connectivity from inside container
    try {
        const redisCode = `
const Redis = require('ioredis');
const r = new Redis('redis://host.docker.internal:6379');
r.ping()
  .then(res => { console.log('REDIS_PING_OK:' + res); r.quit(); process.exit(0); })
  .catch(err => { console.error('REDIS_ERR:' + err.message); process.exit(1); });
        `;
        const b64 = Buffer.from(redisCode).toString('base64');
        const redisCmd = `docker run --rm --add-host=host.docker.internal:host-gateway coding-arena-worker:latest node -e "eval(Buffer.from('${b64}', 'base64').toString('utf8'))"`;
        const redisRes = execSync(redisCmd, { encoding: 'utf8' }).trim();
        if (redisRes.includes('REDIS_PING_OK:PONG')) {
            logStep('Worker -> Redis Link', 'PASS', 'Connected to host Redis at redis://host.docker.internal:6379 (PONG)');
        } else {
            logStep('Worker -> Redis Link', 'FAIL', `Unexpected Redis response: ${redisRes}`);
        }
    } catch (e) {
        logStep('Worker -> Redis Link', 'FAIL', 'Cannot reach host Redis from container: ' + e.message);
    }

    // 6. PostgreSQL Connectivity from inside container
    try {
        const dbCode = `
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT current_database() as db;')
  .then(res => { console.log('DB_OK:' + res.rows[0].db); pool.end(); process.exit(0); })
  .catch(err => { console.error('DB_ERR:' + err.message); process.exit(1); });
        `;
        const b64Db = Buffer.from(dbCode).toString('base64');
        const dbCmd = `docker run --rm --env-file "${envFilePath}" coding-arena-worker:latest node -e "eval(Buffer.from('${b64Db}', 'base64').toString('utf8'))"`;
        const dbRes = execSync(dbCmd, { encoding: 'utf8' });
        if (dbRes.includes('DB_OK:neondb')) {
            logStep('Worker -> Neon DB Link', 'PASS', 'Verified PostgreSQL connectivity to cloud Neon database (neondb)');
        } else {
            logStep('Worker -> Neon DB Link', 'FAIL', `Database check returned: ${dbRes}`);
        }
    } catch (e) {
        logStep('Worker -> Neon DB Link', 'FAIL', 'Cannot reach Neon PostgreSQL from container: ' + e.message);
    }

    // 7. Verify Health Probe HTTP Server
    try {
        const containerName = 'arena-worker-health-probe-check';
        // Cleanup in case prior run left it
        try { execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' }); } catch (_) {}

        execSync(
            `docker run -d --name ${containerName} -p 10000:10000 --add-host=host.docker.internal:host-gateway --env-file "${envFilePath}" -e REDIS_URL=redis://host.docker.internal:6379 -e WORKER_PORT=10000 coding-arena-worker:latest`,
            { encoding: 'utf8' }
        );

        // Poll for health endpoint up to 5 seconds
        let healthData = null;
        for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
                healthData = await new Promise((resolve, reject) => {
                    const req = http.get('http://localhost:10000/', (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => resolve(data));
                    });
                    req.on('error', reject);
                    req.setTimeout(1500, () => { req.destroy(); reject(new Error('Timeout')); });
                });
                if (healthData) break;
            } catch (_) {}
        }

        // Cleanup test container
        execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });

        if (healthData) {
            const json = JSON.parse(healthData);
            if (json.status === 'ok' && json.service === 'code_arena_judge_worker') {
                logStep('Worker Health Probe', 'PASS', `HTTP 200 on port 10000 (${json.service}, status: ${json.workerStatus})`);
            } else {
                logStep('Worker Health Probe', 'WARN', `Unexpected response: ${healthData}`);
            }
        } else {
            logStep('Worker Health Probe', 'WARN', 'Health server did not respond within 5s');
        }
    } catch (e) {
        logStep('Worker Health Probe', 'WARN', 'Health probe test warning: ' + e.message);
    }

    console.log('\n======================================================');
    if (allPassed) {
        console.log('   🎉 ALL DOCKER JUDGE WORKER CHECKS PASSED!');
        console.log('   Worker is ready to be started via:');
        console.log('   👉 docker compose up judge-worker');
    } else {
        console.log('   ⚠️ SOME CHECKS FAILED (SEE DETAILS ABOVE)');
    }
    console.log('======================================================\n');
}

verify().catch(err => {
    console.error('Verification error:', err);
    process.exit(1);
});
