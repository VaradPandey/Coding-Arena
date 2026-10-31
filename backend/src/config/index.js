const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 1. Try loading standard .env if present
const defaultEnvPath = path.resolve(__dirname, `../../.env`);
if (fs.existsSync(defaultEnvPath)) {
    dotenv.config({ path: defaultEnvPath });
}

// 2. Also support .env.production / .env.development override
const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : '.env.development';
const envPath = path.resolve(__dirname, `../../${envFile}`);
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const isProduction = process.env.NODE_ENV === 'production';

// Switchable Mode: 'local' (default for local dev) or 'prod' (cloud)
const rawMode = process.env.APP_MODE || process.env.MODE || (isProduction ? 'prod' : 'local');
const isProdMode = rawMode.toLowerCase() === 'prod' || rawMode.toLowerCase() === 'production';

// Dynamically select Redis, Database & CORS depending on mode
const cleanStr = (s) => (typeof s === 'string' ? s.trim().replace(/^["']|["']$/g, '') : s);
const redisUrl = cleanStr(isProdMode
    ? (process.env.PROD_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379')
    : (process.env.REDIS_URL || process.env.LOCAL_REDIS_URL || 'redis://localhost:6379'));

const databaseUrl = cleanStr(isProdMode
    ? (process.env.PROD_DATABASE_URL || process.env.DATABASE_URL)
    : (process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL));

const allowedOriginsRaw = isProdMode
    ? (process.env.PROD_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    : (process.env.LOCAL_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || 'http://localhost:5173');

const allowedOrigins = allowedOriginsRaw.split(',').map(o => o.trim()).filter(Boolean);

const judgeWorkerUrl = process.env.JUDGE_WORKER_URL
    || (isProdMode ? (process.env.PROD_JUDGE_WORKER_URL || 'https://codearena-judge-worker.onrender.com') : (process.env.LOCAL_JUDGE_WORKER_URL || ''));

const config = {
    mode: isProdMode ? 'prod' : 'local',
    isProduction,
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),
    databaseUrl,
    redisUrl,
    judgeWorkerUrl,
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret_for_dev_only_please_change',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    allowedOrigins
};

module.exports = config;