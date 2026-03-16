const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const Payment = require('../models/Payment');
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

// POST /api/admin/tournaments
router.post('/tournaments', auth, adminOnly, [
    body('name').trim().notEmpty(),
    body('entryFee').isInt({ min: 0 }),
    body('maxPlayers').isInt({ min: 2 }),
    body('startDate').isISO8601(),
    body('adminPhone').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

        const { name, description, entryFee, maxPlayers, startDate, adminPhone, whatsappLink } = req.body;

        const tournament = new Tournament({
            name,
            description,
            entryFee,
            maxPlayers,
            startDate: new Date(startDate),
            adminPhone,
            whatsappLink,
            createdBy: req.user.id,
            prizePool: 0
        });

        await tournament.save();
        res.status(201).json({ message: 'Tournament created successfully', tournament });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/tournaments/:id/start
router.post('/tournaments/:id/start', auth, adminOnly, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id).populate('registeredPlayers.user');

        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        if (tournament.status !== 'open') return res.status(400).json({ message: 'Tournament already started or finished' });

        const paidPlayers = tournament.registeredPlayers.filter(p => p.paid).map(p => p.user);
        if (paidPlayers.length < 2) return res.status(400).json({ message: 'Need at least 2 paid players to start' });

        const shuffled = [...paidPlayers].sort(() => Math.random() - 0.5);
        const numPlayers = shuffled.length;
        const rounds = Math.ceil(Math.log2(numPlayers));
        const bracketSize = Math.pow(2, rounds);

        const matches = [];
        const matchesByRound = {};

        for (let r = 1; r <= rounds; r++) {
            matchesByRound[r] = [];
            const numMatches = Math.pow(2, rounds - r);
            
            for (let m = 1; m <= numMatches; m++) {
                const match = new Match({
                    tournament: tournament._id,
                    round: r,
                    matchNumber: m,
                    player1: null,
                    player2: null,
                    status: 'scheduled'
                });
                await match.save();
                matchesByRound[r].push(match);
                matches.push(match);
            }
        }

        for (let r = 1; r < rounds; r++) {
            const currentRoundMatches = matchesByRound[r];
            const nextRoundMatches = matchesByRound[r + 1];
            
            for (let i = 0; i < currentRoundMatches.length; i++) {
                const nextMatchIndex = Math.floor(i / 2);
                currentRoundMatches[i].nextMatch = nextRoundMatches[nextMatchIndex]._id;
                await currentRoundMatches[i].save();
            }
        }

        const firstRoundMatches = matchesByRound[1];
        for (let i = 0; i < shuffled.length; i += 2) {
            const matchIndex = Math.floor(i / 2);
            if (firstRoundMatches[matchIndex]) {
                firstRoundMatches[matchIndex].player1 = shuffled[i]._id;
                if (shuffled[i + 1]) {
                    firstRoundMatches[matchIndex].player2 = shuffled[i + 1]._id;
                } else {
                    firstRoundMatches[matchIndex].player2 = null;
                    firstRoundMatches[matchIndex].winner = shuffled[i]._id;
                    firstRoundMatches[matchIndex].status = 'completed';
                    
                    if (firstRoundMatches[matchIndex].nextMatch) {
                        const nextMatch = await Match.findById(firstRoundMatches[matchIndex].nextMatch);
                        if (!nextMatch.player1) nextMatch.player1 = shuffled[i]._id;
                        else nextMatch.player2 = shuffled[i]._id;
                        await nextMatch.save();
                    }
                }
                await firstRoundMatches[matchIndex].save();
            }
        }

        tournament.status = 'ongoing';
        tournament.matches = matches.map(m => m._id);
        await tournament.save();

        res.json({
            message: 'Tournament started successfully',
            tournament: { id: tournament._id, status: tournament.status, totalMatches: matches.length, players: paidPlayers.length }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/stats
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'player' });
        const totalTournaments = await Tournament.countDocuments();
        const pendingPayments = await Payment.countDocuments({ status: 'pending' });
        
        const revenue = await Payment.aggregate([
            { $match: { status: 'verified', type: 'entry' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({ totalUsers, totalTournaments, pendingPayments, totalRevenue: revenue[0]?.total || 0 });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/send-prize
router.post('/send-prize', auth, adminOnly, [
    body('userId').notEmpty(),
    body('tournamentId').notEmpty(),
    body('amount').isInt({ min: 0 }),
    body('mpesaNumber').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

        const { userId, tournamentId, amount, mpesaNumber } = req.body;

        const payment = new Payment({
            user: userId,
            tournament: tournamentId,
            type: 'prize',
            amount,
            mpesaNumber,
            status: 'verified',
            verifiedBy: req.user.id,
            verifiedAt: new Date()
        });

        await payment.save();
        res.json({ message: 'Prize payment recorded successfully', payment: { id: payment._id, amount, status: 'verified' } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CRITICAL: Export the router
module.exports = router;