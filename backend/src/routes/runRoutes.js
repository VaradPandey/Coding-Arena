const express = require('express');
const runController = require('../controllers/runController');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Require authentication: Only authenticated users can run code against sample tests
router.post('/', requireAuth, (req, res) => runController.run(req, res));

module.exports = router;
