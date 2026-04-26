// routes/tournaments.js - COMPLETE WITH isFree, autoStart, and registration validation
const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { TournamentLogicFactory } = require('../services/tournamentLogic');
const adminService = require('../services/adminService');

// Auth middleware
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
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Auto-start tournament helper function
async function startTournamentAutomatically(tournamentId, req) {
    const tournament = await Tournament.findById(tournamentId)
        .populate('registeredPlayers.user');
    
    if (!tournament) return null;
    if (tournament.status !== 'open') return null;
    if (tournament.bracketGeneratedAt) return null;
    
    const paidPlayers = tournament.registeredPlayers.filter(p => p.paid);
    
    if (paidPlayers.length < tournament.settings.minPlayers) {
        console.log(`Tournament ${tournament.name}: Not enough players (${paidPlayers.length}/${tournament.settings.minPlayers})`);
        return null;
    }
    
    const logic = TournamentLogicFactory.create(tournament);
    const matchInstances = await logic.generateBracket(paidPlayers);
    
    const savedMatches = await Match.insertMany(matchInstances.map(m => ({
        tournament: tournament._id,
        round: m.round,
        matchNumber: m.matchNumber,
        player1: m.player1,
        player2: m.player2,
        status: m.status,
        winner: m.winner,
        bracket: m.bracket || 'winners',
        isBronzeMatch: m.isBronzeMatch || false
    })));
    
    tournament.matches = savedMatches.map(m => m._id);
    tournament.bracketGeneratedAt = new Date();
    tournament.status = 'ongoing';
    tournament.currentRound = 1;
    await tournament.save();
    
    console.log(`Tournament ${tournament.name} auto-started with ${savedMatches.length} matches`);
    
    const io = req.app?.get('io');
    if (io) {
        io.emit('tournament-started', { tournamentId: tournament._id, name: tournament.name });
    }
    
    return tournament;
}

