const { v4: uuidv4 } = require('uuid');
const { redisClient } = require('../../redis/client');
const prisma = require('../../config/prisma');
const { SERVER_EVENTS } = require('../../socket/events');
const matchService = require('../matches/match.service');

class RoomService {
    async createRoom(io, player1, player2, mode = 'ranked') {
        const roomId = `room:${uuidv4()}`;
        const isTossMode = mode === 'toss';

        let setup = null;
        let selectedProblems = [];
        let totalQuestions = 0;
        let durationSeconds = 0;
        let timePerQuestion = 0;
        let status = 'waiting';

        if (isTossMode) {
            // Toss Mode: 3 independent coin flips for topic, question count, and time per question
            const flipCoin = (p1Id, p2Id) => {
                const isHeads = Math.random() < 0.5;
                return {
                    winnerId: isHeads ? p1Id : p2Id,
                    outcome: isHeads ? 'HEADS' : 'TAILS',
                    p1Choice: 'HEADS',
                    p2Choice: 'TAILS'
                };
            };

            const coinFlips = {
                topic: flipCoin(player1.id, player2.id),
                questionCount: flipCoin(player1.id, player2.id),
                timePerQuestion: flipCoin(player1.id, player2.id)
            };

            const availableTopics = [
                { id: 'arrays', label: 'Arrays', description: 'Two pointers, sliding window, manipulation' },
                { id: 'strings', label: 'Strings', description: 'Parsing, substrings, palindromes' },
                { id: 'dynamic-programming', label: 'Dynamic Programming', description: 'Memoization, tabulation, subproblems' },
                { id: 'graphs', label: 'Graphs', description: 'BFS, DFS, shortest path' },
                { id: 'greedy', label: 'Greedy', description: 'Optimal choice, intervals, sorting' },
                { id: 'binary-search', label: 'Binary Search', description: 'Divide & conquer, search space' },
                { id: 'two-pointers', label: 'Two Pointers', description: 'Sorted arrays, pairs, fast & slow' },
                { id: 'stack-queue', label: 'Stack & Queue', description: 'Monotonic stack, FIFO/LIFO' },
                { id: 'linked-list', label: 'Linked List', description: 'Pointers, cycles, reversals' },
                { id: 'trees', label: 'Trees', description: 'Traversals, BST, depth' }
            ];

            setup = {
                coinFlips,
                rolls: coinFlips, // alias for backwards compatibility
                choices: {
                    topic: null,
                    questionCount: null,
                    timePerQuestion: null
                },
                availableTopics,
                availableQuestionCounts: [1, 2, 3],
                availableTimesPerQuestion: [10, 15, 20, 25, 30] // minutes
            };

            status = 'setup';
        } else {
            // Ranked Battle: 1 random question by default with 20 minutes solving time
            const allProblems = await prisma.problems.findMany({
                select: { id: true, title: true, difficulty: true },
                take: 50
            });
            const randomProblem = allProblems[Math.floor(Math.random() * allProblems.length)];
            if (randomProblem) {
                selectedProblems = [{
                    id: randomProblem.id.toString(),
                    title: randomProblem.title,
                    difficulty: randomProblem.difficulty
                }];
            }
            totalQuestions = 1;
            timePerQuestion = 20;
            durationSeconds = 20 * 60; // 20 minutes = 1200 seconds
            status = 'countdown';
        }

        // Fetch up-to-date user details from DB to guarantee live username and Elo rating
        const playerIds = [player1.id, player2.id].filter(Boolean);
        let p1Username = player1.username;
        let p1Rating = player1.rating;
        let p1Avatar = player1.avatar;
        let p2Username = player2.username;
        let p2Rating = player2.rating;
        let p2Avatar = player2.avatar;

        try {
            const dbUsers = await prisma.user.findMany({
                where: { id: { in: playerIds } },
                select: { id: true, username: true, rating: true, avatar: true }
            });
            const p1Db = dbUsers.find(u => u.id === player1.id);
            if (p1Db) {
                p1Username = p1Db.username || p1Username;
                p1Rating = p1Db.rating ?? p1Rating;
                p1Avatar = p1Db.avatar || p1Avatar;
            }
            const p2Db = dbUsers.find(u => u.id === player2.id);
            if (p2Db) {
                p2Username = p2Db.username || p2Username;
                p2Rating = p2Db.rating ?? p2Rating;
                p2Avatar = p2Db.avatar || p2Avatar;
            }
        } catch (dbErr) {
            console.error('Failed to fetch user profiles for room creation, using queued metadata:', dbErr);
        }

        p1Username = p1Username || 'Player 1';
        p1Rating = p1Rating ?? 0;
        p2Username = p2Username || 'Player 2';
        p2Rating = p2Rating ?? 0;

        const roomState = {
            roomId,
            mode: isTossMode ? 'toss' : 'ranked',
            players: {
                [player1.id]: { id: player1.id, username: p1Username, rating: p1Rating, avatar: p1Avatar, ready: false, disconnected: false },
                [player2.id]: { id: player2.id, username: p2Username, rating: p2Rating, avatar: p2Avatar, ready: false, disconnected: false }
            },
            setup,
            problems: selectedProblems,
            totalQuestions,
            durationSeconds,
            timePerQuestion,
            scores: {
                [player1.id]: 0,
                [player2.id]: 0
            },
            penalties: {
                [player1.id]: 0,
                [player2.id]: 0
            },
            attempts: {
                [player1.id]: {},
                [player2.id]: {}
            },
            solved: {
                [player1.id]: {},
                [player2.id]: {}
            },

            status,
            startedAt: null,
            endsAt: null,
            winner: null
        };

        // Create Match in DB first
        try {
            await matchService.createMatch(roomId, player1.id, player2.id);
        } catch (error) {
            console.error("Failed to create match in database:", error);
            if (player1.socketId) io.to(player1.socketId).emit('ERROR', { message: "Failed to initialize match" });
            if (player2.socketId) io.to(player2.socketId).emit('ERROR', { message: "Failed to initialize match" });
            return;
        }

        // Save to Redis
        const multi = redisClient.multi();
        multi.set(roomId, JSON.stringify(roomState), 'EX', 10800); // 3 hr expire
        multi.set(`matchmaking:player:${player1.id}`, roomId, 'EX', 10800);
        multi.set(`matchmaking:player:${player2.id}`, roomId, 'EX', 10800);
        await multi.exec();

        // Update presence for both players to in_match
        const presenceService = require('../presence/presence.service');
        try {
            await Promise.all([
                presenceService.updateStatus(player1.id, 'in_match', roomId),
                presenceService.updateStatus(player2.id, 'in_match', roomId)
            ]);
        } catch (presErr) {
            console.error('Failed to update presence in createRoom:', presErr);
        }

        // Pre-emptively trigger judge worker wake-up so it's warm before players submit code
        const judgeWorkerPingService = require('../../services/judgeWorkerPingService');
        judgeWorkerPingService.wakeUpWorker('ranked_match_created');

        // Broadcast MATCH_FOUND and ROOM_CREATED to specific sockets and user rooms
        const roomPayload = roomState;

        const p1Target = io.to(`user:${player1.id}`);
        if (player1.socketId) p1Target.to(player1.socketId);
        p1Target.emit(SERVER_EVENTS.MATCH_FOUND, {
            roomId,
            attemptId: player1.attemptId,
            opponent: { id: player2.id, username: p2Username, rating: p2Rating, avatar: p2Avatar },
            mode: roomState.mode
        });
        p1Target.emit(SERVER_EVENTS.ROOM_CREATED, { ...roomPayload, attemptId: player1.attemptId });
        if (isTossMode) {
            p1Target.emit(SERVER_EVENTS.MATCH_SETUP_STARTED, { roomId, setup: roomPayload.setup });
        }

        const p2Target = io.to(`user:${player2.id}`);
        if (player2.socketId) p2Target.to(player2.socketId);
        p2Target.emit(SERVER_EVENTS.MATCH_FOUND, {
            roomId,
            attemptId: player2.attemptId,
            opponent: { id: player1.id, username: p1Username, rating: p1Rating, avatar: p1Avatar },
            mode: roomState.mode
        });
        p2Target.emit(SERVER_EVENTS.ROOM_CREATED, { ...roomPayload, attemptId: player2.attemptId });
        if (isTossMode) {
            p2Target.emit(SERVER_EVENTS.MATCH_SETUP_STARTED, { roomId, setup: roomPayload.setup });
        }

        // If Ranked mode, immediately kick off countdown to match start
        if (!isTossMode) {
            setTimeout(() => {
                io.to(roomId).emit(SERVER_EVENTS.COUNTDOWN_STARTED, { startsInSeconds: 5 });

                setTimeout(async () => {
                    const refreshedRoomStr = await redisClient.get(roomId);
                    if (!refreshedRoomStr) return;
                    const refreshedRoom = JSON.parse(refreshedRoomStr);

                    if (refreshedRoom.status === 'finished') return;

                    refreshedRoom.status = 'running';
                    refreshedRoom.startedAt = new Date().toISOString();
                    refreshedRoom.endsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

                    await redisClient.set(roomId, JSON.stringify(refreshedRoom), 'EX', 86400);

                    io.to(roomId).emit(SERVER_EVENTS.CONTEST_STARTED, {
                        startedAt: refreshedRoom.startedAt,
                        durationSeconds,
                        endsAt: refreshedRoom.endsAt,
                        problems: refreshedRoom.problems
                    });

                    // Timeout finalizer after 20 minutes
                    setTimeout(async () => {
                        try {
                            const finalResult = await matchService.finalizeMatch(roomId, null, 'TIME_EXPIRED');
                            if (finalResult) {
                                io.to(roomId).emit(SERVER_EVENTS.MATCH_FINISHED, finalResult);
                            }
                        } catch (err) {
                            console.error('Error during timeout match finalization:', err);
                        }
                    }, durationSeconds * 1000);

                }, 5000);
            }, 1000);
        }
    }

