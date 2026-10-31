const prisma = require('../../config/prisma');

class UserService {
    async getUserProfile(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                avatar: true,
                rating: true,
                maxRating: true,
                wins: true,
                losses: true,
                draws: true,
                problemsSolved: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!user) return null;

        const solvedCount = await prisma.userProblemStatus.count({
            where: { userId, status: 'Accepted' }
        });

        if (user.problemsSolved !== solvedCount) {
            await prisma.user.update({
                where: { id: userId },
                data: { problemsSolved: solvedCount }
            });
            user.problemsSolved = solvedCount;
        }

        return user;
    }
    async updateUser(userId, data) {
        return prisma.user.update({
            where: { id: userId },
            data: {
                displayName: data.displayName,
                avatar: data.avatar
            },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                avatar: true,
                rating: true,
                wins: true,
                losses: true,
                draws: true,
                problemsSolved: true
            }
        });
    }

    async getUserSubmissions(userId, { limit = 10, offset = 0 } = {}) {
        const submissions = await prisma.submissions.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: limit,
            skip: offset,
            include: {
                problems: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true
                    }
                }
            }
        });

        // Map BIGINT to string to avoid JSON serialization errors
        return submissions.map(sub => ({
            ...sub,
            id: sub.id ? sub.id.toString() : null,
            problem_id: sub.problem_id ? sub.problem_id.toString() : null,
            problems: sub.problems ? {
                ...sub.problems,
                id: sub.problems.id ? sub.problems.id.toString() : null
            } : null
        }));
    }

    async getSolvedProblems(userId) {
        const solved = await prisma.userProblemStatus.findMany({
            where: { 
                userId,
                status: 'Accepted'
            },
            include: {
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true
                    }
                }
            }
        });

        // Map BIGINT to string
        return solved.map(s => ({
            ...s,
            problemId: s.problemId ? s.problemId.toString() : null,
            problem: s.problem ? {
                ...s.problem,
                id: s.problem.id ? s.problem.id.toString() : null
            } : null
        }));
    }

    async getUserMatches(userId, { limit = 10 } = {}) {
        const matches = await prisma.match.findMany({
            where: {
                OR: [
                    { player1Id: userId },
                    { player2Id: userId }
                ],
                status: 'FINISHED'
            },
            include: {
                player1: {
                    select: { id: true, username: true, rating: true, avatar: true, displayName: true }
                },
                player2: {
                    select: { id: true, username: true, rating: true, avatar: true, displayName: true }
                }
            },
            orderBy: {
                finishedAt: 'desc'
            },
            take: limit
        });

        return matches.map(match => {
            const isP1 = match.player1Id === userId;
            const opponent = isP1 ? match.player2 : match.player1;
            const userScore = isP1 ? match.p1Score : match.p2Score;
            const opponentScore = isP1 ? match.p2Score : match.p1Score;
            const oldRating = isP1 ? match.p1OldRating : match.p2OldRating;
            const newRating = isP1 ? match.p1NewRating : match.p2NewRating;
            const ratingDiff = (newRating != null && oldRating != null) ? (newRating - oldRating) : null;
            const isWinner = match.winnerId === userId;
            const isDraw = !match.winnerId && match.status === 'FINISHED';

            return {
                id: match.id,
                roomId: match.roomId,
                status: match.status,
                finishReason: match.finishReason,
                startedAt: match.startedAt,
                finishedAt: match.finishedAt,
                isWinner,
                isDraw,
                userScore,
                opponentScore,
                oldRating,
                newRating,
                ratingDiff,
                opponent: opponent ? {
                    id: opponent.id,
                    username: opponent.username,
                    displayName: opponent.displayName,
                    rating: opponent.rating,
                    avatar: opponent.avatar
                } : null
            };
        });
    }

    async getLeaderboard({ limit = 50, offset = 0 } = {}) {
        const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
        const skip = Math.max(parseInt(offset, 10) || 0, 0);

        const [users, totalUsers] = await Promise.all([
            prisma.user.findMany({
                take: take,
                skip: skip,
                orderBy: [
                    { rating: 'desc' },
                    { wins: 'desc' },
                    { createdAt: 'asc' }
                ],
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true,
                    rating: true,
                    maxRating: true,
                    wins: true,
                    losses: true,
                    draws: true,
                    problemsSolved: true,
                    createdAt: true
                }
            }),
            prisma.user.count()
        ]);

        const leaderboard = users.map((u, idx) => ({
            rank: skip + idx + 1,
            id: u.id,
            username: u.username,
            displayName: u.displayName || u.username,
            avatar: u.avatar,
            rating: u.rating ?? 0,
            maxRating: u.maxRating ?? u.rating ?? 0,
            wins: u.wins ?? 0,
            losses: u.losses ?? 0,
            draws: u.draws ?? 0,
            problemsSolved: u.problemsSolved ?? 0,
            createdAt: u.createdAt
        }));

        return {
            leaderboard,
            totalUsers,
            limit: take,
            offset: skip
        };
    }

    async getUserRank(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                rating: true,
                wins: true,
                losses: true,
                draws: true
            }
        });

        if (!user) {
            return null;
        }

        const rating = user.rating ?? 0;

        const [higherCount, totalUsers] = await Promise.all([
            prisma.user.count({
                where: {
                    rating: { gt: rating }
                }
            }),
            prisma.user.count()
        ]);

        return {
            rank: higherCount + 1,
            totalUsers,
            rating,
            wins: user.wins ?? 0,
            losses: user.losses ?? 0,
            draws: user.draws ?? 0
        };
    }
}

module.exports = new UserService();
