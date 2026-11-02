const axios = require('axios');
const config = require('../config');

// Worker URL where the sandboxed judge worker is running
const WORKER_URL = (config.judgeWorkerUrl || process.env.JUDGE_WORKER_URL || 'http://localhost:10000').replace(/\/+$/, '');
const MAX_SOURCE_BYTES = 64 * 1024; // 64 KB limit

class RunController {
    async run(req, res) {
        try {
            const { problem_id, language, source_code } = req.body;

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

            // Forward execution request to the sandboxed Docker worker container
            const response = await axios.post(`${WORKER_URL}/run`, {
                problem_id: parsedProblemId,
                language: 'cpp',
                source_code
            }, {
                timeout: 15000,
                headers: { 'Content-Type': 'application/json' }
            });

            return res.status(200).json(response.data);
        } catch (error) {
            console.error('Run Controller Error:', error.message);
            if (error.response?.data) {
                return res.status(error.response.status || 500).json(error.response.data);
            }
            return res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }
}

module.exports = new RunController();
