const express = require('express');
const submissionController = require('../controllers/submissionController');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// All submission endpoints require authentication
router.post('/', requireAuth, submissionController.createSubmission);
router.get('/problem/:problemId', requireAuth, submissionController.getUserProblemSubmissions);
router.get('/:id', requireAuth, submissionController.getSubmission);

module.exports = router;