// GET all tournaments - PUBLIC
router.get('/', async (req, res) => {
    try {
        const tournaments = await Tournament.find()
            .populate('registeredPlayers.user', 'username teamName')
            .sort({ createdAt: -1 });
        res.json(tournaments);
    } catch (error) {
        console.error('Get tournaments error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET single tournament - PUBLIC
router.get('/:id', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('registeredPlayers.user', 'username teamName efootballId')
            .populate({
                path: 'matches',
                populate: [
                    { path: 'player1', select: 'username teamName efootballId' },
                    { path: 'player2', select: 'username teamName efootballId' },
                    { path: 'winner', select: 'username' }
                ]
            })
            .populate('standings.player', 'username teamName');
        
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        res.json(tournament);
    } catch (error) {
        console.error('Get tournament error:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST create tournament - ADMIN ONLY (with isFree and autoStart)
router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const {
            name, description, format, settings,
            entryFee, prizePool, prizeDistribution,
            startDate, endDate, adminPhone, whatsappLink,
            isFree, autoStart  // NEW fields
        } = req.body;

        const tournament = new Tournament({
            name,
            description,
            format: format || 'single_elimination',
            settings: {
                maxPlayers: settings?.maxPlayers || 32,
                bestOf: settings?.bestOf || 1,
                bronzeMatch: settings?.bronzeMatch || false,
                rounds: settings?.rounds || 1,
                pointsWin: settings?.pointsWin || 3,
                pointsDraw: settings?.pointsDraw || 1,
                pointsLoss: settings?.pointsLoss || 0,
                swissRounds: settings?.swissRounds || 5,
                minPlayers: settings?.minPlayers || 2,
                ...settings
            },
            entryFee: isFree ? 0 : (parseInt(entryFee) || 0),
            isFree: isFree || false,
            autoStart: autoStart || false,
            prizePool: prizePool || 0,
            prizeDistribution: prizeDistribution || { first: 50, second: 30, third: 20 },
            startDate,
            endDate,
            adminPhone,
            whatsappLink,
            createdBy: req.user._id,
            status: 'open'
        });

        await tournament.save();
        res.status(201).json(tournament);
    } catch (error) {
        console.error('Create tournament error:', error);
        res.status(400).json({ message: error.message });
    }
});

// POST generate bracket - ADMIN ONLY
router.post('/:id/generate-bracket', auth, adminOnly, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('registeredPlayers.user');

        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        if (tournament.bracketGeneratedAt) {
            return res.status(400).json({ message: 'Bracket already generated' });
        }

        const paidPlayers = tournament.registeredPlayers.filter(p => p.paid);
        
        if (paidPlayers.length < tournament.settings.minPlayers) {
            return res.status(400).json({ 
                message: `Need at least ${tournament.settings.minPlayers} paid players` 
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
            status: m.status,
            winner: m.winner,
            bracket: m.bracket || 'winners',
            isBronzeMatch: m.isBronzeMatch || false,
            nextMatch: m.nextMatch,
            losersNextMatch: m.losersNextMatch,
            sourceMatches: m.sourceMatches
        })));

        tournament.matches = savedMatches.map(m => m._id);
        tournament.bracketGeneratedAt = new Date();
        tournament.status = 'ongoing';
        tournament.currentRound = 1;
        await tournament.save();

        let roundsProcessed = 0;
        let matchesToAdvance = savedMatches.filter(m => m.status === 'completed' && m.winner);
        
        while (matchesToAdvance.length > 0 && roundsProcessed < 10) {
            const currentMatches = [...matchesToAdvance];
            matchesToAdvance = [];
            for (const match of currentMatches) {
                const nextMatch = await logic.advanceWinner(match);
                if (nextMatch && nextMatch.status === 'completed' && nextMatch.winner) {
                    matchesToAdvance.push(nextMatch);
                }
            }
            roundsProcessed++;
        }

        res.json({ 
            success: true,
            tournament: {
                _id: tournament._id,
                format: tournament.format,
                matchesGenerated: savedMatches.length,
                status: tournament.status
            },
            matches: savedMatches 
        });
    } catch (error) {
        console.error('Generate bracket error:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST register for tournament - AUTH REQUIRED (with free tournament support)
router.post('/:id/register', auth, async (req, res) => {
    const tournamentId = req.params.id;
    const userId = req.user._id;

    try {
        const tournament = await Tournament.findById(tournamentId);
        
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found' });
        }
        
        if (tournament.status !== 'open') {
            return res.status(400).json({ message: `Tournament is ${tournament.status}. Registration closed.` });
        }
        
        const alreadyRegistered = tournament.registeredPlayers.some(
            p => p.user.toString() === userId.toString()
        );
        
        if (alreadyRegistered) {
            return res.status(400).json({ message: 'Already registered for this tournament' });
        }
        
        if (tournament.registeredPlayers.length >= tournament.settings.maxPlayers) {
            return res.status(400).json({ message: 'Tournament is full' });
        }

        // For free tournaments, auto-approve payment
        const isFree = tournament.isFree || tournament.entryFee === 0;
        
        tournament.registeredPlayers.push({
            user: userId,
            paid: isFree,  // Auto-approved for free tournaments
            registeredAt: new Date()
        });
        
        await tournament.save();
        
        // Check if tournament should auto-start
        if (tournament.autoStart && tournament.registeredPlayers.filter(p => p.paid).length >= tournament.settings.maxPlayers) {
            await startTournamentAutomatically(tournament._id, req);
        }
        
        res.json({ 
            success: true, 
            message: isFree ? 'Registered successfully!' : 'Registered successfully. Payment pending verification.',
            tournament: {
                _id: tournament._id,
                name: tournament.name,
                registeredCount: tournament.registeredPlayers.length,
                maxPlayers: tournament.settings.maxPlayers,
                spotsRemaining: tournament.settings.maxPlayers - tournament.registeredPlayers.length,
                isFree: isFree
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Registration failed: ' + error.message });
    }
});

// GET bracket - PUBLIC
router.get('/:id/bracket', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id).populate({
            path: 'matches',
            populate: [
                { path: 'player1', select: 'username teamName efootballId' },
                { path: 'player2', select: 'username teamName efootballId' },
                { path: 'winner', select: 'username' },
                { path: 'nextMatch', select: 'round matchNumber status player1 player2' }
            ]
        });

        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const matchesByRound = {};
        tournament.matches.forEach(match => {
            if (!matchesByRound[match.round]) {
                matchesByRound[match.round] = [];
            }
            matchesByRound[match.round].push(match);
        });

        Object.keys(matchesByRound).forEach(round => {
            matchesByRound[round].sort((a, b) => a.matchNumber - b.matchNumber);
        });

        const rounds = Object.keys(matchesByRound).sort((a, b) => a - b).map(round => ({
            round: parseInt(round),
            matches: matchesByRound[round].map(match => ({
                _id: match._id,
                player1: match.player1,
                player2: match.player2,
                winner: match.winner,
                score1: match.score1,
                score2: match.score2,
                status: match.status,
                matchNumber: match.matchNumber,
                nextMatch: match.nextMatch,
                isBronzeMatch: match.isBronzeMatch,
                bracket: match.bracket
            }))
        }));

        res.json({
            format: tournament.format,
            rounds: rounds,
            currentRound: tournament.currentRound,
            standings: ['round_robin', 'league', 'swiss'].includes(tournament.format) 
                ? tournament.standings 
                : null
        });
    } catch (error) {
        console.error('Bracket error:', error);
        res.status(500).json({ message: error.message });
    }
});

// GET standings - PUBLIC
router.get('/:id/standings', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('standings.player', 'username teamName efootballId')
            .populate('matches');

        if (!tournament) return res.status(404).json({ message: 'Not found' });
        
        const logic = TournamentLogicFactory.create(tournament);
        
        const isRoundBased = ['round_robin', 'league', 'swiss'].includes(tournament.format);
        const standings = isRoundBased ? logic.calculateStandings() : logic.getFinalRankings(tournament.matches);

        res.json(standings);
    } catch (error) {
        console.error('Standings error:', error);
        res.status(500).json({ message: error.message });
    }
});

// GET tournament matches - PUBLIC
router.get('/:id/matches', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('matches.player1', 'username teamName')
            .populate('matches.player2', 'username teamName')
            .populate('matches.winner', 'username');
        
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found' });
        }

        const sortedMatches = tournament.matches.sort((a, b) => {
            if (a.round !== b.round) return a.round - b.round;
            if (a.status === 'ongoing') return -1;
            if (b.status === 'ongoing') return 1;
            return 0;
        });

        res.json(sortedMatches);
    } catch (error) {
        console.error('Matches error:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST regenerate round - ADMIN ONLY
router.post('/:id/regenerate-round', auth, adminOnly, async (req, res) => {
    try {
        const { round } = req.body;
        const result = await adminService.regenerateRound(req.params.id, parseInt(round));
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Regenerate round error:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/:id/sync-bracket', auth, adminOnly, async (req, res) => {
    try { 
        res.json(await adminService.syncTournamentBracket(req.params.id)); 
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

module.exports = router;