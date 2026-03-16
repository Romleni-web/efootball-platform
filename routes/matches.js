const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ message: 'No token' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'efootball_secret_key');
        const user = await User.findById(decoded.id);
        if (!user) return res.status(401).json({ message: 'Invalid token' });
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const adminOnly = async (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    next();
};

// POST /api/matches/:id/result
router.post('/:id/result', auth, require('../middleware/upload').single('screenshot'), [
    body('score1').isInt({ min: 0 }),
    body('score2').isInt({ min: 0 })
], async (req, res) => {
    try {
        const { score1, score2 } = req.body;
        const match = await Match.findById(req.params.id);

        if (!match) return res.status(404).json({ message: 'Match not found' });

        const isPlayer1 = match.player1?.toString() === req.user.id;
        const isPlayer2 = match.player2?.toString() === req.user.id;

        if (!isPlayer1 && !isPlayer2) return res.status(403).json({ message: 'Not authorized' });
        if (match.status === 'completed') return res.status(400).json({ message: 'Match already completed' });

        match.score1 = parseInt(score1);
        match.score2 = parseInt(score2);
        match.status = 'ongoing';
        if (req.file) match.screenshotPath = req.file.path;
        await match.save();

        res.json({ message: 'Result submitted. Waiting for admin verification.', match: { id: match._id, status: match.status } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/matches/:id/verify
router.post('/:id/verify', auth, adminOnly, async (req, res) => {
    try {
        const { winnerId } = req.body;
        const match = await Match.findById(req.params.id);

        if (!match) return res.status(404).json({ message: 'Match not found' });
        if (match.status === 'completed') return res.status(400).json({ message: 'Match already completed' });

        match.winner = winnerId;
        match.status = 'completed';
        await match.save();

        const loserId = match.player1.toString() === winnerId ? match.player2 : match.player1;
        await User.findByIdAndUpdate(winnerId, { $inc: { wins: 1, points: 3 } });
        await User.findByIdAndUpdate(loserId, { $inc: { losses: 1 } });

        if (match.nextMatch) {
            const nextMatch = await Match.findById(match.nextMatch);
            if (!nextMatch.player1) nextMatch.player1 = winnerId;
            else nextMatch.player2 = winnerId;
            await nextMatch.save();
        } else {
            await Tournament.findByIdAndUpdate(match.tournament, { status: 'finished' });
        }

        res.json({ message: 'Match verified successfully', match: { id: match._id, winner: winnerId, status: 'completed' } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CRITICAL: Export the router
module.exports = router;