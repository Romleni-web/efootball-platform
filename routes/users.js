const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const jwt = require('jsonwebtoken');

// Middleware to verify token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ message: 'No token' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'efootball_secret_key');
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(401).json({ message: 'Invalid token' });
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// GET /api/users/stats
router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('points wins losses');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/tournaments
router.get('/tournaments', auth, async (req, res) => {
    try {
        const tournaments = await Tournament.find({
            'registeredPlayers.user': req.user.id
        }).populate('registeredPlayers.user', 'username teamName');
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/matches/upcoming
router.get('/matches/upcoming', auth, async (req, res) => {
    try {
        const matches = await Match.find({
            $or: [{ player1: req.user.id }, { player2: req.user.id }],
            status: { $in: ['scheduled', 'ongoing'] },
            winner: null
        })
        .populate('tournament', 'name')
        .populate('player1', 'username efootballId')
        .populate('player2', 'username efootballId');

        const formattedMatches = matches.map(match => {
            const isPlayer1 = match.player1?._id.toString() === req.user.id;
            return {
                _id: match._id,
                tournament: match.tournament,
                opponent: isPlayer1 ? match.player2 : match.player1
            };
        });

        res.json(formattedMatches);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/matches/history
router.get('/matches/history', auth, async (req, res) => {
    try {
        const matches = await Match.find({
            $or: [{ player1: req.user.id }, { player2: req.user.id }],
            status: 'completed'
        })
        .populate('tournament', 'name')
        .populate('player1', 'username')
        .populate('player2', 'username')
        .sort({ updatedAt: -1 });

        res.json(matches);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/users/profile
router.patch('/profile', auth, [
    body('efootballId').optional().trim().isLength({ min: 3 }),
    body('phoneNumber').optional().trim()
], async (req, res) => {
    try {
        const { efootballId, phoneNumber } = req.body;
        const updateData = {};

        if (efootballId) {
            const existingUser = await User.findOne({ efootballId, _id: { $ne: req.user.id } });
            if (existingUser) {
                return res.status(400).json({ message: 'eFootball ID already taken' });
            }
            updateData.efootballId = efootballId;
        }

        if (phoneNumber) updateData.phoneNumber = phoneNumber;

        const user = await User.findByIdAndUpdate(req.user.id, { $set: updateData }, { new: true }).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/search/:efootballId
router.get('/search/:efootballId', auth, async (req, res) => {
    try {
        const user = await User.findOne({ efootballId: req.params.efootballId }).select('username teamName efootballId points wins losses');
        if (!user) return res.status(404).json({ message: 'Player not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const players = await User.find({ role: 'player' })
            .select('username teamName efootballId points wins losses')
            .sort({ points: -1, wins: -1 })
            .limit(100);
        res.json(players);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CRITICAL: Export the router
module.exports = router;