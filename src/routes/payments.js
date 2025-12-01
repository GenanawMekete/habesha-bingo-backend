const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// Get payment options
router.get('/options', authenticate, paymentController.getPaymentOptions);

// Stripe payments
router.post('/stripe/create-checkout', authenticate, paymentController.createStripeCheckout);

// Telegram Stars payments
router.post('/telegram/stars', authenticate, paymentController.processTelegramStars);

module.exports = router;