    async handlePlayerJoinRoom(socket, roomId) {
        socket.join(roomId);
        const roomData = await redisClient.get(roomId);
        let room = null;
        if (roomData) {
            room = JSON.parse(roomData);
        }

        socket.emit(SERVER_EVENTS.ROOM_JOINED, { roomId, room });

        // If the room is finished or not in Redis (expired), try to send historical result
        if (!room || room.status === 'finished') {
            const prisma = require('../../config/prisma');
            const match = await prisma.match.findUnique({ where: { roomId } });
            if (match) {
                const finalResult = {
                    roomId,
                    winnerId: match.winnerId,
                    loserId: match.loserId,
                    reason: match.finishReason,
                    result: match.winnerId === null ? 'DRAW' : 'WIN',
                    finalScores: {
                        [match.player1Id]: match.p1Score,
                        [match.player2Id]: match.p2Score
                    },
                    ratings: {
                        [match.player1Id]: { old: match.p1OldRating, new: match.p1NewRating, diff: (match.p1NewRating || 0) - (match.p1OldRating || 0) },
                        [match.player2Id]: { old: match.p2OldRating, new: match.p2NewRating, diff: (match.p2NewRating || 0) - (match.p2OldRating || 0) }
                    }
                };
                // Reconstruct a dummy room if it was fully expired from Redis
                if (!room) {
                    socket.emit(SERVER_EVENTS.ROOM_JOINED, { 
                        roomId, 
                        room: { status: 'finished', scores: finalResult.finalScores, players: {} } 
                    });
                }
                socket.emit(SERVER_EVENTS.MATCH_FINISHED, finalResult);
            }
        }
    }

