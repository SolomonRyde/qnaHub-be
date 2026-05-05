
const express = require('express');
const router = express.Router();
const { generateResponse } = require('../controllers/llmQuestionController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeAdmin, generateResponse);

module.exports = router;