const userService = require('./user.service');

const getMe = async (req, res) => {
    try {
        const profile = await userService.getUserProfile(req.user.id);
        res.status(200).json({
            success: true,
            data: profile || req.user
        });
    } catch (error) {
        console.error('Get Me Error:', error);
        res.status(200).json({
            success: true,
            data: req.user
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { displayName, avatar } = req.body;

        if (displayName !== undefined && typeof displayName !== 'string') {
            return res.status(400).json({ success: false, message: 'displayName must be a string' });
        }
        if (displayName && (displayName.trim().length < 2 || displayName.trim().length > 50)) {
            return res.status(400).json({ success: false, message: 'Display name must be between 2 and 50 characters' });
        }
        if (avatar !== undefined && typeof avatar !== 'string') {
            return res.status(400).json({ success: false, message: 'avatar must be a string' });
        }
        
        const updatedUser = await userService.updateUser(req.user.id, { 
            displayName: displayName ? displayName.trim() : null, 
            avatar: avatar ? avatar.trim() : null 
        });
        
        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getLeaderboard = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = parseInt(req.query.offset, 10) || 0;

        const result = await userService.getLeaderboard({ limit, offset });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Get Leaderboard Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getMyRank = async (req, res) => {
    try {
        const rankData = await userService.getUserRank(req.user.id);
        if (!rankData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({
            success: true,
            data: rankData
        });
    } catch (error) {
        console.error('Get My Rank Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getMySubmissions = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = parseInt(req.query.offset, 10) || 0;
        
        const submissions = await userService.getUserSubmissions(req.user.id, { limit, offset });
        
        res.status(200).json({
            success: true,
            data: submissions
        });
    } catch (error) {
        console.error('Get Submissions Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getMySolvedProblems = async (req, res) => {
    try {
        const solved = await userService.getSolvedProblems(req.user.id);
        
        res.status(200).json({
            success: true,
            data: solved
        });
    } catch (error) {
        console.error('Get Solved Problems Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getMyMatches = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const matches = await userService.getUserMatches(req.user.id, { limit });
        
        res.status(200).json({
            success: true,
            data: matches
        });
    } catch (error) {
        console.error('Get My Matches Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getMe,
    updateProfile,
    getLeaderboard,
    getMyRank,
    getMySubmissions,
    getMySolvedProblems,
    getMyMatches
};