    async handlePlayerReady(io, socket, roomId) {
        const roomData = await redisClient.get(roomId);
        if (!roomData) return;

        const room = JSON.parse(roomData);
        if (room.players[socket.user.id]) {
            room.players[socket.user.id].ready = true;
        }

        const allReady = Object.values(room.players).every(p => p.ready);
        
        if (allReady && room.status === 'waiting') {
            room.status = 'countdown';
            // Update Redis
            await redisClient.set(roomId, JSON.stringify(room), 'EX', 86400);
            
            // Broadcast countdown
            io.to(roomId).emit(SERVER_EVENTS.COUNTDOWN_STARTED, { startsInSeconds: 10 });
            
            // Start contest timer
            setTimeout(async () => {
                const refreshedRoomStr = await redisClient.get(roomId);
                if (!refreshedRoomStr) return;
                const refreshedRoom = JSON.parse(refreshedRoomStr);
                
                refreshedRoom.status = 'running';
                refreshedRoom.startedAt = new Date().toISOString();
                
                const durationSeconds = 3600;
                refreshedRoom.endsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
                
                await redisClient.set(roomId, JSON.stringify(refreshedRoom), 'EX', 86400);
                
                io.to(roomId).emit(SERVER_EVENTS.CONTEST_STARTED, {
                    startedAt: refreshedRoom.startedAt,
                    durationSeconds
                });
                
                // End timer
                setTimeout(async () => {
                    try {
                        const finalResult = await matchService.finalizeMatch(roomId, null, 'TIME_EXPIRED');
                        if (finalResult) {
                            io.to(roomId).emit(SERVER_EVENTS.MATCH_FINISHED, finalResult);
                        }
                    } catch (err) {
                        console.error('Error during timeout match finalization:', err);
                    }
                }, durationSeconds * 1000);

            }, 10000);
        } else {
            await redisClient.set(roomId, JSON.stringify(room), 'EX', 86400);
        }
    }

