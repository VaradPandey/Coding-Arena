/**
 * Coding Arena — Local Development Preflight Environment Validator
 * 
 * Run with: node scripts/preflightCheck.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function runPreflight() {
    console.log('\n======================================================');
    console.log('   🔍 CODING ARENA — LOCAL DEV PREFLIGHT CHECK');
    console.log('======================================================\n');

    let allPassed = true;
    const results = [];

    function record(name, status, message) {
        results.push({ name, status, message });
        const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
        console.log(`${icon} [${name.padEnd(20)}] ${message}`);
        if (status === 'FAIL') allPassed = false;
    }

    // 1. Node.js Version Check
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (majorVersion >= 20) {
        record('Node.js Version', 'PASS', `Running Node ${nodeVersion} (>= 20 required)`);
    } else {
        record('Node.js Version', 'FAIL', `Running Node ${nodeVersion}. Node 20 or higher is required.`);
    }

    // 2. Configuration & .env Check
    const envPath = path.resolve(__dirname, '../.env');
    let config = null;
    if (fs.existsSync(envPath)) {
        record('.env File', 'PASS', `Found backend/.env`);
        try {
            config = require('../src/config');
        } catch (e) {
            record('Config Loading', 'FAIL', `Failed to load config: ${e.message}`);
        }
    } else {
        record('.env File', 'WARN', `backend/.env not found (will fallback to defaults)`);
        try {
            config = require('../src/config');
        } catch (e) {
            record('Config Loading', 'FAIL', `Failed to load config: ${e.message}`);
        }
    }

    // 3. Prisma Generated Client Check
    const prismaClientPath = path.resolve(__dirname, '../src/generated/prisma');
    if (fs.existsSync(prismaClientPath)) {
        record('Prisma Client', 'PASS', `Generated client found in backend/src/generated/prisma`);
    } else {
        record('Prisma Client', 'FAIL', `Prisma client not generated. Run 'npx prisma generate' in backend/`);
    }

    // 4. Redis Connectivity Check
    const redisUrl = config?.redisUrl || process.env.LOCAL_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
    try {
        const Redis = require('ioredis');
        const redis = new Redis(redisUrl, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
        const pong = await redis.ping();
        if (pong === 'PONG') {
            record('Redis Connectivity', 'PASS', `Connected to Redis at ${redisUrl} (PONG)`);
        } else {
            record('Redis Connectivity', 'FAIL', `Unexpected Redis response: ${pong}`);
        }
        await redis.quit();
    } catch (err) {
        record('Redis Connectivity', 'FAIL', `Cannot connect to Redis at ${redisUrl}: ${err.message}`);
    }

    // 5. Database Connectivity Check
    const databaseUrl = config?.databaseUrl || process.env.DATABASE_URL;
    if (!databaseUrl || databaseUrl.includes('user:password@host:port')) {
        record('Database URL', 'WARN', `DATABASE_URL is not yet configured in backend/.env`);
    } else {
        try {
            const { Pool } = require('pg');
            const poolConfig = { connectionString: databaseUrl, connectionTimeoutMillis: 5000 };
            if (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')) {
                poolConfig.ssl = { rejectUnauthorized: false };
            }
            const pool = new Pool(poolConfig);
            const dbRes = await pool.query('SELECT NOW() as current_time, current_database() as db_name;');
            record('PostgreSQL DB', 'PASS', `Connected to database "${dbRes.rows[0].db_name}" (${dbRes.rows[0].current_time.toISOString()})`);
            await pool.end();
        } catch (err) {
            record('PostgreSQL DB', 'FAIL', `Cannot connect to PostgreSQL: ${err.message}`);
        }
    }

    // 6. C++ Compiler (g++) Host Check
    try {
        const gppVersion = execSync('g++ --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const firstLine = gppVersion.split('\n')[0].trim();
        record('g++ (Host Compiler)', 'PASS', `Host compiler available: ${firstLine}`);
    } catch (err) {
        record('g++ (Host Compiler)', 'WARN', `g++ not detected on host PATH. Worker must run via Docker container, or install MinGW.`);
    }

    // 7. Docker Engine Check
    try {
        const dockerInfo = execSync('docker --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        record('Docker Engine', 'PASS', `Docker available: ${dockerInfo.trim()}`);
    } catch (err) {
        record('Docker Engine', 'WARN', `Docker not detected on host PATH.`);
    }

    // 8. Frontend .env Check
    const frontendEnvPath = path.resolve(__dirname, '../../frontend/.env');
    if (fs.existsSync(frontendEnvPath)) {
        record('Frontend .env', 'PASS', `Found frontend/.env`);
    } else {
        record('Frontend .env', 'WARN', `frontend/.env not found (will fallback to default localhost:5000)`);
    }

    console.log('\n======================================================');
    if (allPassed) {
        console.log('   🎉 ALL ESSENTIAL CHECKS PASSED OR READY FOR CONFIG');
    } else {
        console.log('   ⚠️ SOME REQUIRED COMPONENTS NEED ACTION (SEE ABOVE)');
    }
    console.log('======================================================\n');
}

runPreflight().catch(err => {
    console.error('Preflight error:', err);
    process.exit(1);
});

