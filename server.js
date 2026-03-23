const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();

// Security middleware FIRST

// CORS - restrict in production
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'])
        : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        dbState: mongoose.connection.readyState 
    });
});

// Load routes with error handling
const routes = [
    { path: '/api/auth', module: './routes/auth' },
    { path: '/api/users', module: './routes/users' },
    { path: '/api/tournaments', module: './routes/tournaments' },
    { path: '/api/payments', module: './routes/payments' },
    { path: '/api/matches', module: './routes/matches' },
    { path: '/api/admin', module: './routes/admin' }
];

for (const route of routes) {
    try {
        app.use(route.path, require(route.module));
        console.log(`✅ Loaded route: ${route.path}`);
    } catch (err) {
        console.error(`❌ Failed to load ${route.path}:`, err.message);
        process.exit(1);
    }
}

// Static files
app.use(express.static(path.join(__dirname, 'frontend')));

// SPA catch-all (must be AFTER API routes)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({ 
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message 
    });
});

const PORT = process.env.PORT || 10000;

// Validate env vars
const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
    console.error('❌ Missing required env vars:', missing.join(', '));
    process.exit(1);
}

// MongoDB connection with event handlers
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ MongoDB Connected');
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
        console.error('MongoDB error:', err);
    });
    mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
    });
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
})
.catch(err => {
    console.error('❌ MongoDB Connection Failed:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});