    async handleChooseSetting(io, socket, payload) {
        const { roomId, setting, value } = payload || {};
        if (!roomId || !setting || value === undefined || value === null) return;

        const roomData = await redisClient.get(roomId);
        if (!roomData) return;

        const room = JSON.parse(roomData);
        if (room.status !== 'setup') return;

        const userId = socket.user.id;
        const rollInfo = room.setup?.rolls?.[setting];
        if (!rollInfo) return;

        if (rollInfo.winnerId !== userId) {
            socket.emit(SERVER_EVENTS.ERROR, { message: "You did not win the roll to choose this setting." });
            return;
        }

        if (setting === 'topic') {
            const validTopic = room.setup.availableTopics.some(t => t.id === value);
            if (!validTopic) {
                socket.emit(SERVER_EVENTS.ERROR, { message: "Invalid topic chosen." });
                return;
            }
            room.setup.choices.topic = value;
        } else if (setting === 'questionCount') {
            const count = parseInt(value, 10);
            if (![1, 2, 3].includes(count)) {
                socket.emit(SERVER_EVENTS.ERROR, { message: "Invalid question count." });
                return;
            }
            room.setup.choices.questionCount = count;
        } else if (setting === 'timePerQuestion') {
            const time = parseInt(value, 10);
            if (![10, 15, 20, 25, 30].includes(time)) {
                socket.emit(SERVER_EVENTS.ERROR, { message: "Invalid time per question." });
                return;
            }
            room.setup.choices.timePerQuestion = time;
        }

        await redisClient.set(roomId, JSON.stringify(room), 'EX', 10800);

        // Broadcast setting chosen
        io.to(roomId).emit(SERVER_EVENTS.MATCH_SETTING_CHOSEN, {
            setting,
            value: room.setup.choices[setting],
            chosenBy: userId,
            choices: room.setup.choices
        });

        // If all 3 settings chosen, finalize and start countdown
        const { topic, questionCount, timePerQuestion } = room.setup.choices;
        if (topic && questionCount && timePerQuestion) {
            await this.finalizeSetupAndStartCountdown(io, roomId, room);
        }
    }

