const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger')('UsersRoute');

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
        const user = await User.findById(req.user._id).select('points wins losses');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/tournaments
router.get('/tournaments', auth, async (req, res) => {
    try {
        const tournaments = await Tournament.find({
            'registeredPlayers.user': req.user._id
        }).populate('registeredPlayers.user', 'username teamName');
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/matches/upcoming - FIXED
router.get('/matches/upcoming', auth, async (req, res) => {
    try {
        const userId = req.user._id.toString(); // ✅ FIXED: Use _id not id
        
        const matches = await Match.find({
            $or: [{ player1: req.user._id }, { player2: req.user._id }], // ✅ Use _id
            status: { $in: ['scheduled', 'ongoing'] },
            winner: null
        })
        .populate('tournament', 'name')
        .populate('player1', 'username efootballId')
        .populate('player2', 'username efootballId');

        const formattedMatches = matches.map(match => {
            const isPlayer1 = match.player1?._id.toString() === userId; // ✅ Compare with userId
            return {
                _id: match._id,
                tournament: match.tournament,
                opponent: isPlayer1 ? match.player2 : match.player1,
                isPlayer1: isPlayer1,
                myEfootballId: isPlayer1 ? match.player1?.efootballId : match.player2?.efootballId,
                opponentEfootballId: isPlayer1 ? match.player2?.efootballId : match.player1?.efootballId,
                round: match.round,
                matchNumber: match.matchNumber,
                status: match.status
            };
        });

        res.json(formattedMatches);
    } catch (error) {
        logger.error('Upcoming matches error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/matches/history
router.get('/matches/history', auth, async (req, res) => {
    try {
        const matches = await Match.find({
            $or: [{ player1: req.user._id }, { player2: req.user._id }],
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
            const existingUser = await User.findOne({ efootballId, _id: { $ne: req.user._id } });
            if (existingUser) {
                return res.status(400).json({ message: 'eFootball ID already taken' });
            }
            updateData.efootballId = efootballId;
        }

        if (phoneNumber) updateData.phoneNumber = phoneNumber;

        const user = await User.findByIdAndUpdate(req.user._id, { $set: updateData }, { new: true }).select('-password');
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

// GET /api/users/leaderboard - CALCULATED FROM ACTUAL MATCHES
router.get('/leaderboard', async (req, res) => {
    try {
        // Aggregate stats from all completed matches
        const playerStats = await Match.aggregate([
            // Only completed matches
            { $match: { status: 'completed', winner: { $ne: null } } },
            
            // Group by player1 (when they were player1)
            {
                $facet: {
                    asPlayer1: [
                        { $group: {
                            _id: '$player1',
                            played: { $sum: 1 },
                            wins: { $sum: { $cond: [{ $eq: ['$winner', '$player1'] }, 1, 0] } },
                            goalsFor: { $sum: '$score1' },
                            goalsAgainst: { $sum: '$score2' }
                        }}
                    ],
                    asPlayer2: [
                        { $group: {
                            _id: '$player2',
                            played: { $sum: 1 },
                            wins: { $sum: { $cond: [{ $eq: ['$winner', '$player2'] }, 1, 0] } },
                            goalsFor: { $sum: '$score2' },
                            goalsAgainst: { $sum: '$score1' }
                        }}
                    ]
                }
            }
        ]);

        // Combine stats
        const statsMap = {};
        
        // Process player1 stats
        (playerStats[0]?.asPlayer1 || []).forEach(s => {
            if (!s._id) return;
            statsMap[s._id.toString()] = {
                played: s.played,
                wins: s.wins,
                losses: s.played - s.wins,
                goalsFor: s.goalsFor || 0,
                goalsAgainst: s.goalsAgainst || 0
            };
        });

        // Process player2 stats and merge
        (playerStats[0]?.asPlayer2 || []).forEach(s => {
            if (!s._id) return;
            const id = s._id.toString();
            if (statsMap[id]) {
                statsMap[id].played += s.played;
                statsMap[id].wins += s.wins;
                statsMap[id].losses += s.played - s.wins;
                statsMap[id].goalsFor += s.goalsFor || 0;
                statsMap[id].goalsAgainst += s.goalsAgainst || 0;
            } else {
                statsMap[id] = {
                    played: s.played,
                    wins: s.wins,
                    losses: s.played - s.wins,
                    goalsFor: s.goalsFor || 0,
                    goalsAgainst: s.goalsAgainst || 0
                };
            }
        });

        // Get user details and calculate points
        const userIds = Object.keys(statsMap);
        const users = await User.find({ _id: { $in: userIds }, role: 'player' })
            .select('username teamName efootballId');

        const leaderboard = users.map(u => {
            const s = statsMap[u._id.toString()];
            const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
            const goalDiff = s.goalsFor - s.goalsAgainst;
            
            // Points system: 3 per win, 1 per loss (participation)
            const points = (s.wins * 3) + (s.losses * 1);

            return {
                _id: u._id,
                username: u.username,
                teamName: u.teamName,
                efootballId: u.efootballId,
                played: s.played,
                wins: s.wins,
                losses: s.losses,
                winRate,
                goalsFor: s.goalsFor,
                goalsAgainst: s.goalsAgainst,
                goalDifference: goalDiff,
                points
            };
        });

        // Sort by points, then win rate, then goal difference
        leaderboard.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            return b.goalDifference - a.goalDifference;
        });

        // Add rank
        leaderboard.forEach((p, i) => p.rank = i + 1);

        res.json(leaderboard);
    } catch (error) {
        logger.error('Leaderboard error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// CRITICAL: Export the router
module.exports = router;