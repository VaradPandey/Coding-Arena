const config = require('../config');
const { Worker } = require('bullmq');
const pool = require('../config/db');
const judgeEngine = require('../judge/JudgeEngine');

// Setup Redis connection config based on current mode
const redisUrl = config.redisUrl;

const connection = new (require('ioredis'))(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        return Math.min(times * 150, 4000);
    }
});

connection.on('error', (err) => {
    console.warn("⚠️ Worker Redis connection notice:", err.message);
});

const { Emitter } = require('@socket.io/redis-emitter');
const ioEmitter = new Emitter(connection);
const matchService = require('../modules/matches/match.service');
const prisma = require('../config/prisma');

const LUA_UPDATE_SCORE = `
local roomStr = redis.call("GET", KEYS[1])
if not roomStr then return cjson.encode({error="NO_ROOM"}) end
local room = cjson.decode(roomStr)
if room.status == 'finished' then
    return cjson.encode({error="MATCH_FINISHED"})
end

local userId = ARGV[1]
local problemId = tostring(ARGV[2])
local verdict = ARGV[3]
local basePoints = tonumber(ARGV[4]) or 100

if not room.solved then room.solved = {} end
if not room.solved[userId] then room.solved[userId] = {} end
if not room.scores then room.scores = {} end
if not room.penalties then room.penalties = {} end
if not room.penalties[userId] then room.penalties[userId] = 0 end
if not room.attempts then room.attempts = {} end
if not room.attempts[userId] then room.attempts[userId] = {} end
if not room.attempts[userId][problemId] then room.attempts[userId][problemId] = 0 end

local alreadySolved = false
if room.solved[userId][problemId] == true then
    alreadySolved = true
end

local awarded = 0
local penaltyDeduction = 0

if not alreadySolved then
    if verdict == 'Accepted' then
        room.solved[userId][problemId] = true
        local failedAttempts = room.attempts[userId][problemId] or 0
        -- Time penalty on final score: 5 points deducted per failed attempt prior to Accepted (minimum 50 points)
        penaltyDeduction = failedAttempts * 5
        local earnedPoints = math.max(50, basePoints - penaltyDeduction)
        room.scores[userId] = (room.scores[userId] or 0) + earnedPoints
        awarded = earnedPoints
    else
        -- Incorrect submission prior to Accepted incurs a penalty
        room.attempts[userId][problemId] = room.attempts[userId][problemId] + 1
        room.penalties[userId] = room.penalties[userId] + 1
    end
end

-- Count unique solved problems for this user
local solvedCount = 0
for k, v in pairs(room.solved[userId]) do
    solvedCount = solvedCount + 1
end

local matchEnded = false
local winnerId = nil

-- Check if they solved all required problems
local totalRequired = tonumber(room.totalQuestions) or (room.problems and #room.problems) or 3
if solvedCount >= totalRequired then
    room.status = 'finished'
    room.winner = userId
    matchEnded = true
    winnerId = userId
end

-- Persist room state
local ttl = matchEnded and 10800 or 86400
redis.call("SET", KEYS[1], cjson.encode(room), "EX", ttl)

return cjson.encode({
    alreadySolved = alreadySolved,
    pointsAwarded = awarded,
    penaltyDeduction = penaltyDeduction,
    newTotalScore = room.scores[userId] or 0,
    solvedCount = solvedCount,
    penaltyCount = room.penalties[userId] or 0,
    penalties = room.penalties,
    attempts = room.attempts[userId] or {},
    matchEnded = matchEnded,
    winnerId = winnerId
})
`;

