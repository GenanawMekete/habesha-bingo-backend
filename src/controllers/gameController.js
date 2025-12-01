const { Card, Game, User, Transaction } = require('../config/database');
const { PRICING, GAME_CONFIG } = require('../config/constants');
const crypto = require('crypto');

class GameController {
  // Get available cards with pagination
  async getCards(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const skip = (page - 1) * limit;

      let query = { isActive: true };
      if (search) {
        query.cardId = { $regex: search, $options: 'i' };
      }

      const cards = await Card.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .select('cardId numbers theme');

      const total = await Card.countDocuments(query);

      res.json({
        success: true,
        data: cards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching cards'
      });
    }
  }

  // Calculate price for selected cards
  calculatePrice(cardCount) {
    if (cardCount >= 10) return PRICING.TEN_CARDS;
    if (cardCount >= 5) return PRICING.FIVE_CARDS;
    if (cardCount >= 3) return PRICING.THREE_CARDS;
    return cardCount * PRICING.SINGLE_CARD;
  }

  // Purchase cards
  async purchaseCards(req, res) {
    try {
      const { gameId, cardIds, bundle } = req.body;
      const user = req.user;

      // Validate game exists and is active
      const game = await Game.findOne({ gameId, status: 'active' });
      if (!game) {
        return res.status(400).json({
          success: false,
          message: 'Game not found or not active'
        });
      }

      let selectedCardIds = cardIds;
      let price = 0;

      // Handle bundle purchase
      if (bundle && PRICING.BUNDLES[bundle]) {
        const bundleInfo = PRICING.BUNDLES[bundle];
        
        // Get random cards for bundle
        const randomCards = await Card.aggregate([
          { $match: { isActive: true } },
          { $sample: { size: bundleInfo.count } },
          { $project: { cardId: 1 } }
        ]);
        
        selectedCardIds = randomCards.map(card => card.cardId);
        price = bundleInfo.price;
      } else {
        // Individual card selection
        if (selectedCardIds.length > 20) {
          return res.status(400).json({
            success: false,
            message: 'Maximum 20 cards allowed per purchase'
          });
        }

        // Verify cards exist and are available
        const cards = await Card.find({
          cardId: { $in: selectedCardIds },
          isActive: true
        });

        if (cards.length !== selectedCardIds.length) {
          return res.status(400).json({
            success: false,
            message: 'Some cards are not available'
          });
        }

        price = this.calculatePrice(selectedCardIds.length);
      }

      // Check user balance
      if (user.coins < price) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient coins',
          required: price,
          available: user.coins
        });
      }

      // Create transaction
      const transaction = new Transaction({
        transactionId: `txn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        userId: user.telegramId,
        type: 'purchase',
        amount: -price,
        description: `Purchased ${selectedCardIds.length} cards for game ${gameId}`,
        gameId,
        cardIds: selectedCardIds,
        status: 'completed',
        metadata: { bundle, discountApplied: true }
      });

      // Update user coins and add cards
      user.coins -= price;
      user.totalSpent += price;
      
      user.selectedCards.push({
        gameId,
        cards: selectedCardIds,
        purchasePrice: price,
        purchaseTime: new Date()
      });

      user.activeGames.push({
        gameId,
        cards: selectedCardIds,
        matches: selectedCardIds.map(cardId => ({
          cardId,
          matchedNumbers: [],
          patterns: []
        }))
      });

      // Update game player count
      game.currentPlayers += 1;

      // Save all changes in transaction
      await Promise.all([
        user.save(),
        game.save(),
        transaction.save()
      ]);

      res.json({
        success: true,
        message: 'Cards purchased successfully',
        data: {
          cards: selectedCardIds,
          price,
          remainingCoins: user.coins,
          transactionId: transaction.transactionId
        }
      });
    } catch (error) {
      console.error('Purchase error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing purchase'
      });
    }
  }

  // Draw a number for the game
  async drawNumber(req, res) {
    try {
      const { gameId } = req.params;
      const game = await Game.findOne({ gameId });

      if (!game) {
        return res.status(404).json({
          success: false,
          message: 'Game not found'
        });
      }

      if (game.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Game is not active'
        });
      }

      // Generate unique random number (1-75)
      let newNumber;
      const usedNumbers = new Set(game.drawnNumbers);
      
      do {
        newNumber = Math.floor(Math.random() * 75) + 1;
      } while (usedNumbers.has(newNumber) && usedNumbers.size < 75);

      if (usedNumbers.size >= 75) {
        return res.status(400).json({
          success: false,
          message: 'All numbers have been drawn'
        });
      }

      game.drawnNumbers.push(newNumber);
      await game.save();

      // Check for winners (simplified - in production, use WebSockets for real-time updates)
      // This would trigger checking all players' cards for winning patterns

      res.json({
        success: true,
        data: {
          number: newNumber,
          drawnCount: game.drawnNumbers.length,
          drawnNumbers: game.drawnNumbers
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error drawing number'
      });
    }
  }

  // Get user's active games
  async getUserGames(req, res) {
    try {
      const user = req.user;
      
      const activeGames = await Game.find({
        gameId: { $in: user.activeGames.map(g => g.gameId) },
        status: 'active'
      });

      res.json({
        success: true,
        data: {
          activeGames: user.activeGames.map(activeGame => {
            const game = activeGames.find(g => g.gameId === activeGame.gameId);
            return {
              ...activeGame.toObject(),
              gameInfo: game
            };
          }),
          totalGames: user.totalGames,
          gamesWon: user.gamesWon
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user games'
      });
    }
  }

  // Quick select random cards
  async quickSelect(req, res) {
    try {
      const { count, gameId } = req.body;
      const validCounts = [1, 3, 5];
      
      if (!validCounts.includes(parseInt(count))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid quick select count. Choose 1, 3, or 5'
        });
      }

      // Get random cards
      const randomCards = await Card.aggregate([
        { $match: { isActive: true } },
        { $sample: { size: parseInt(count) } },
        { $project: { cardId: 1, numbers: 1, theme: 1 } }
      ]);

      const price = this.calculatePrice(count);

      res.json({
        success: true,
        data: {
          cards: randomCards,
          price,
          discount: count > 1 ? `${count === 3 ? '10%' : '20%'} discount applied` : null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error in quick select'
      });
    }
  }
}

module.exports = new GameController();
