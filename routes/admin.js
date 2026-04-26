const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const Payment = require('../models/Payment');
const ManualPayout = require('../models/ManualPayout');
const jwt = require('jsonwebtoken');
const { TournamentLogicFactory } = require('../services/tournamentLogic');
const { resolveMatchResult } = require('../services/adminService');
const PrizeDistributionService = require('../services/prizeDistributionService');

// Middleware to verify token
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

// Admin middleware
const adminOnly = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// GET /api/admin/stats
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalTournaments = await Tournament.countDocuments();
        const totalMatches = await Match.countDocuments();
        const totalPayments = await Payment.countDocuments();
        const pendingPayments = await Payment.countDocuments({ status: 'pending' });
        
        const revenueResult = await Payment.aggregate([
            { $match: { status: { $in: ['verified', 'approved'] }, type: 'entry' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRevenue = revenueResult[0]?.total || 0;

        res.json({
            totalUsers,
            totalTournaments,
            totalMatches,
            totalPayments,
            pendingPayments,
            totalRevenue
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/results/pending
router.get('/results/pending', auth, adminOnly, async (req, res) => {
    try {
        const pendingMatches = await Match.find({
            $or: [
                { status: 'disputed' },
                { 
                    status: 'ongoing',
                    'submissions.player1': { $exists: true },
                    'submissions.player2': { $exists: false }
                },
                { 
                    status: 'ongoing',
                    'submissions.player2': { $exists: true },
                    'submissions.player1': { $exists: false }
                }
            ]
        })
        .populate('tournament', 'name')
        .populate('player1', 'username')
        .populate('player2', 'username');

        const formatted = pendingMatches.map(m => ({
            matchId: m._id,
            tournament: m.tournament,
            round: m.round,
            status: m.status,
            player1: {
                user: m.player1,
                submitted: !!m.submissions?.player1,
                submission: m.submissions?.player1
            },
            player2: {
                user: m.player2,
                submitted: !!m.submissions?.player2,
                submission: m.submissions?.player2
            },
            conflicts: m.status === 'disputed' ? {
                score: m.submissions.player1.score1 !== m.submissions.player2.score1 || 
                       m.submissions.player1.score2 !== m.submissions.player2.score2,
                winner: m.submissions.player1.winner !== m.submissions.player2.winner
            } : null,
            disputeReason: m.status === 'disputed' ? 'Results do not match' : null,
            lastActivity: m.updatedAt,
            isStale: (new Date() - m.updatedAt) > (30 * 60 * 1000)
        }));

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/matches/:matchId/advancement-debug
router.get('/matches/:matchId/advancement-debug', auth, adminOnly, async (req, res) => {
    try {
        const match = await Match.findById(req.params.matchId)
            .populate('player1', 'username')
            .populate('player2', 'username')
            .populate('winner', 'username');

        if (!match) return res.status(404).json({ message: 'Match not found' });

        const tournament = await Tournament.findById(match.tournament);
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const allMatches = await Match.find({ tournament: tournament._id })
            .populate('player1', 'username')
            .populate('player2', 'username')
            .populate('winner', 'username');

        tournament.matches = allMatches;

        const logic = TournamentLogicFactory.create(tournament);
        const computedNext = match.winner ? await logic.advanceWinner(match) : null;

        let nextMatchDoc = null;
        if (computedNext?._id) {
            nextMatchDoc = await Match.findById(computedNext._id)
                .populate('player1', 'username')
                .populate('player2', 'username')
                .populate('winner', 'username');
        }

        res.json({
            tournament: {
                id: tournament._id,
                name: tournament.name,
                format: tournament.format
            },
            currentMatch: {
                id: match._id,
                round: match.round,
                matchNumber: match.matchNumber,
                status: match.status,
                player1: match.player1,
                player2: match.player2,
                winner: match.winner
            },
            computedNextMatch: computedNext ? {
                id: computedNext._id,
                round: computedNext.round,
                matchNumber: computedNext.matchNumber,
                status: computedNext.status,
                player1: computedNext.player1,
                player2: computedNext.player2
            } : null,
            persistedNextMatch: nextMatchDoc ? {
                id: nextMatchDoc._id,
                round: nextMatchDoc.round,
                matchNumber: nextMatchDoc.matchNumber,
                status: nextMatchDoc.status,
                player1: nextMatchDoc.player1,
                player2: nextMatchDoc.player2
            } : null
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /api/admin/matches/:matchId/resolve
router.post('/matches/:matchId/resolve', auth, adminOnly, async (req, res) => {
    try {
        const match = await resolveMatchResult(req.params.matchId, req.user, req.body);
        res.json({ success: true, match });

        const io = req.app.get('io');
        if (io) { 
            const { emitBracketUpdate } = require('../socket/bracketEvents'); 
            emitBracketUpdate(io, match.tournament); 
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// POST /api/admin/tournaments - CREATE TOURNAMENT (with isFree & autoStart)
router.post('/tournaments', auth, adminOnly, [
    body('name').trim().notEmpty().withMessage('Tournament name is required'),
    body('startDate').notEmpty().withMessage('Start date is required'),
    body('adminPhone').notEmpty().withMessage('Admin phone is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }

        const { 
            name, 
            description, 
            format, 
            settings,
            entryFee, 
            prizePool,
            prizeDistribution,
            startDate, 
            endDate,
            adminPhone, 
            whatsappLink,
            isFree,
            autoStart
        } = req.body;

        const validFormats = ['single_elimination', 'double_elimination', 'round_robin', 'swiss', 'league'];
        const selectedFormat = format || 'single_elimination';
        
        if (!validFormats.includes(selectedFormat)) {
            return res.status(400).json({ 
                message: `Invalid format. Must be one of: ${validFormats.join(', ')}` 
            });
        }

        const tournamentSettings = {
            maxPlayers: parseInt(settings?.maxPlayers) || 32,
            minPlayers: parseInt(settings?.minPlayers) || 2,
            bestOf: parseInt(settings?.bestOf) || 1,
            bronzeMatch: settings?.bronzeMatch || false,
            rounds: parseInt(settings?.rounds) || 1,
            pointsWin: parseInt(settings?.pointsWin) || 3,
            pointsDraw: parseInt(settings?.pointsDraw) || 1,
            pointsLoss: parseInt(settings?.pointsLoss) || 0,
            swissRounds: parseInt(settings?.swissRounds) || 5
        };

        const tournament = new Tournament({
            name,
            description: description || '',
            format: selectedFormat,
            settings: tournamentSettings,
            entryFee: isFree ? 0 : (parseInt(entryFee) || 0),
            isFree: isFree || false,
            autoStart: autoStart || false,
            prizePool: parseInt(prizePool) || 0,
            prizeDistribution: prizeDistribution || { first: 50, second: 30, third: 20 },
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
            adminPhone,
            whatsappLink: whatsappLink || '',
            createdBy: req.user.id,
            status: 'open',
            registeredPlayers: [],
            matches: [],
            standings: [],
            winners: []
        });

        await tournament.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Tournament created successfully', 
            tournament: {
                _id: tournament._id,
                name: tournament.name,
                format: tournament.format,
                entryFee: tournament.entryFee,
                isFree: tournament.isFree,
                autoStart: tournament.autoStart,
                status: tournament.status,
                createdAt: tournament.createdAt
            }
        });
    } catch (error) {
        console.error('Create tournament error:', error);
        res.status(500).json({ 
            message: error.message || 'Server error creating tournament' 
        });
    }
});

// POST /api/admin/tournaments/:id/start
router.post('/tournaments/:id/start', auth, adminOnly, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('registeredPlayers.user');

        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        if (tournament.bracketGeneratedAt) {
            return res.status(400).json({ message: 'Bracket already generated' });
        }
        if (tournament.status !== 'open') {
            return res.status(400).json({ message: `Tournament is ${tournament.status}` });
        }

        const paidPlayers = tournament.registeredPlayers.filter(p => p.paid);
        
        if (paidPlayers.length < tournament.settings.minPlayers) {
            return res.status(400).json({ 
                message: `Need at least ${tournament.settings.minPlayers} paid players. Currently have ${paidPlayers.length}.` 
            });
        }

        const logic = TournamentLogicFactory.create(tournament);
        const matchInstances = await logic.generateBracket(paidPlayers);

        const savedMatches = await Match.insertMany(matchInstances.map(m => ({
            tournament: tournament._id,
            round: m.round,
            matchNumber: m.matchNumber,
            player1: m.player1,
            player2: m.player2,
            status: 'scheduled',
            winner: m.winner,
            bracket: m.bracket || 'winners',
            isBronzeMatch: m.isBronzeMatch || false
        })));

        tournament.matches = savedMatches.map(m => m._id);
        tournament.bracketGeneratedAt = new Date();
        tournament.status = 'ongoing';
        tournament.currentRound = 1;
        await tournament.save();

        res.json({ 
            success: true,
            message: 'Tournament started successfully',
            tournament: {
                _id: tournament._id,
                format: tournament.format,
                matchesGenerated: savedMatches.length,
                status: tournament.status,
                currentRound: tournament.currentRound
            }
        });
    } catch (error) {
        console.error('Start tournament error:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// POST /api/admin/send-prize
router.post('/send-prize', auth, adminOnly, async (req, res) => {
    try {
        const { tournamentId, userId, amount, mpesaNumber, transactionCode } = req.body;
        
        const payment = new Payment({
            user: userId,
            tournament: tournamentId,
            type: 'prize',
            amount,
            mpesaNumber,
            transactionCode,
            status: 'verified',
            verifiedBy: req.user.id,
            verifiedAt: new Date()
        });

        await payment.save();
        res.json({ success: true, message: 'Prize payment recorded', payment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/admin/payouts/:tournamentId
router.get('/payouts/:tournamentId', auth, adminOnly, async (req, res) => {
    try {
        const payouts = await ManualPayout.find({ tournament: req.params.tournamentId })
            .populate('winner', 'username phoneNumber email')
            .sort({ rank: 1 });
        res.json(payouts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /api/admin/payouts/:payoutId/processing
router.post('/payouts/:payoutId/processing', auth, adminOnly, async (req, res) => {
    try {
        const payout = await PrizeDistributionService.markAsProcessing(req.params.payoutId, req.user._id);
        res.json({ success: true, payout });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /api/admin/payouts/:payoutId/sent
router.post('/payouts/:payoutId/sent', auth, adminOnly, async (req, res) => {
    try {
        const { transactionId, notes } = req.body;
        const payout = await PrizeDistributionService.markAsSent(req.params.payoutId, req.user._id, { transactionId, notes });
        res.json({ success: true, payout });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;