    async finalizeSetupAndStartCountdown(io, roomId, room) {
        const { topic, questionCount, timePerQuestion } = room.setup.choices;

        // Query problems for chosen topic
        const matchingProblems = await prisma.problems.findMany({
            where: { tags: { has: topic } },
            select: { id: true, title: true, difficulty: true }
        });

        const shuffled = matchingProblems.sort(() => 0.5 - Math.random());
        let selected = shuffled.slice(0, questionCount);

        // If fewer problems than questionCount, backfill from other problems
        if (selected.length < questionCount) {
            const existingIds = selected.map(p => p.id);
            const backfill = await prisma.problems.findMany({
                where: { id: { notIn: existingIds } },
                select: { id: true, title: true, difficulty: true },
                take: questionCount - selected.length
            });
            selected = selected.concat(backfill);
        }

        room.problems = selected.map(p => ({
            id: p.id.toString(),
            title: p.title,
            difficulty: p.difficulty
        }));
        room.totalQuestions = room.problems.length;
        room.timePerQuestion = timePerQuestion;

        const durationSeconds = room.totalQuestions * timePerQuestion * 60;
        room.durationSeconds = durationSeconds;
        room.status = 'countdown';

        await redisClient.set(roomId, JSON.stringify(room), 'EX', 86400);

        io.to(roomId).emit(SERVER_EVENTS.MATCH_SETUP_COMPLETED, {
            problems: room.problems,
            totalQuestions: room.totalQuestions,
            durationSeconds,
            setup: room.setup
        });

        io.to(roomId).emit(SERVER_EVENTS.COUNTDOWN_STARTED, { startsInSeconds: 5 });

        setTimeout(async () => {
            const refreshedRoomStr = await redisClient.get(roomId);
            if (!refreshedRoomStr) return;
            const refreshedRoom = JSON.parse(refreshedRoomStr);

            refreshedRoom.status = 'running';
            refreshedRoom.startedAt = new Date().toISOString();
            refreshedRoom.endsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

            await redisClient.set(roomId, JSON.stringify(refreshedRoom), 'EX', 86400);

            io.to(roomId).emit(SERVER_EVENTS.CONTEST_STARTED, {
                startedAt: refreshedRoom.startedAt,
                durationSeconds,
                endsAt: refreshedRoom.endsAt,
                problems: refreshedRoom.problems
            });

            setTimeout(async () => {
                try {
                    const finalResult = await matchService.finalizeMatch(roomId, null, 'TIME_EXPIRED');
                    if (finalResult) {
                        io.to(roomId).emit(SERVER_EVENTS.MATCH_FINISHED, finalResult);
                    }
                } catch (err) {
                    console.error('Error during timeout match finalization:', err);
                }
            }, durationSeconds * 1000);

        }, 5000);
    }

    async handleBailOut(io, socket, roomId) {
        if (!roomId) return;
        const roomData = await redisClient.get(roomId);
        if (!roomData) return;

        const room = JSON.parse(roomData);
        if (room.status === 'finished') return;

        const bailedUserId = socket.user.id;
        const playerIds = Object.keys(room.players || {});
        const opponentId = playerIds.find(id => String(id) !== String(bailedUserId));

        const presenceService = require('../presence/presence.service');

        // Always clean up both players' active matchmaking room mapping and presence in Redis
        try {
            await Promise.all([
                redisClient.del(`matchmaking:player:${bailedUserId}`),
                opponentId ? redisClient.del(`matchmaking:player:${opponentId}`) : Promise.resolve(),
                presenceService.updateStatus(bailedUserId, 'online', ''),
                opponentId ? presenceService.updateStatus(opponentId, 'online', '') : Promise.resolve()
            ]);
        } catch (cleanupErr) {
            console.error('Error during bail out presence/mapping cleanup:', cleanupErr);
        }

        // If the match hasn't started yet (waiting for opponent) or no opponent exists
        if (room.status === 'waiting' || !opponentId) {
            room.status = 'finished';
            room.finishReason = 'CANCELLED';
            await redisClient.set(roomId, JSON.stringify(room), 'EX', 3600);

            const cancelResult = {
                roomId,
                winnerId: null,
                loserId: bailedUserId,
                reason: 'CANCELLED',
                result: 'CANCELLED',
                finalScores: room.scores || {},
                penalties: room.penalties || {}
            };
            io.to(roomId).emit(SERVER_EVENTS.MATCH_FINISHED, cancelResult);
            socket.emit(SERVER_EVENTS.MATCH_FINISHED, cancelResult);
            io.to(`user:${bailedUserId}`).emit(SERVER_EVENTS.MATCH_FINISHED, cancelResult);
            if (opponentId) {
                io.to(`user:${opponentId}`).emit(SERVER_EVENTS.MATCH_FINISHED, cancelResult);
            }
            return;
        }

        // Active match: countdown, setup, or running — forfeit to opponent
        room.status = 'finished';
        room.winner = opponentId;
        room.finishReason = 'FORFEIT';
        await redisClient.set(roomId, JSON.stringify(room), 'EX', 10800);

        let finalResult = null;
        try {
            finalResult = await matchService.finalizeMatch(roomId, opponentId, 'FORFEIT');
        } catch (error) {
            console.error('Error during bail out match finalization:', error);
        }

        const fallbackResult = {
            roomId,
            winnerId: opponentId,
            loserId: bailedUserId,
            reason: 'FORFEIT',
            result: 'LOSS',
            finalScores: room.scores || {},
            penalties: room.penalties || {}
        };

        const resultToSend = finalResult || fallbackResult;
        io.to(roomId).emit(SERVER_EVENTS.MATCH_FINISHED, resultToSend);
        socket.emit(SERVER_EVENTS.MATCH_FINISHED, resultToSend);
        io.to(`user:${bailedUserId}`).emit(SERVER_EVENTS.MATCH_FINISHED, resultToSend);
        if (opponentId) {
            io.to(`user:${opponentId}`).emit(SERVER_EVENTS.MATCH_FINISHED, resultToSend);
        }
    }

