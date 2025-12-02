const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Telegram Info
  telegramId: { type: String, required: true, unique: true },
  username: { type: String, index: true },
  firstName: String,
  lastName: String,
  photoUrl: String,
  languageCode: { type: String, default: 'en' },
  
  // Account Info
  coins: { type: Number, default: 100 }, // Starting bonus
  totalDeposited: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },
  referredBy: String, // Telegram ID of referrer
  
  // Game Stats
  totalGames: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  totalWon: { type: Number, default: 0 },
  winStreak: { type: Number, default: 0 },
  bestWinStreak: { type: Number, default: 0 },
  
  // VIP Levels
  vipLevel: { type: String, default: 'Bronze', enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] },
  experience: { type: Number, default: 0 },
  
  // Transactions
  transactions: [{
    type: { type: String, enum: ['deposit', 'withdraw', 'transfer', 'game_win', 'game_loss', 'bonus'] },
    amount: Number,
    description: String,
    date: { type: Date, default: Date.now }
  }],
  
  // Referrals
  referrals: [{
    telegramId: String,
    username: String,
    date: Date,
    rewardClaimed: { type: Boolean, default: false }
  }],
  
  // Account Status
  isBanned: { type: Boolean, default: false },
  banReason: String,
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate referral code
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = 'REF' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
