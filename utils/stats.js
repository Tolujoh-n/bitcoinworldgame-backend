const mongoose = require('mongoose');
const GameScore = require('../models/GameScore');
const User = require('../models/User');

const GAME_TYPES = ['snake', 'fallingFruit', 'breakBricks', 'carRacing'];

const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (error) {
    return null;
  }
};

const normalizeLeaderboardUser = (userDoc) => {
  const gamesPlayed = userDoc.gamesPlayed || {};
  const highScores = userDoc.highScores || {};
  const mintedPoints = userDoc.mintedPoints || 0;
  const totalPoints = userDoc.totalPoints || 0;
  const availablePoints = Math.max(0, totalPoints - mintedPoints);

  const totalGames = Object.values(gamesPlayed).reduce(
    (sum, value) => sum + (typeof value === 'number' ? value : 0),
    0
  );

  return {
    id: userDoc._id?.toString() || null,
    walletAddress: userDoc.walletAddress,
    totalPoints,
    mintedPoints,
    availablePoints,
    mintedOracles: mintedPoints / (process.env.ORACLE_POINT_RATE ? Number(process.env.ORACLE_POINT_RATE) : 100),
    totalGames,
    gamesPlayed,
    highScores,
  };
};

const getOverallLeaderboard = async (limit = 10) => {
  const users = await User.find({})
    .sort({ totalPoints: -1, createdAt: 1 })
    .limit(limit)
    .select('walletAddress totalPoints gamesPlayed highScores')
    .lean();

  return users.map(normalizeLeaderboardUser);
};

const getGameLeaderboard = async (gameType, limit = 10) => {
  const scores = await GameScore.find({ gameType })
    .sort({ score: -1, playedAt: 1 })
    .limit(limit)
    .select('walletAddress score points playedAt')
    .lean();

  return scores.map((scoreDoc, index) => ({
    rank: index + 1,
    walletAddress: scoreDoc.walletAddress,
    score: scoreDoc.score,
    points: scoreDoc.points,
    playedAt: scoreDoc.playedAt,
  }));
};

const getGlobalGameStats = async () => {
  const stats = {};

  for (const gameType of GAME_TYPES) {
    const topScore = await GameScore.findOne({ gameType })
      .sort({ score: -1, playedAt: 1 })
      .populate('user', 'walletAddress')
      .lean();

    if (topScore) {
      stats[gameType] = {
        highestScore: topScore.score,
        points: topScore.points,
        topPlayer: {
          walletAddress:
            topScore.walletAddress ||
            topScore.user?.walletAddress ||
            null,
          playedAt: topScore.playedAt,
        },
      };
    } else {
      stats[gameType] = {
        highestScore: 0,
        points: 0,
        topPlayer: {
          walletAddress: null,
          playedAt: null,
        },
      };
    }
  }

  return stats;
};

const getUserGameStats = async (userId) => {
  const objectId = toObjectId(userId);
  if (!objectId) {
    return GAME_TYPES.reduce((acc, gameType) => {
      acc[gameType] = {
        totalGames: 0,
        highScore: 0,
        totalPoints: 0,
        averageScore: 0,
      };
      return acc;
    }, {});
  }

  const aggregateStats = await GameScore.aggregate([
    { $match: { user: objectId } },
    {
      $group: {
        _id: '$gameType',
        totalGames: { $sum: 1 },
        highScore: { $max: '$score' },
        totalPoints: { $sum: '$points' },
        averageScore: { $avg: '$score' },
      },
    },
  ]);

  const statsByGame = aggregateStats.reduce((acc, stat) => {
    acc[stat._id] = {
      totalGames: stat.totalGames,
      highScore: stat.highScore,
      totalPoints: stat.totalPoints,
      averageScore: stat.averageScore || 0,
    };
    return acc;
  }, {});

  return GAME_TYPES.reduce((acc, gameType) => {
    const stat = statsByGame[gameType];
    acc[gameType] = stat
      ? {
          totalGames: stat.totalGames,
          highScore: stat.highScore,
          totalPoints: stat.totalPoints,
          averageScore: Number(stat.averageScore?.toFixed(1) || 0),
        }
      : {
          totalGames: 0,
          highScore: 0,
          totalPoints: 0,
          averageScore: 0,
        };
    return acc;
  }, {});
};

const normalizeGameMap = (source = {}) => {
  const normalized = {};
  for (const gameType of GAME_TYPES) {
    normalized[gameType] =
      typeof source[gameType] === 'number' ? source[gameType] : 0;
  }

  for (const [key, value] of Object.entries(source)) {
    if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
      normalized[key] = value;
    }
  }

  return normalized;
};

const buildUserSummary = (userDoc) => {
  if (!userDoc) return null;

  const gamesPlayed = normalizeGameMap(userDoc.gamesPlayed || {});
  const highScores = normalizeGameMap(userDoc.highScores || {});
  const mintedPoints = userDoc.mintedPoints || 0;
  const totalPoints = userDoc.totalPoints || 0;
  const pointRate = process.env.ORACLE_POINT_RATE ? Number(process.env.ORACLE_POINT_RATE) : 100;
  const availablePoints = Math.max(0, totalPoints - mintedPoints);
  const totalGames = Object.values(gamesPlayed).reduce(
    (sum, value) => sum + (typeof value === 'number' ? value : 0),
    0
  );

  return {
    id: userDoc._id?.toString(),
    walletAddress: userDoc.walletAddress,
    totalPoints,
    mintedPoints,
    availablePoints,
    mintedOracles: mintedPoints / pointRate,
    gamesPlayed,
    highScores,
    totalGames,
  };
};

module.exports = {
  GAME_TYPES,
  getOverallLeaderboard,
  getGameLeaderboard,
  getGlobalGameStats,
  getUserGameStats,
  buildUserSummary,
};

