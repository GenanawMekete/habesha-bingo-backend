const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Telegram authentication
router.post('/telegram', authController.telegramAuth);
router.post('/refresh', authController.refreshToken);
router.get('/profile', authController.authenticate, authController.getProfile);

module.exports = router;
