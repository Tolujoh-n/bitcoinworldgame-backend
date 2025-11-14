const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Default allowed origins (always include these)
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://bitcoinworld-game.vercel.app',
];

// Get additional origins from environment variable
const envOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];

// Combine all allowed origins
const allowedOrigins = [...defaultOrigins, ...envOrigins];

// CORS configuration - must use a function when credentials: true
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Remove trailing slash for comparison
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.replace(/\/$/, '');
      return origin === allowed || 
             normalizedOrigin === normalizedAllowed ||
             normalizedOrigin === allowed ||
             origin === normalizedAllowed;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    socket.user = decoded;

    if (decoded.userId) {
      socket.join(decoded.userId);
    }

    if (decoded.walletAddress) {
      socket.join(decoded.walletAddress);
    }

    next();
  } catch (error) {
    console.warn('Socket auth failed:', error.message);
    next();
  }
});

io.on('connection', (socket) => {
  const identifier = socket.user?.walletAddress || socket.id;
  console.log('Socket connected:', identifier);

  socket.emit('connection:ack', {
    connected: true,
    walletAddress: socket.user?.walletAddress || null,
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', identifier, reason);
  });
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set!');
  console.error('Please set MONGODB_URI in your Render environment variables.');
  if (process.env.NODE_ENV === 'production') {
    console.error('Cannot start server without MongoDB connection in production.');
    process.exit(1);
  } else {
    console.warn('Using default localhost MongoDB for development...');
  }
}

// Build MongoDB URI - add database name if not present
let mongoUri = MONGODB_URI || 'mongodb://localhost:27017/bitcoinworld-game';

// If using MongoDB Atlas (mongodb+srv://) and no database name is specified, add it
if (mongoUri.includes('mongodb+srv://') && !mongoUri.match(/\/[^/?]+(\?|$)/)) {
  // Add database name before query parameters
  if (mongoUri.includes('?')) {
    mongoUri = mongoUri.replace('?', '/bitcoinworld-game?');
  } else {
    mongoUri = mongoUri + '/bitcoinworld-game';
  }
} else if (mongoUri.includes('mongodb://') && !mongoUri.match(/\/[^/?]+(\?|$)/) && !mongoUri.includes('localhost')) {
  // For regular mongodb:// connections (not localhost), add database name
  if (mongoUri.includes('?')) {
    mongoUri = mongoUri.replace('?', '/bitcoinworld-game?');
  } else {
    mongoUri = mongoUri + '/bitcoinworld-game';
  }
}

console.log('Connecting to MongoDB...');

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).catch((err) => {
  console.error('MongoDB connection failed:', err.message);
  if (process.env.NODE_ENV === 'production') {
    console.error('Server cannot start without MongoDB connection.');
    process.exit(1);
  }
});

mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

// Import routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const scoreRoutes = require('./routes/scores');
const leaderboardRoutes = require('./routes/leaderboard');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
