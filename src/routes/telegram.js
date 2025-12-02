const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');
const { authenticate } = require('../middleware/auth');

// Telegram authentication
router.post('/auth', telegramController.authenticate);

// Get bot info (public)
router.get('/bot-info', telegramController.getBotInfo);

// Send notification (protected)
router.post('/send-notification', authenticate, telegramController.sendNotification);

// Webhook for bot updates (optional)
router.post('/webhook', (req, res) => {
  // Handle bot updates if needed
  console.log('Webhook received:', req.body);
  res.sendStatus(200);
});

module.exports = router;
