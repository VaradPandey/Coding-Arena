const submissionService = require('../services/submissionService');

const MAX_SOURCE_BYTES = 64 * 1024; // 64 KB limit

class SubmissionController {
    async createSubmission(req, res) {
        try {
            const { problem_id, language, source_code } = req.body;
            const user_id = req.user.id; // from requireAuth middleware

            if (!problem_id || !language || !source_code) {
                return res.status(400).json({ error: 'problem_id, language, and source_code are required' });
            }

            const parsedProblemId = parseInt(problem_id, 10);
            if (isNaN(parsedProblemId) || parsedProblemId <= 0) {
                return res.status(400).json({ error: 'problem_id must be a valid positive integer' });
            }

            const normalizedLang = String(language).toLowerCase().trim();
            if (normalizedLang !== 'cpp' && normalizedLang !== 'cpp17' && normalizedLang !== 'c++') {
                return res.status(400).json({ error: `Unsupported language: ${language}. Only C++17 ('cpp') is allowed.` });
            }

            if (typeof source_code !== 'string' || source_code.trim().length === 0) {
                return res.status(400).json({ error: 'source_code must be a non-empty string' });
            }

            if (Buffer.byteLength(source_code, 'utf8') > MAX_SOURCE_BYTES) {
                return res.status(400).json({ error: 'source_code exceeds the maximum limit of 64 KB' });
            }

            const submission = await submissionService.createSubmission(user_id, parsedProblemId, 'cpp', source_code);
            return res.status(201).json(submission);
        } catch (error) {
            if (error.message.includes('does not exist')) {
                return res.status(404).json({ error: error.message });
            }
            console.error('Error creating submission:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getSubmission(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id; // from requireAuth middleware

            const submission = await submissionService.getSubmission(id);

            if (!submission) {
                return res.status(404).json({ error: 'Submission not found' });
            }

            // Authorization check: Only the submission owner may view this submission
            if (submission.user_id && submission.user_id !== userId) {
                return res.status(403).json({ error: 'Forbidden: You are not authorized to view this submission' });
            }

            return res.json(submission);
        } catch (error) {
            console.error('Error getting submission:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getUserProblemSubmissions(req, res) {
        try {
            const { problemId } = req.params;
            const userId = req.user.id;
            const submissions = await submissionService.getUserProblemSubmissions(userId, problemId);
            return res.json(submissions);
        } catch (error) {
            console.error('Error getting problem submissions:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

}

module.exports = new SubmissionController();
