const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const ORACLE_POINT_RATE = Number(process.env.ORACLE_POINT_RATE || 100);

const formatUserResponse = (user) => {
  const totalPoints = user.totalPoints || 0;
  const mintedPoints = user.mintedPoints || 0;
  const availablePoints = Math.max(0, totalPoints - mintedPoints);

  return {
    id: user._id,
    walletAddress: user.walletAddress,
    totalPoints,
    mintedPoints,
    availablePoints,
    mintedOracles: mintedPoints / ORACLE_POINT_RATE,
    highScores: user.highScores,
    gamesPlayed: user.gamesPlayed,
    createdAt: user.createdAt,
    lastPlayed: user.lastPlayed
  };
};

// Register/Login with wallet address
router.post('/login', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ message: 'Wallet address is required' });
    }

    // Validate wallet address format (basic validation)
    if (walletAddress.length < 26 || walletAddress.length > 62) {
      return res.status(400).json({ message: 'Invalid wallet address format' });
    }

    // Check if user exists
    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      // Create new user
      user = new User({
        walletAddress: walletAddress.toLowerCase()
      });
      await user.save();
    } else {
      // Update last played
      user.lastPlayed = new Date();
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(formatUserResponse(user));
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify token
router.get('/verify', auth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
