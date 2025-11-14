const mongoose = require('mongoose');

const gameScoreSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  walletAddress: {
    type: String,
    required: true
  },
  gameType: {
    type: String,
    required: true,
    enum: ['snake', 'fallingFruit', 'breakBricks', 'carRacing', 'clickCounter']
  },
  score: {
    type: Number,
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  gameData: {
    // Additional game-specific data
    level: Number,
    duration: Number,
    itemsCollected: Number,
    // Add more fields as needed for each game
  },
  playedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better query performance
gameScoreSchema.index({ user: 1, gameType: 1 });
gameScoreSchema.index({ walletAddress: 1, gameType: 1 });
gameScoreSchema.index({ gameType: 1, score: -1 });
gameScoreSchema.index({ playedAt: -1 });

module.exports = mongoose.model('GameScore', gameScoreSchema);
