const prisma = require('../../config/prisma');
const { redisClient } = require('../../redis/client');

class MatchService {
    async createMatch(roomId, player1Id, player2Id) {
        return prisma.match.create({
            data: {
                roomId,
                player1Id,
                player2Id,
                status: 'ACTIVE'
            }
        });
    }

    async finalizeMatch(roomId, winnerIdFromLua = null, reason = 'ALL_PROBLEMS_SOLVED') {
        // If this is a timeout, we must atomically transition the room in Redis
        // to prevent a race condition with a late submission.
        if (reason === 'TIME_EXPIRED') {
            const LUA_TIMEOUT_FINISH = `
                local roomStr = redis.call("GET", KEYS[1])
                if not roomStr then return nil end
                local room = cjson.decode(roomStr)
                if room.status == 'finished' then
                    return nil
                end
                room.status = 'finished'
                redis.call("SET", KEYS[1], cjson.encode(room), "EX", 10800) -- 3 hours TTL
                return cjson.encode(room)
            `;
            const roomData = await redisClient.eval(LUA_TIMEOUT_FINISH, 1, roomId);
            if (!roomData) return null; // already finished by a submission
        }
        
        return prisma.$transaction(async (tx) => {
            // Idempotency: Lock the match row and check status
            const match = await tx.match.findUnique({
                where: { roomId }
            });
            if (!match || match.status === 'FINISHED') return null;

            // Fetch Redis room state for final scores
            const roomStr = await redisClient.get(roomId);
            if (!roomStr) return null;
            const room = JSON.parse(roomStr);

            const p1Score = room.scores[match.player1Id] || 0;
            const p2Score = room.scores[match.player2Id] || 0;

            let winnerId = null;
            let loserId = null;
            let isDraw = false;

            if (reason === 'ALL_PROBLEMS_SOLVED') {
                if (!winnerIdFromLua) throw new Error("Winner ID required for early completion");
                // Validate that the winner from Lua matches a player in this match
                if (winnerIdFromLua !== match.player1Id && winnerIdFromLua !== match.player2Id) return null;
                // Double check Lua actually finished it
                if (room.winner !== winnerIdFromLua) return null;
                
                winnerId = winnerIdFromLua;
                loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
            } else if (reason === 'TIME_EXPIRED') {
                if (p1Score > p2Score) {
                    winnerId = match.player1Id;
                    loserId = match.player2Id;
                } else if (p2Score > p1Score) {
                    winnerId = match.player2Id;
                    loserId = match.player1Id;
                } else {
                    // Tie-breaker: Player with fewer incorrect submission penalties wins
                    const p1Penalties = room.penalties?.[match.player1Id] || 0;
                    const p2Penalties = room.penalties?.[match.player2Id] || 0;
                    if (p1Penalties < p2Penalties) {
                        winnerId = match.player1Id;
                        loserId = match.player2Id;
                    } else if (p2Penalties < p1Penalties) {
                        winnerId = match.player2Id;
                        loserId = match.player1Id;
                    } else {
                        isDraw = true;
                    }
                }
            } else if (reason === 'FORFEIT' || reason === 'BAIL_OUT') {

                if (!winnerIdFromLua) throw new Error("Winner ID required for forfeit completion");
                winnerId = winnerIdFromLua;
                loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
            }

            const p1 = await tx.user.findUnique({ where: { id: match.player1Id } });
            const p2 = await tx.user.findUnique({ where: { id: match.player2Id } });

            // True Elo Calculation Engine
            let outcome = 0.5;
            if (!isDraw) {
                outcome = winnerId === match.player1Id ? 1 : 0;
            }

            const expectedP1 = 1 / (1 + Math.pow(10, (p2.rating - p1.rating) / 400));
            const expectedP2 = 1 - expectedP1;

            const getK = (r) => {
                if (r < 1400) return 40;
                if (r < 2000) return 32;
                return 24;
            };

            const k1 = getK(p1.rating);
            const k2 = getK(p2.rating);

            let p1Delta = Math.round(k1 * (outcome - expectedP1));
            let p2Delta = Math.round(k2 * ((1 - outcome) - expectedP2));

            // Decisive result floor: at least +/- 6 points
            if (outcome === 1) {
                if (p1Delta < 6) p1Delta = 6;
                if (p2Delta > -6) p2Delta = -6;
            } else if (outcome === 0) {
                if (p1Delta > -6) p1Delta = -6;
                if (p2Delta < 6) p2Delta = 6;
            }

            // Casual / Unranked mode check
            const isRanked = room.mode !== 'casual';
            const p1NewRating = isRanked ? Math.max(0, p1.rating + p1Delta) : p1.rating;
            const p2NewRating = isRanked ? Math.max(0, p2.rating + p2Delta) : p2.rating;

            const TIERS = [
                { name: 'Bronze', title: 'Novice', min: 0, max: 1199, color: '#f59e0b', badge: 'Shield' },
                { name: 'Silver', title: 'Specialist', min: 1200, max: 1499, color: '#94a3b8', badge: 'Swords' },
                { name: 'Gold', title: 'Expert', min: 1500, max: 1799, color: '#eab308', badge: 'Crown' },
                { name: 'Platinum', title: 'Master', min: 1800, max: 2099, color: '#06b6d4', badge: 'Gem' },
                { name: 'Grandmaster', title: 'Guardian', min: 2100, max: 3000, color: '#ec4899', badge: 'Flame' }
            ];

            const getTierInfo = (rating) => {
                const r = Math.max(0, rating || 0);
                const t = TIERS.find(x => r >= x.min && r <= x.max) || TIERS[TIERS.length - 1];
                const span = Math.max(1, t.max - t.min);
                const progressPercent = Math.min(100, Math.max(0, Math.round(((r - t.min) / span) * 100)));
                const pointsToNext = Math.max(0, t.max + 1 - r);
                return {
                    name: t.name,
                    title: t.title,
                    min: t.min,
                    max: t.max,
                    color: t.color,
                    badge: t.badge,
                    progressPercent,
                    pointsToNext
                };
            };

            const p1Tier = getTierInfo(p1NewRating);
            const p1PrevTier = getTierInfo(p1.rating);
            const p2Tier = getTierInfo(p2NewRating);
            const p2PrevTier = getTierInfo(p2.rating);

            if (isDraw) {
                await tx.user.update({
                    where: { id: p1.id },
                    data: {
                        draws: { increment: 1 },
                        rating: p1NewRating,
                        maxRating: Math.max(p1.maxRating || 0, p1NewRating)
                    }
                });
                await tx.user.update({
                    where: { id: p2.id },
                    data: {
                        draws: { increment: 1 },
                        rating: p2NewRating,
                        maxRating: Math.max(p2.maxRating || 0, p2NewRating)
                    }
                });
            } else if (winnerId === p1.id) {
                await tx.user.update({
                    where: { id: p1.id },
                    data: {
                        wins: { increment: 1 },
                        rating: p1NewRating,
                        maxRating: Math.max(p1.maxRating || 0, p1NewRating)
                    }
                });
                await tx.user.update({
                    where: { id: p2.id },
                    data: {
                        losses: { increment: 1 },
                        rating: p2NewRating,
                        maxRating: Math.max(p2.maxRating || 0, p2NewRating)
                    }
                });
            } else {
                await tx.user.update({
                    where: { id: p2.id },
                    data: {
                        wins: { increment: 1 },
                        rating: p2NewRating,
                        maxRating: Math.max(p2.maxRating || 0, p2NewRating)
                    }
                });
                await tx.user.update({
                    where: { id: p1.id },
                    data: {
                        losses: { increment: 1 },
                        rating: p1NewRating,
                        maxRating: Math.max(p1.maxRating || 0, p1NewRating)
                    }
                });
            }

            const updatedMatch = await tx.match.update({
                where: { id: match.id },
                data: {
                    status: 'FINISHED',
                    finishReason: reason,
                    winnerId: isDraw ? null : winnerId,
                    loserId: isDraw ? null : loserId,
                    p1Score,
                    p2Score,
                    p1OldRating: p1.rating,
                    p1NewRating,
                    p2OldRating: p2.rating,
                    p2NewRating,
                    finishedAt: new Date()
                }
            });

            await tx.matchEvent.create({
                data: {
                    matchId: match.id,
                    eventType: 'MATCH_FINISHED',
                    payload: { reason, isDraw, p1Score, p2Score }
                }
            });

            // Compare-and-Delete: safely remove active match mappings in Redis
            // only if they still point to the finishing room.
            const LUA_COMPARE_AND_DELETE = `
                if redis.call("GET", KEYS[1]) == ARGV[1] then
                    return redis.call("DEL", KEYS[1])
                else
                    return 0
                end
            `;
            await redisClient.eval(LUA_COMPARE_AND_DELETE, 1, `matchmaking:player:${match.player1Id}`, roomId);
            await redisClient.eval(LUA_COMPARE_AND_DELETE, 1, `matchmaking:player:${match.player2Id}`, roomId);

            // Clean up presence to online
            const presenceService = require('../presence/presence.service');
            try {
                await Promise.all([
                    presenceService.updateStatus(match.player1Id, 'online', ''),
                    presenceService.updateStatus(match.player2Id, 'online', '')
                ]);
            } catch (presErr) {
                console.error('Failed to update presence to online in finalizeMatch:', presErr);
            }

            return {
                roomId,
                winnerId: isDraw ? null : winnerId,
                loserId: isDraw ? null : loserId,
                reason,
                result: isDraw ? 'DRAW' : 'WIN',
                finalScores: {
                    [p1.id]: p1Score,
                    [p2.id]: p2Score
                },
                penalties: {
                    [p1.id]: room.penalties?.[p1.id] || 0,
                    [p2.id]: room.penalties?.[p2.id] || 0
                },
                ratings: {

                    [p1.id]: {
                        old: p1.rating,
                        new: p1NewRating,
                        diff: p1NewRating - p1.rating,
                        expectedProb: Math.round(expectedP1 * 100),
                        tier: p1Tier,
                        prevTier: p1PrevTier,
                        isPromotion: p1Tier.name !== p1PrevTier.name && p1NewRating > p1.rating
                    },
                    [p2.id]: {
                        old: p2.rating,
                        new: p2NewRating,
                        diff: p2NewRating - p2.rating,
                        expectedProb: Math.round(expectedP2 * 100),
                        tier: p2Tier,
                        prevTier: p2PrevTier,
                        isPromotion: p2Tier.name !== p2PrevTier.name && p2NewRating > p2.rating
                    }
                }
            };
        });
    }
}

module.exports = new MatchService();
