// routes/tournaments.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const { auth } = require('../middleware/auth');

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
        res.status(500).json({ message: error.message });
    }
});

// GET bracket with proper population
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

// GET standings
router.get('/:id/standings', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('standings.player', 'username teamName efootballId')
            .populate('matches');

        if (!tournament) return res.status(404).json({ message: 'Not found' });
        
        if (!['round_robin', 'league', 'swiss'].includes(tournament.format)) {
            return res.status(400).json({ message: 'Standings only for round-based formats' });
        }

        const { TournamentLogicFactory } = require('../services/tournamentLogic');
        const logic = TournamentLogicFactory.create(tournament);
        const standings = logic.calculateStandings();

        res.json(standings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET tournament matches
router.get('/:id/matches', auth, async (req, res) => {
    try {
        const matches = await Match.find({ tournament: req.params.id })
            .populate('player1', 'username teamName')
            .populate('player2', 'username teamName')
            .populate('winner', 'username')
            .sort({ round: 1, matchNumber: 1 });
        
        res.json(matches);
    } catch (error) {
        res.status(500).json({ message: error.message });
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

module.exports = router;