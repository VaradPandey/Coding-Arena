const express = require('express');
const userController = require('./user.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = express.Router();

// Public leaderboard route (accessible without login)
router.get('/leaderboard', userController.getLeaderboard);

// All subsequent user routes require authentication
router.use(requireAuth);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateProfile);
router.get('/me/rank', userController.getMyRank);
router.get('/me/submissions', userController.getMySubmissions);
router.get('/me/solved', userController.getMySolvedProblems);
router.get('/me/matches', userController.getMyMatches);

module.exports = router;
