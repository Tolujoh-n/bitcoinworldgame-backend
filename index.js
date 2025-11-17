const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config({ path: './config.env' });

const app = express();
const server = http.createServer(app);


const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map(origin => origin.trim());

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
let mongoUri = MONGODB_URI || 'mongodb+srv://tolujohnofficial_db_user:ijTgl8yrzbqGmqq5@cluster0.frwrfef.mongodb.net/bitcoinworld-game?appName=Cluster0';

// Validate MongoDB URI format
if (mongoUri && !mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
  console.error('ERROR: Invalid MongoDB URI format. Must start with "mongodb://" or "mongodb+srv://"');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('Falling back to default localhost MongoDB...');
    mongoUri = 'mongodb+srv://tolujohnofficial_db_user:ijTgl8yrzbqGmqq5@cluster0.frwrfef.mongodb.net/bitcoinworld-game?appName=Cluster0';
  }
}

console.log('Connecting to MongoDB...');

if (mongoUri) {
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
} else {
  console.warn('⚠️  No MongoDB URI provided. Some features may not work.');
}

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
  res.json({ 
    message: 'Server is running!',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
