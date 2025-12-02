const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  telegramId: { type: String, required: true },
  
  // Transaction Details
  type: { 
    type: String, 
    enum: ['deposit', 'withdraw', 'transfer', 'game_win', 'game_loss', 'bonus', 'refund'],
    required: true
  },
  amount: { type: Number, required: true },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Related Data
  gameId: String,
  recipientId: String, // For transfers
  paymentMethod: String,
  paymentProof: String, // URL to screenshot
  
  // Metadata
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('Transaction', transactionSchema);