    async handleReconnect(io, socket, userId) {
        const roomId = await redisClient.get(`matchmaking:player:${userId}`);
        if (!roomId) return; // Not in a room

        const roomData = await redisClient.get(roomId);
        if (!roomData) return;

        const room = JSON.parse(roomData);
        if (room.status === 'finished') {
            // Defensive cleanup: if the room is finished but mapping exists, delete it.
            // Do not resurrect or auto-reconnect to a finished match.
            await redisClient.del(`matchmaking:player:${userId}`);
            return;
        }

        if (room.players[userId]) {
            room.players[userId].disconnected = false;
            await redisClient.set(roomId, JSON.stringify(room), 'EX', 10800);
            
            // Forcefully rejoin the socket to the room so it receives SCORE_UPDATED events
            socket.join(roomId);
            
            // Broadcast reconnect event
            io.to(roomId).emit(SERVER_EVENTS.PLAYER_RECONNECTED, { userId });
        }
    }

    async handleDisconnect(io, userId) {
        const roomId = await redisClient.get(`matchmaking:player:${userId}`);
        if (!roomId) return; // Not in a room

        const roomData = await redisClient.get(roomId);
        if (!roomData) return;

        const room = JSON.parse(roomData);
        if (room.players[userId]) {
            room.players[userId].disconnected = true;
            await redisClient.set(roomId, JSON.stringify(room), 'EX', 10800);
            
            // Broadcast disconnect event
            io.to(roomId).emit(SERVER_EVENTS.PLAYER_DISCONNECTED, { userId });
        }
    }

