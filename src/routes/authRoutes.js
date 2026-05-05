const express = require('express');
const router = express.Router();
const { signup, verifyOTP, login, resendOTP, forgotPassword, resetPassword, logout, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/signup', signup);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);

router.get('/me', authenticateToken, getMe);

module.exports = router;