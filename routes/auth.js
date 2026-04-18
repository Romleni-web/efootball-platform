const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { sendResetEmail } = require('../services/emailService');

// Generate JWT
const generateToken = (userId) => {
    return jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET || 'efootball_secret_key', {
        expiresIn: '7d'
    });
};

// POST /api/auth/register
router.post('/register', [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('teamName').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { username, email, password, teamName } = req.body;

        let user = await User.findOne({ $or: [{ email }, { username }] });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const isAdmin = email === process.env.ADMIN_EMAIL;
        user = new User({ 
            username, 
            email, 
            password, 
            teamName: teamName || '',
            role: isAdmin ? 'admin' : 'player'
        });

        // CRITICAL FIX: Save user to database before generating token
        await user.save();

        const token = generateToken(user._id);

        res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                teamName: user.teamName,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user._id);

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                teamName: user.teamName,
                role: user.role,
                efootballId: user.efootballId,
                points: user.points,
                wins: user.wins,
                losses: user.losses
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { email } = req.body;
        const user = await User.findOne({ email });

        // Always return a success message to avoid account enumeration.
        if (!user) {
            return res.json({
                message: 'If that email exists, a password reset link has been generated.'
            });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save();

        const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:10000';
        const resetLink = `${appBaseUrl}/?page=reset-password&token=${rawToken}`;

        try {
            await sendResetEmail(user.email, resetLink);
        } catch (mailError) {
            console.error('Email sending failed:', mailError);
            // We still return success to the client to avoid enumeration
        }

        res.json({
            message: 'If that email exists, a password reset link has been sent.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { token, password } = req.body;
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Reset token is invalid or expired' });
        }

        user.password = password;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.json({ message: 'Password reset successful. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ message: 'No token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'efootball_secret_key');

        // Handle both id and _id in token payload
        const userId = decoded.id || decoded._id || decoded.userId;
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Token is not valid' });
        }

        res.json(user);
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
});

// CRITICAL: Export the router
module.exports = router;