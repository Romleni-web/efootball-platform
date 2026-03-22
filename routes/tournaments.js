const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const jwt = require('jsonwebtoken');

// Middleware to verify token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ message: 'No token' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'efootball_secret_key');
        const user = await require('../models/User').findById(decoded.id);
        if (!user) return res.status(401).json({ message: 'Invalid token' });
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// GET /api/tournaments
router.get('/', async (req, res) => {
    try {
        const tournaments = await Tournament.find()
            .populate('registeredPlayers.user', 'username teamName')
            .sort({ createdAt: -1 });
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/tournaments/:id - POPULATED WITH MATCHES
router.get('/:id', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('registeredPlayers.user', 'username teamName efootballId')
            .populate('matches'); // ADDED: Populate matches
        
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/tournaments/:id/register - RACE-CONDITION-PROOF REGISTRATION
router.post('/:id/register', auth, async (req, res) => {
    const tournamentId = req.params.id;
    const userId = req.user._id;

    try {
        // ATOMIC CHECK-AND-UPDATE: Check capacity AND not already registered, then add
        const result = await Tournament.findOneAndUpdate(
            {
                _id: tournamentId,
                status: 'open',
                // Check tournament is not full
                $expr: { $lt: [{ $size: '$registeredPlayers' }, '$maxPlayers'] },
                // Check user is NOT already registered
                'registeredPlayers.user': { $ne: userId }
            },
            {
                $push: {
                    registeredPlayers: {
                        user: userId,
                        paid: false,
                        registeredAt: new Date()
                    }
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        // If findOneAndUpdate returned null, determine why
        if (!result) {
            const tournament = await Tournament.findById(tournamentId);
            
            if (!tournament) {
                return res.status(404).json({ message: 'Tournament not found' });
            }
            
            if (tournament.status !== 'open') {
                return res.status(400).json({ message: `Tournament is ${tournament.status}` });
            }
            
            // Check if already registered
            const alreadyRegistered = tournament.registeredPlayers.some(
                rp => rp.user.toString() === userId.toString()
            );
            if (alreadyRegistered) {
                return res.status(400).json({ message: 'Already registered for this tournament' });
            }
            
            // Must be full
            return res.status(400).json({ message: 'Tournament is full' });
        }

        // SUCCESS
        const currentCount = result.registeredPlayers.length;
        
        res.json({ 
            success: true, 
            message: 'Registered successfully',
            tournament: {
                _id: result._id,
                name: result.name,
                registeredCount: currentCount,
                maxPlayers: result.maxPlayers,
                spotsRemaining: result.maxPlayers - currentCount
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
});

// GET /api/tournaments/:id/bracket
router.get('/:id/bracket', auth, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id).populate({
            path: 'matches',
            populate: [
                { path: 'player1', select: 'username' },
                { path: 'player2', select: 'username' },
                { path: 'winner', select: 'username' }
            ]
        });

        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const isRegistered = tournament.registeredPlayers.some(p => p.user.toString() === req.user.id);
        if (!isRegistered && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You must be registered to view the bracket' });
        }

        const bracket = {};
        tournament.matches.forEach(match => {
            if (!bracket[match.round]) bracket[match.round] = [];
            bracket[match.round].push(match);
        });

        const bracketArray = Object.keys(bracket).sort((a, b) => a - b).map(round => ({
            round: parseInt(round),
            matches: bracket[round].sort((a, b) => a.matchNumber - b.matchNumber)
        }));

        res.json(bracketArray);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CRITICAL: Export the router
module.exports = router;