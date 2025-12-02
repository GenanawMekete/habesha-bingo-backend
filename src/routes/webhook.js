const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');

// Telegram webhook endpoint
router.post('/telegram', botController.handleCommand.bind(botController));

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Webhook is working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