    async createCustomRoom(io, player1, player2, customConfig) {
        const roomId = `room:${uuidv4()}`;
        const { isRanked = false, selectedProblems = [], durationSeconds = 900, timePerQuestion = 15 } = customConfig || {};

        // Fetch up-to-date user details from DB
        const playerIds = [player1.id, player2.id].filter(Boolean);
        let p1Username = player1.username;
        let p1Rating = player1.rating;
        let p1Avatar = player1.avatar;
        let p2Username = player2.username;
        let p2Rating = player2.rating;
        let p2Avatar = player2.avatar;

        try {
            const dbUsers = await prisma.user.findMany({
                where: { id: { in: playerIds } },
                select: { id: true, username: true, rating: true, avatar: true }
            });
            const p1Db = dbUsers.find(u => u.id === player1.id);
            if (p1Db) {
                p1Username = p1Db.username || p1Username;
                p1Rating = p1Db.rating ?? p1Rating;
                p1Avatar = p1Db.avatar || p1Avatar;
            }
            const p2Db = dbUsers.find(u => u.id === player2.id);
            if (p2Db) {
                p2Username = p2Db.username || p2Username;
                p2Rating = p2Db.rating ?? p2Rating;
                p2Avatar = p2Db.avatar || p2Avatar;
            }
        } catch (dbErr) {
            console.error('Failed to fetch user profiles for custom room, using lobby metadata:', dbErr);
        }

        const roomState = {
            roomId,
            mode: isRanked ? 'ranked' : 'casual',
            players: {
                [player1.id]: { id: player1.id, username: p1Username, rating: p1Rating, avatar: p1Avatar, ready: false, disconnected: false },
                [player2.id]: { id: player2.id, username: p2Username, rating: p2Rating, avatar: p2Avatar, ready: false, disconnected: false }
            },
            setup: null,
            problems: selectedProblems,
            totalQuestions: selectedProblems.length,
            durationSeconds,
            timePerQuestion,
            scores: {
                [player1.id]: 0,
                [player2.id]: 0
            },
            penalties: {
                [player1.id]: 0,
                [player2.id]: 0
            },
            attempts: {
                [player1.id]: {},
                [player2.id]: {}
            },
            solved: {
                [player1.id]: {},
                [player2.id]: {}
            },
            status: 'countdown',
            startedAt: null,
            endsAt: null,
            winner: null
        };

        // Create match in DB
        try {
            await matchService.createMatch(roomId, player1.id, player2.id);
        } catch (error) {
            console.error('Failed to create custom match in database:', error);
        }

        // Update presence for both players to in_match
        const presenceService = require('../presence/presence.service');
        try {
            await Promise.all([
                presenceService.updateStatus(player1.id, 'in_match', roomId),
                presenceService.updateStatus(player2.id, 'in_match', roomId)
            ]);
        } catch (presErr) {
            console.error('Failed to update presence in createCustomRoom:', presErr);
        }

        // Save to Redis
        const multi = redisClient.multi();
        multi.set(roomId, JSON.stringify(roomState), 'EX', 10800);
        multi.set(`matchmaking:player:${player1.id}`, roomId, 'EX', 10800);
        multi.set(`matchmaking:player:${player2.id}`, roomId, 'EX', 10800);
        await multi.exec();

        // Pre-emptively trigger judge worker wake-up so it's warm before players submit code
        const judgeWorkerPingService = require('../../services/judgeWorkerPingService');
        judgeWorkerPingService.wakeUpWorker('custom_match_created');

        // Broadcast MATCH_FOUND and ROOM_CREATED
        const p1Target = io.to(`user:${player1.id}`);
        p1Target.emit(SERVER_EVENTS.MATCH_FOUND, {
            roomId,
            opponent: { id: player2.id, username: p2Username, rating: p2Rating, avatar: p2Avatar },
            mode: roomState.mode
        });
        p1Target.emit(SERVER_EVENTS.ROOM_CREATED, roomState);

        const p2Target = io.to(`user:${player2.id}`);
        p2Target.emit(SERVER_EVENTS.MATCH_FOUND, {
            roomId,
            opponent: { id: player1.id, username: p1Username, rating: p1Rating, avatar: p1Avatar },
            mode: roomState.mode
        });
        p2Target.emit(SERVER_EVENTS.ROOM_CREATED, roomState);

        // Schedule Countdown and Match Start to coincide with client transition from lobby
        setTimeout(() => {
            io.to(roomId).emit(SERVER_EVENTS.COUNTDOWN_STARTED, { startsInSeconds: 3 });

            setTimeout(async () => {
                const refreshedRoomStr = await redisClient.get(roomId);
                if (!refreshedRoomStr) return;
                const refreshedRoom = JSON.parse(refreshedRoomStr);

                if (refreshedRoom.status === 'finished') return;

                const startedAtIso = new Date().toISOString();
                const endsAtIso = new Date(Date.now() + (durationSeconds * 1000)).toISOString();

                refreshedRoom.status = 'running';
                refreshedRoom.startedAt = startedAtIso;
                refreshedRoom.endsAt = endsAtIso;

                await redisClient.set(roomId, JSON.stringify(refreshedRoom), 'EX', 86400);

                io.to(roomId).emit(SERVER_EVENTS.CONTEST_STARTED, {
                    roomId,
                    startedAt: startedAtIso,
                    endsAt: endsAtIso,
                    durationSeconds,
                    problems: refreshedRoom.problems
                });

                // Schedule match expiration timer
                setTimeout(async () => {
                    try {
                        const checkRoomStr = await redisClient.get(roomId);
                        if (!checkRoomStr) return;
                        const checkRoom = JSON.parse(checkRoomStr);
                        if (checkRoom.status !== 'finished') {
                            await this.finalizeMatch(io, roomId, 'TIME_EXPIRED');
                        }
                    } catch (err) {
                        console.error('Error during custom timeout match finalization:', err);
                    }
                }, durationSeconds * 1000);
            }, 3000);
        }, 1000);

        return roomId;
    }
}

module.exports = new RoomService();
