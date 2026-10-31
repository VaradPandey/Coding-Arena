/**
 * Coding Arena — Automated Startup & Configuration Unit Test
 * 
 * Verifies that the local development configuration resolves correctly.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

function testLocalConfig() {
    console.log('Running testLocalConfig...');

    // 1. Verify backend/.env exists
    const backendEnvPath = path.resolve(__dirname, '../.env');
    assert(fs.existsSync(backendEnvPath), 'backend/.env should exist');

    // 2. Load config
    const config = require('../src/config');
    assert.strictEqual(config.mode, 'local', 'config.mode should be "local"');
    assert.strictEqual(config.port, 5000, 'config.port should default to 5000');
    assert(config.allowedOrigins.includes('http://localhost:5173'), 'allowedOrigins should include http://localhost:5173');
    assert(config.allowedOrigins.includes('http://127.0.0.1:5173'), 'allowedOrigins should include http://127.0.0.1:5173');
    assert(config.redisUrl.includes('localhost') || config.redisUrl.includes('127.0.0.1'), 'redisUrl should point to local Redis');

    // 3. Verify frontend/.env exists
    const frontendEnvPath = path.resolve(__dirname, '../../frontend/.env');
    assert(fs.existsSync(frontendEnvPath), 'frontend/.env should exist');

    // 4. Verify Prisma generated client exists
    const prismaClientPath = path.resolve(__dirname, '../src/generated/prisma');
    assert(fs.existsSync(prismaClientPath), 'backend/src/generated/prisma should exist');

    console.log('✅ testLocalConfig passed successfully!');
}

try {
    testLocalConfig();
} catch (err) {
    console.error('❌ testLocalConfig failed:', err.message);
    process.exit(1);
}

