// ── Create logs directory if it doesn't exist ──────────────────────────────
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// ── Load environment variables ────────────────────────────────────────────
require('dotenv').config();

// ── Core imports ──────────────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const session = require('express-session');

// ── App specific imports ──────────────────────────────────────────────────
const passport = require('./config/passport');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

// ── Routes ────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');

// ── App init ───────────────────────────────────────────────────────────────
const app = express();

// ── Trust proxy (REQUIRED for Render + secure cookies) ─────────────────────
app.set('trust proxy', 1);

// ── Connect to MongoDB ─────────────────────────────────────────────────────
connectDB();

// ── CORS configuration (Local + Netlify) ───────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',       // Vite local
  'http://localhost:3000',       // fallback local
  process.env.FRONTEND_URL       // Netlify URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ── Body parsers ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Session configuration ─────────────────────────────────────────────────
app.use(session({
  name: 'studyshala.sid',
  secret: process.env.SESSION_SECRET || 'csms-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ── Passport init ─────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ── Request logging ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Error Handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
});

// ── Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`❤️  Health check → /api/health\n`);
});

// ── Process safety ─────────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

module.exports = app;
