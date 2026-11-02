const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const config = require('../config');

const redisUrl = config.redisUrl;

if (!redisUrl) {
    console.error("FATAL ERROR: REDIS_URL environment variable is missing.");
    process.exit(1);
}

// Create an auto-reconnecting Redis connection for BullMQ producer
const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        return Math.min(times * 150, 4000);
    }
});

connection.on('error', (err) => {
    console.warn('⚠️ BullMQ Redis connection notice:', err.message);
});

// Create the BullMQ queue
const judgeQueue = new Queue('judge', { connection });

connection.ping().then(() => {
    console.log('✅ Successfully connected to Redis for BullMQ.');
}).catch(err => {
    console.warn('⚠️ Initial Redis ping pending/retrying:', err.message);
});

module.exports = { judgeQueue, connection };
