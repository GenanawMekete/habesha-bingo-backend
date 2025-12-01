const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/cards', gameController.getCards);

// Protected routes
router.post('/purchase', authenticate, gameController.purchaseCards);
router.post('/quick-select', authenticate, gameController.quickSelect);
router.get('/my-games', authenticate, gameController.getUserGames);
router.post('/:gameId/draw', authenticate, gameController.drawNumber);

module.exports = router;
