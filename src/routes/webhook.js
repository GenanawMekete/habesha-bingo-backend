const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Stripe webhook (no authentication needed for webhooks)
router.post('/stripe', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

module.exports = router;
