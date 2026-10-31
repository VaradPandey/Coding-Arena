const { redisClient } = require('../../redis/client');
const roomService = require('../rooms/room.service');

const QUEUE_KEY = 'matchmaking:queue';
const QUEUED_USERS_SET = 'matchmaking:queued_users';

class MatchmakingService {
    getQueueKey(mode = 'ranked') {
        const normalized = mode === 'toss' ? 'toss' : 'ranked';
        return `matchmaking:queue:${normalized}`;
    }

    /**
     * Joins the matchmaking queue.
     * Safely updates socketId and metadata without throwing if player was already recorded.
     */
    async joinQueue(userId, socketId, username, rating, attemptId, mode = 'ranked') {
        const validMode = mode === 'toss' ? 'toss' : 'ranked';
        const queueKey = this.getQueueKey(validMode);

        // Remove any existing entries for this user across all queues to prevent duplicates
        await redisClient.lrem('matchmaking:queue:ranked', 0, userId);
        await redisClient.lrem('matchmaking:queue:toss', 0, userId);
        await redisClient.lrem('matchmaking:queue', 0, userId);

        // Add to queue list and tracking set
        const multi = redisClient.multi();
        multi.rpush(queueKey, userId);
        multi.sadd(QUEUED_USERS_SET, userId);
        
        // Save player metadata for matchmaking
        multi.set(`matchmaking:player:${userId}`, JSON.stringify({
            socketId,
            username: username || 'Player',
            joinedAt: new Date().toISOString(),
            rating: rating ?? 0,
            attemptId,
            mode: validMode
        }), 'EX', 3600); // expire in 1 hour if stuck

        await multi.exec();
    }

    /**
     * Leaves the matchmaking queue.
     * If expectedSocketId is provided (e.g. from socket disconnect),
     * only remove if current queued socket matches, preventing stale disconnects
     * from tearing down an active reconnected queue entry.
     */
    async leaveQueue(userId, expectedSocketId = null) {
        if (expectedSocketId) {
            const metaStr = await redisClient.get(`matchmaking:player:${userId}`);
            if (metaStr) {
                try {
                    const meta = JSON.parse(metaStr);
                    if (meta.socketId && meta.socketId !== expectedSocketId) {
                        // User has reconnected with a newer socket; ignore old socket's disconnect
                        return;
                    }
                } catch (e) {
                    // Ignore JSON parse error and proceed
                }
            }
        }

        const multi = redisClient.multi();
        multi.lrem('matchmaking:queue:ranked', 0, userId);
        multi.lrem('matchmaking:queue:toss', 0, userId);
        multi.lrem('matchmaking:queue', 0, userId);
        multi.srem(QUEUED_USERS_SET, userId);
        multi.del(`matchmaking:player:${userId}`);
        
        await multi.exec();
    }

    /**
     * Attempts to find a match if enough players are in the queue.
     * Validates active connections and filters out duplicates / ghost players.
     */
    async attemptMatch(io) {
        const modes = ['ranked', 'toss'];

        for (const mode of modes) {
            const queueKey = this.getQueueKey(mode);

            while (true) {
                const queueLength = await redisClient.llen(queueKey);
                if (queueLength < 2) break;

                // Pop player 1
                const player1Id = await redisClient.lpop(queueKey);
                if (!player1Id) break;

                // Find distinct player 2
                let player2Id = null;
                while (true) {
                    const candidateId = await redisClient.lpop(queueKey);
                    if (!candidateId) break;

                    if (candidateId === player1Id) {
                        // Discard duplicate queue entry of the same user
                        continue;
                    }

                    player2Id = candidateId;
                    break;
                }

                if (!player2Id) {
                    // Only one unique player in queue, put player 1 back at front
                    await redisClient.lpush(queueKey, player1Id);
                    break;
                }

                // Check metadata
                const p1MetaStr = await redisClient.get(`matchmaking:player:${player1Id}`);
                const p2MetaStr = await redisClient.get(`matchmaking:player:${player2Id}`);

                // If player1 has no metadata, evict player1 and keep player2
                if (!p1MetaStr) {
                    await redisClient.srem(QUEUED_USERS_SET, player1Id);
                    await redisClient.lpush(queueKey, player2Id);
                    continue;
                }

                // If player2 has no metadata, evict player2 and keep player1
                if (!p2MetaStr) {
                    await redisClient.srem(QUEUED_USERS_SET, player2Id);
                    await redisClient.lpush(queueKey, player1Id);
                    continue;
                }

                const p1Meta = JSON.parse(p1MetaStr);
                const p2Meta = JSON.parse(p2MetaStr);

                // Verify both players are still connected to Socket.IO
                const p1Room = io.sockets.adapter.rooms.get(`user:${player1Id}`);
                const p2Room = io.sockets.adapter.rooms.get(`user:${player2Id}`);
                const p1Active = p1Room && p1Room.size > 0;
                const p2Active = p2Room && p2Room.size > 0;

                if (!p1Active) {
                    // Player 1 ghosted/disconnected; evict player 1 and return player 2 to queue
                    await redisClient.srem(QUEUED_USERS_SET, player1Id);
                    await redisClient.del(`matchmaking:player:${player1Id}`);
                    await redisClient.lpush(queueKey, player2Id);
                    continue;
                }

                if (!p2Active) {
                    // Player 2 ghosted/disconnected; evict player 2 and return player 1 to queue
                    await redisClient.srem(QUEUED_USERS_SET, player2Id);
                    await redisClient.del(`matchmaking:player:${player2Id}`);
                    await redisClient.lpush(queueKey, player1Id);
                    continue;
                }

                // Both players valid and connected: remove from tracking set
                await redisClient.srem(QUEUED_USERS_SET, player1Id, player2Id);
                await redisClient.del(`matchmaking:player:${player1Id}`, `matchmaking:player:${player2Id}`);

                try {
                    await roomService.createRoom(
                        io,
                        { id: player1Id, ...p1Meta },
                        { id: player2Id, ...p2Meta },
                        mode
                    );
                } catch (error) {
                    console.error(`Matchmaking room creation failed for mode ${mode}, re-queueing:`, error);
                    await this.joinQueue(player1Id, p1Meta.socketId, p1Meta.username, p1Meta.rating, p1Meta.attemptId, mode);
                    await this.joinQueue(player2Id, p2Meta.socketId, p2Meta.username, p2Meta.rating, p2Meta.attemptId, mode);
                    break;
                }
            }
        }
    }

    async getQueueStatus(mode = 'ranked') {
        const queueKey = this.getQueueKey(mode);
        const queueLength = await redisClient.llen(queueKey);
        return { queueLength, mode };
    }
}

module.exports = new MatchmakingService();
