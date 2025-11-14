const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  mintedPoints: {
    type: Number,
    default: 0
  },
  gamesPlayed: {
    snake: { type: Number, default: 0 },
    fallingFruit: { type: Number, default: 0 },
    breakBricks: { type: Number, default: 0 },
    carRacing: { type: Number, default: 0 },
    clickCounter: { type: Number, default: 0 }
  },
  highScores: {
    snake: { type: Number, default: 0 },
    fallingFruit: { type: Number, default: 0 },
    breakBricks: { type: Number, default: 0 },
    carRacing: { type: Number, default: 0 },
    clickCounter: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastPlayed: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
userSchema.index({ walletAddress: 1 });
userSchema.index({ totalPoints: -1 });
userSchema.index({ mintedPoints: -1 });

module.exports = mongoose.model('User', userSchema);
