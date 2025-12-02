const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  name: { type: String, default: 'BINGO Game' },
  status: { 
    type: String, 
    enum: ['waiting', 'active', 'completed', 'cancelled'],
    default: 'waiting'
  },
  
  // Game Settings
  entryFee: { type: Number, default: 10 },
  maxPlayers: { type: Number, default: 50 },
  currentPlayers: { type: Number, default: 0 },
  prizePool: { type: Number, default: 0 },
  
  // Game State
  drawnNumbers: { type: [Number], default: [] },
  currentNumber: Number,
  calledNumbers: [{
    number: Number,
    calledAt: Date,
    calledBy: String // Telegram ID
  }],
  
  // Players
  players: [{
    telegramId: String,
    username: String,
    cards: [String], // Card IDs
    hasWon: { type: Boolean, default: false },
    winAmount: Number,
    joinedAt: Date
  }],
  
  // Winners
  winners: [{
    position: Number,
    telegramId: String,
    username: String,
    prize: Number,
    winType: String // 'line', 'full-house', etc.
  }],
  
  // Timing
  startTime: Date,
  endTime: Date,
  nextDraw: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);
