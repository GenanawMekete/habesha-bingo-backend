const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true },
  numbers: { type: [[Number]], required: true }, // 5x5 grid
  pattern: { type: String, default: 'standard' },
  theme: { type: String, default: 'classic' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  drawnNumbers: { type: [Number], default: [] },
  maxPlayers: { type: Number, default: 100 },
  currentPlayers: { type: Number, default: 0 },
  entryFee: { type: Number, default: 10 }, // in coins
  prizePool: { type: Number, default: 0 },
  winners: [{
    userId: String,
    position: Number,
    prize: Number
  }],
  startTime: Date,
  endTime: Date,
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  photoUrl: String,
  coins: { type: Number, default: 100 }, // Starting coins
  totalGames: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  totalWon: { type: Number, default: 0 },
  selectedCards: [{
    gameId: String,
    cards: [String], // Array of cardIds
    purchasePrice: Number,
    purchaseTime: Date
  }],
  activeGames: [{
    gameId: String,
    cards: [String],
    matches: [{
      cardId: String,
      matchedNumbers: [Number],
      patterns: [String]
    }]
  }],
  isPremium: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['purchase', 'win', 'refund', 'bonus', 'transfer'],
    required: true 
  },
  amount: { type: Number, required: true },
  description: String,
  gameId: String,
  cardIds: [String],
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

const Card = mongoose.model('Card', cardSchema);
const Game = mongoose.model('Game', gameSchema);
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Card, Game, User, Transaction };