async function executeSubmissionJob(submission_id, problem_id, language, user_id) {
    console.log(`[Worker] Processing submission ${submission_id} for problem ${problem_id} (Language: ${language})`);

    try {
        // Mark as running
        await pool.query(`
            UPDATE submissions 
            SET status = 'running', started_at = NOW() 
            WHERE id = $1
        `, [submission_id]);

        // 3. Process the submission using the real Judge Engine
        const { verdict, executionTimeMs } = await judgeEngine.run(submission_id);

        // 4. Update status to completed with verdict and metrics
        await pool.query(`
            UPDATE submissions 
            SET status = 'completed', 
                verdict = $1, 
                finished_at = NOW(),
                execution_time_ms = $2
            WHERE id = $3
        `, [verdict, executionTimeMs, submission_id]);

        console.log(`[Worker] Sub ${submission_id} completed | Verdict: ${verdict} | Time: ${executionTimeMs}ms`);

        // 5. Update UserProblemStatus and problemsSolved in DB
        if (user_id) {
            try {
                const numericProblemId = BigInt(problem_id);
                const isAccepted = verdict === 'Accepted';

                const existingStatus = await prisma.userProblemStatus.findUnique({
                    where: {
                        userId_problemId: {
                            userId: user_id,
                            problemId: numericProblemId
                        }
                    }
                });

                if (!existingStatus) {
                    await prisma.userProblemStatus.create({
                        data: {
                            userId: user_id,
                            problemId: numericProblemId,
                            status: verdict,
                            bestRuntime: executionTimeMs,
                            firstSolvedAt: isAccepted ? new Date() : null,
                            lastSubmissionAt: new Date()
                        }
                    });
                } else {
                    const wasAccepted = existingStatus.status === 'Accepted';
                    const newStatus = wasAccepted ? 'Accepted' : verdict;
                    const bestRuntime = isAccepted
                        ? (existingStatus.bestRuntime ? Math.min(existingStatus.bestRuntime, executionTimeMs) : executionTimeMs)
                        : existingStatus.bestRuntime;

                    await prisma.userProblemStatus.update({
                        where: {
                            userId_problemId: {
                                userId: user_id,
                                problemId: numericProblemId
                            }
                        },
                        data: {
                            status: newStatus,
                            bestRuntime,
                            firstSolvedAt: wasAccepted ? existingStatus.firstSolvedAt : (isAccepted ? new Date() : null),
                            lastSubmissionAt: new Date()
                        }
                    });
                }

                // Sync accurate count of distinct solved problems
                if (isAccepted) {
                    const count = await prisma.userProblemStatus.count({
                        where: { userId: user_id, status: 'Accepted' }
                    });
                    await prisma.user.update({
                        where: { id: user_id },
                        data: { problemsSolved: count }
                    });
                }
            } catch (err) {
                console.error('[Worker] Error updating UserProblemStatus:', err);
            }
        }

        // 6. Broadcast to Socket Room if part of a contest
        if (user_id) {
            try {
                const roomId = await connection.get(`matchmaking:player:${user_id}`);
                if (roomId) {
                    const resultStr = await connection.eval(
                        LUA_UPDATE_SCORE, 
                        1, 
                        roomId, 
                        user_id, 
                        problem_id, 
                        verdict,
                        100
                    );
                    
                    if (resultStr) {
                        const result = JSON.parse(resultStr);
                        if (!result.error) {
                            ioEmitter.to(roomId).emit('SCORE_UPDATED', {
                                userId: user_id,
                                problemId: problem_id,
                                verdict,
                                pointsAwarded: result.pointsAwarded,
                                penaltyDeduction: result.penaltyDeduction || 0,
                                newTotalScore: result.newTotalScore,
                                penaltyCount: result.penaltyCount || 0,
                                penalties: result.penalties || {},
                                attempts: result.attempts || {}
                            });

                            if (result.matchEnded) {
                                try {
                                    const finalResult = await matchService.finalizeMatch(roomId, result.winnerId, 'ALL_PROBLEMS_SOLVED');
                                    if (finalResult) {
                                        ioEmitter.to(roomId).emit('MATCH_FINISHED', finalResult);
                                    }
                                } catch (err) {
                                    console.error('Error during early match finalization:', err);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('[Worker] Error broadcasting match score:', err.message);
            }
        }

    } catch (error) {
        console.error(`[Worker] Failed to process submission ${submission_id}:`, error);
        await pool.query(`
            UPDATE submissions 
            SET status = 'completed', 
                verdict = 'Internal Error', 
                finished_at = NOW(),
                execution_time_ms = 0
            WHERE id = $1
        `, [submission_id]);
    }
}

// 1. Primary BullMQ Worker (uses main connected Redis instance)
const worker = new Worker('judge', async (job) => {
    const { submission_id, problem_id, language, user_id } = job.data;
    await executeSubmissionJob(submission_id, problem_id, language, user_id);
}, { connection });

worker.on('ready', () => {
    console.log("[WORKER] Redis Connected");
    console.log("[WORKER] BullMQ Connected");
    console.log("[WORKER] Listening for Jobs");
});

worker.on('error', (err) => {
    console.warn("⚠️ Judge Worker BullMQ warning:", err.message);
});

// 2. Autonomous Database Reconciliation: sweeps queued submissions left behind while sleeping
let isReconciling = false;
async function reconcilePendingSubmissions() {
    if (isReconciling) return;
    isReconciling = true;
    try {
        const { rows } = await pool.query(`
            SELECT id, problem_id, language, user_id 
            FROM submissions 
            WHERE status = 'queued'
            ORDER BY id ASC
            LIMIT 5
        `);
        for (const row of rows) {
            console.log(`[Reconciler] Found queued submission #${row.id}, judging now...`);
            await executeSubmissionJob(row.id, row.problem_id, row.language, row.user_id);
        }
    } catch (err) {
        console.error('[Reconciler] Error checking queued submissions:', err.message);
    } finally {
        isReconciling = false;
    }
}

// Run reconciliation immediately on startup and every 8 seconds
setTimeout(reconcilePendingSubmissions, 1000);
setInterval(reconcilePendingSubmissions, 8000);

// Render Web Service Health Check & Synchronous Sample Runner Server
const http = require('http');
const runEngine = require('../judge/RunEngine');
const isProd = process.env.NODE_ENV === 'production';
const WORKER_HTTP_PORT = process.env.WORKER_PORT || (isProd ? (process.env.PORT || 10000) : null);

let healthServer = null;
if (WORKER_HTTP_PORT) {
    healthServer = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

        if (req.method === 'POST' && pathname === '/run') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
                if (body.length > 512 * 1024) {
                    req.destroy();
                }
            });
            req.on('end', async () => {
                try {
                    const { problem_id, language, source_code } = JSON.parse(body);
                    const result = await runEngine.run(problem_id, language, source_code);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (err) {
                    console.error('[Worker HTTP] Run error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message || 'Execution error' }));
                }
            });
            return;
        }

        // Trigger immediate DB sweep on any health check or wake-up ping from the API
        setImmediate(reconcilePendingSubmissions);

        res.writeHead(200, { 
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'code_arena_judge_worker',
            workerStatus: 'listening',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        }));
    });

    healthServer.listen(WORKER_HTTP_PORT, () => {
        console.log(`[WORKER] Health check & runner HTTP server listening on port ${WORKER_HTTP_PORT}`);
    });
}

async function gracefulShutdown() {
    console.log('\n[WORKER] Initiating graceful shutdown...');
    try {
        if (healthServer) {
            console.log('[WORKER] Closing HTTP health server');
            healthServer.close();
        }

        console.log('[WORKER] 1. Closing BullMQ Worker (waiting for active jobs)');
        await worker.close();

        console.log('[WORKER] 2. Disconnecting Redis');
        await connection.quit();

        console.log('[WORKER] 3. Disconnecting Database');
        await pool.end();

        console.log('[WORKER] Shutdown complete.');
        process.exit(0);
    } catch (err) {
        console.error('[WORKER] Error during shutdown:', err);
        process.exit(1);
    }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
