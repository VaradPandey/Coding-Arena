const prisma = require('../../config/prisma');
const { hashPassword, comparePassword } = require('../../utils/password');
const { generateToken } = require('../../utils/jwt');

class AuthService {
    async registerUser({ username, email, password }) {
        // Check if username already exists
        const existingUsername = await prisma.user.findUnique({
            where: { username }
        });
        if (existingUsername) {
            throw new Error('Username is already taken');
        }

        // Check if email already exists
        const existingEmail = await prisma.user.findUnique({
            where: { email }
        });
        if (existingEmail) {
            throw new Error('Email is already registered');
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const user = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                rating: 0,
                maxRating: 0
            }
        });

        // Generate JWT
        const token = generateToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            rating: user.rating
        });

        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                rating: user.rating
            },
            token
        };
    }

    async loginUser({ email, password }) {
        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Compare password
        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) {
            throw new Error('Invalid credentials');
        }

        // Generate JWT
        const token = generateToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            rating: user.rating
        });

        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                rating: user.rating
            },
            token
        };
    }
}

module.exports = new AuthService();
