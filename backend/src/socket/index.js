const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { pubClient, subClient } = require('../redis/client');
const { verifyToken } = require('../utils/jwt');
const { registerHandlers } = require('./handlers');
const roomService = require('../modules/rooms/room.service');
const config = require('../config');

const initializeSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: config.allowedOrigins,
            methods: ['GET', 'POST']
        }
    });

    // Use Redis Adapter for multi-process broadcasting (Judge integration)
    io.adapter(createAdapter(pubClient, subClient));

    // Middleware for Authentication
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) {
                return next(new Error('Unauthorized: No token provided'));
            }

            // Verify JWT
            const decoded = verifyToken(token);
            
            // Attach user to socket. 
            // DB lookup omitted intentionally per architecture design.
            const targetUserId = decoded?.userId || decoded?.id || decoded?.sub;
            if (!targetUserId) {
                return next(new Error('Unauthorized: Invalid token payload'));
            }

            socket.user = {
                id: targetUserId,
                username: decoded.username,
                rating: decoded.rating ?? 0
            };

            next();
        } catch (error) {
            next(new Error('Unauthorized: Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        console.log(`Socket connected: ${socket.id} (User: ${socket.user.username})`);
        
        // Join personal user room so events can reliably reach this user regardless of socket reconnects
        socket.join(`user:${socket.user.id}`);

        // Mark user online in Redis presence
        const presenceService = require('../modules/presence/presence.service');
        try {
            await presenceService.markOnline(socket.user.id, socket.id, {
                username: socket.user.username,
                rating: socket.user.rating
            });
        } catch (pErr) {
            console.error('Error updating presence on connect:', pErr);
        }

        // Check if user is already in a match and silently rejoin them
        try {
            await roomService.handleReconnect(io, socket, socket.user.id);
        } catch (err) {
            console.error('Error handling reconnect:', err);
        }

        // Register all socket handlers
        registerHandlers(io, socket);
    });

    // Start background matchmaking heartbeat (evaluates waiting queue every 2s)
    const matchmakingService = require('../modules/matchmaking/matchmaking.service');
    setInterval(() => {
        try {
            matchmakingService.attemptMatch(io);
        } catch (err) {
            console.error('[Matchmaking Heartbeat Error]:', err);
        }
    }, 2000);

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

module.exports = {
    initializeSocket,
    getIo
};
