const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { GAME_TYPES } = require('../utils/stats');

const router = express.Router();

const games = [
  {
    id: 'snake',
    name: 'Snake Game',
    description:
      'Control the snake to eat coins and grow longer. Avoid hitting the walls!',
    pointsPerItem: 10,
    icon: '🐍',
    color: 'bg-green-500',
    status: 'active', // active or comingSoon
    rules: [
      'Use arrow keys or WASD to control the snake',
      'Eat coins to grow longer and earn points',
      'Avoid hitting the walls or yourself',
      'Speed increases as you progress',
    ],
  },
  {
    id: 'fallingFruit',
    name: 'Falling Fruit',
    description: 'Catch good fruits and avoid bad ones. Keep the baby safe!',
    pointsPerItem: 10,
    icon: '🍎',
    color: 'bg-red-500',
    status: 'active', // active or comingSoon
    rules: [
      'Use arrow keys or WASD to move the baby',
      'Catch green fruits (good) to grow bigger',
      'Avoid red fruits (bad) - they end the game',
      'Speed increases over time',
    ],
  },
  {
    id: 'breakBricks',
    name: 'Break Bricks',
    description:
      'Use the paddle to bounce the ball and break all the bricks!',
    pointsPerItem: 10,
    icon: '🧱',
    color: 'bg-blue-500',
    status: 'comingSoon', // active or comingSoon
    rules: [
      'Use left/right arrow keys or A/D to move the paddle',
      'Bounce the ball to break bricks',
      "Don't let the ball fall below the paddle",
      'Each brick broken gives you points',
    ],
  },
  {
    id: 'carRacing',
    name: 'Car Racing',
    description:
      'Control your car to avoid oncoming traffic and earn points!',
    pointsPerItem: 10,
    icon: '🏎️',
    color: 'bg-purple-500',
    status: 'comingSoon', // active or comingSoon
    rules: [
      'Use arrow keys or WASD to control your car',
      'Avoid crashing into oncoming cars',
      'Each car you avoid gives you 10 points',
      'Speed increases over time - stay alert!',
    ],
  },
];

// Get available games
router.get('/', (req, res) => {
  res.json({ games });
});

// Get game details
router.get('/:gameId', (req, res) => {
  const { gameId } = req.params;
  const game = games.find(g => g.id === gameId);
  if (!game) {
    return res.status(404).json({ message: 'Game not found' });
  }

  res.json({ game });
});

// Get user's high score for a specific game
router.get('/:gameId/highscore', auth, async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!GAME_TYPES.includes(gameId)) {
      return res.status(400).json({ message: 'Invalid game type' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const highScore = user.highScores[gameId] || 0;
    const gamesPlayed = user.gamesPlayed[gameId] || 0;

    res.json({
      gameId,
      highScore,
      gamesPlayed,
      walletAddress: user.walletAddress
    });
  } catch (error) {
    console.error('High score error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
