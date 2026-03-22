const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const jwt = require('jsonwebtoken');
const { TournamentLogicFactory } = require('../services/tournamentLogic');

// Middleware
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

const adminOnly = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// GET all tournaments
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

// GET single tournament
router.get('/:id', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('registeredPlayers.user', 'username teamName efootballId')
            .populate('matches')
            .populate('standings.player', 'username teamName');
        
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST create tournament (Admin only)
router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const {
            name, description, format, settings,
            entryFee, prizePool, prizeDistribution,
            startDate, endDate, adminPhone, whatsappLink
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
            entryFee,
            prizePool,
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
        res.status(400).json({ message: error.message });
    }
});

// POST register for tournament
router.post('/:id/register', auth, async (req, res) => {
    const tournamentId = req.params.id;
    const userId = req.user._id;

    try {
        const result = await Tournament.findOneAndUpdate(
            {
                _id: tournamentId,
                status: 'open',
                $expr: { $lt: [{ $size: '$registeredPlayers' }, '$settings.maxPlayers'] },
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
            { new: true, runValidators: true }
        );

        if (!result) {
            const tournament = await Tournament.findById(tournamentId);
            if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
            if (tournament.status !== 'open') return res.status(400).json({ message: `Tournament is ${tournament.status}` });
            const alreadyRegistered = tournament.registeredPlayers.some(rp => rp.user.toString() === userId.toString());
            if (alreadyRegistered) return res.status(400).json({ message: 'Already registered' });
            return res.status(400).json({ message: 'Tournament is full' });
        }

        res.json({ 
            success: true, 
            message: 'Registered successfully',
            tournament: {
                _id: result._id,
                name: result.name,
                registeredCount: result.registeredPlayers.length,
                maxPlayers: result.settings.maxPlayers,
                spotsRemaining: result.settings.maxPlayers - result.registeredPlayers.length
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Registration failed' });
    }
});

// POST generate bracket (Admin only)
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
            isBronzeMatch: m.isBronzeMatch || false
        })));

        tournament.matches = savedMatches.map(m => m._id);
        tournament.bracketGeneratedAt = new Date();
        tournament.status = 'ongoing';
        tournament.currentRound = 1;
        await tournament.save();

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
        res.status(500).json({ message: error.message });
    }
});

// POST submit match result
router.post('/:id/matches/:matchId/result', auth, async (req, res) => {
    try {
        const { score1, score2, winner, notes } = req.body;
        const tournament = await Tournament.findById(req.params.id);
        const match = await Match.findById(req.params.matchId);

        if (!match || !tournament) return res.status(404).json({ message: 'Not found' });

        const userId = req.user._id.toString();
        const isPlayer1 = match.player1?.toString() === userId;
        const isPlayer2 = match.player2?.toString() === userId;
        
        if (!isPlayer1 && !isPlayer2 && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not a player in this match' });
        }

        const submissionKey = isPlayer1 ? 'player1' : (isPlayer2 ? 'player2' : 'admin');
        
        match.submissions = match.submissions || {};
        match.submissions[submissionKey] = {
            score1: parseInt(score1),
            score2: parseInt(score2),
            winner: winner,
            notes: notes,
            submittedAt: new Date(),
            submittedBy: req.user._id
        };

        // Check if both players submitted
        if (match.submissions.player1 && match.submissions.player2) {
            const s1 = match.submissions.player1;
            const s2 = match.submissions.player2;

            if (s1.score1 === s2.score1 && s1.score2 === s2.score2 && s1.winner === s2.winner) {
                // Auto-approve
                match.status = 'completed';
                match.score1 = s1.score1;
                match.score2 = s1.score2;
                match.winner = s1.winner === 'player1' ? match.player1 : match.player2;
                
                const logic = TournamentLogicFactory.create(tournament);
                
                if (['round_robin', 'league', 'swiss'].includes(tournament.format)) {
                    tournament.standings = logic.calculateStandings();
                } else {
                    const nextMatch = await logic.advanceWinner(match);
                    if (nextMatch) {
                        await Match.findByIdAndUpdate(nextMatch._id, {
                            player1: nextMatch.player1,
                            player2: nextMatch.player2,
                            status: nextMatch.status
                        });
                    }
                }

                await checkTournamentComplete(tournament);
            } else {
                match.status = 'disputed';
                match.adminVerification = { status: 'pending' };
            }
        } else {
            match.status = 'ongoing';
        }

        await match.save();
        await tournament.save();

        res.json({ 
            success: true,
            match,
            tournament: { status: tournament.status, currentRound: tournament.currentRound }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET bracket - PUBLIC (masks names if not registered)
router.get('/:id/bracket', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id).populate({
            path: 'matches',
            populate: [
                { path: 'player1', select: 'username teamName' },
                { path: 'player2', select: 'username teamName' },
                { path: 'winner', select: 'username' }
            ]
        });

        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const logic = TournamentLogicFactory.create(tournament);
        const bracketData = logic.getBracketData(tournament.matches);

        // Check if user is registered (if logged in)
        let isRegistered = false;
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'efootball_secret_key');
                isRegistered = tournament.registeredPlayers.some(p => 
                    p.user.toString() === decoded.id
                );
            } catch (e) {
                // Invalid token, treat as not registered
            }
        }

        // If not registered and not admin, mask player names in pending matches
        let sanitizedData = bracketData;
        if (!isRegistered && tournament.status !== 'finished') {
            sanitizedData = bracketData.map(round => ({
                ...round,
                matches: round.matches.map(match => ({
                    ...match,
                    player1: match.player1 ? { username: 'Registered Player' } : null,
                    player2: match.player2 ? { username: 'Registered Player' } : null
                }))
            }));
        }

        res.json({
            format: tournament.format,
            rounds: sanitizedData,
            currentRound: tournament.currentRound,
            standings: ['round_robin', 'league', 'swiss'].includes(tournament.format) 
                ? tournament.standings 
                : null,
            isRegistered // Tell frontend if user sees full data
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET standings - PUBLIC (no auth required)
router.get('/:id/standings', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('standings.player', 'username teamName efootballId')
            .populate('matches');

        if (!tournament) return res.status(404).json({ message: 'Not found' });
        
        if (!['round_robin', 'league', 'swiss'].includes(tournament.format)) {
            return res.status(400).json({ message: 'Standings only for round-based formats' });
        }

        const logic = TournamentLogicFactory.create(tournament);
        const standings = logic.calculateStandings();

        res.json(standings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Helper functions
async function checkTournamentComplete(tournament) {
    const incompleteMatches = await Match.find({
        _id: { $in: tournament.matches },
        status: { $nin: ['completed', 'bye'] }
    });

    if (incompleteMatches.length === 0) {
        tournament.status = 'finished';
        
        const logic = TournamentLogicFactory.create(tournament);
        const rankings = logic.getFinalRankings ? 
            logic.getFinalRankings(tournament.matches) : 
            logic.calculateStandings();

        tournament.winners = rankings.map((r, i) => ({
            rank: r.rank || (i + 1),
            player: r.player,
            prize: calculatePrize(tournament.prizePool, i + 1, tournament.prizeDistribution)
        }));

        await tournament.save();
    }
}

function calculatePrize(pool, rank, distribution) {
    const percentages = [distribution.first, distribution.second, distribution.third];
    return pool * (percentages[rank - 1] || 0) / 100;
}

module.exports = router;