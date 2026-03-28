// routes/matches.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const { auth } = require('../middleware/auth'); // Make sure this file exports { auth }
const upload = require('../middleware/upload'); // Make sure this exports the multer instance
const { TournamentLogicFactory } = require('../services/tournamentLogic');

// POST /api/matches/:id/result
router.post('/:id/result', auth, upload.single('screenshot'), async (req, res) => {
    try {
        const { score1, score2, winner, notes } = req.body;
        const userId = req.user._id.toString();

        let match = await Match.findById(req.params.id)
            .populate('tournament', 'name format')
            .populate('player1', 'username')
            .populate('player2', 'username');

        if (!match) return res.status(404).json({ message: 'Match not found' });
        if (match.status === 'completed') return res.status(400).json({ message: 'Match already completed' });

        const matchPlayer1Id = match.player1?._id?.toString();
        const matchPlayer2Id = match.player2?._id?.toString();
        
        const isPlayer1 = matchPlayer1Id === userId;
        const isPlayer2 = matchPlayer2Id === userId;

        if (!isPlayer1 && !isPlayer2) {
            return res.status(403).json({ message: 'You are not a participant in this match' });
        }

        // Check if already submitted
        const player1HasSubmitted = match.submissions?.player1?.submittedAt != null;
        const player2HasSubmitted = match.submissions?.player2?.submittedAt != null;

        if (isPlayer1 && player1HasSubmitted) {
            return res.status(400).json({ message: 'You already submitted your result' });
        }
        if (isPlayer2 && player2HasSubmitted) {
            return res.status(400).json({ message: 'You already submitted your result' });
        }

        if (parseInt(score1) === parseInt(score2)) {
            return res.status(400).json({ message: 'Scores cannot be tied' });
        }

        const expectedWinner = parseInt(score1) > parseInt(score2) ? 'player1' : 'player2';
        if (winner !== expectedWinner) {
            return res.status(400).json({ message: 'Winner does not match scores' });
        }

        const playerKey = isPlayer1 ? 'player1' : 'player2';

        const submissionData = {
            score1: parseInt(score1),
            score2: parseInt(score2),
            winner: winner,
            notes: notes || '',
            submittedAt: new Date(),
            screenshotPath: req.file ? req.file.path : null,
            submittedBy: req.user._id
        };

        await Match.findByIdAndUpdate(req.params.id, {
            $set: {
                [`submissions.${playerKey}`]: submissionData,
                status: 'ongoing'
            }
        });

        // Reload match
        match = await Match.findById(req.params.id)
            .populate('tournament', 'name format')
            .populate('player1', 'username')
            .populate('player2', 'username');

        const bothSubmitted = match.submissions?.player1?.submittedAt && match.submissions?.player2?.submittedAt;
        const submissionsMatch = bothSubmitted ? match.submissionsMatch() : false;

        if (bothSubmitted && submissionsMatch) {
            const winnerId = match.submissions.player1.winner === 'player1' 
                ? match.player1._id 
                : match.player2._id;

            await Match.findByIdAndUpdate(req.params.id, {
                $set: {
                    score1: match.submissions.player1.score1,
                    score2: match.submissions.player1.score2,
                    winner: winnerId,
                    status: 'completed',
                    'adminVerification.status': 'approved',
                    'adminVerification.verifiedAt': new Date(),
                    'adminVerification.finalScore1': match.submissions.player1.score1,
                    'adminVerification.finalScore2': match.submissions.player1.score2,
                    'adminVerification.finalWinner': winnerId
                }
            });

            const completedMatch = await Match.findById(req.params.id)
                .populate('player1')
                .populate('player2');

            // Advance tournament
            const tournament = await Tournament.findById(match.tournament._id);
            if (tournament) {
                const allMatches = await Match.find({ tournament: tournament._id });
                tournament.matches = allMatches;
                
                const logic = TournamentLogicFactory.create(tournament);
                
                const nextMatch = await logic.advanceWinner(completedMatch);
                
                if (tournament.format === 'double_elimination' && logic.advanceLoser) {
                    await logic.advanceLoser(completedMatch);
                }
                
                if (logic.isTournamentComplete && logic.isTournamentComplete()) {
                    tournament.status = 'finished';
                    const rankings = logic.getFinalRankings(allMatches);
                    tournament.winners = rankings.map((r, i) => ({
                        rank: r.rank || (i + 1),
                        player: r.player,
                        prize: tournament.getPrizeForRank(r.rank || (i + 1))
                    }));
                    await tournament.save();
                } else if (['round_robin', 'league', 'swiss'].includes(tournament.format)) {
                    tournament.standings = logic.calculateStandings();
                    await tournament.save();
                }
            }

            await updatePlayerStats(completedMatch);

            return res.json({ 
                success: true, 
                message: 'Both players submitted matching results - match approved!',
                autoApproved: true
            });
        }

        if (bothSubmitted && !submissionsMatch) {
            await Match.findByIdAndUpdate(req.params.id, {
                $set: {
                    status: 'disputed',
                    'adminVerification.status': 'disputed'
                }
            });

            return res.json({ 
                success: true, 
                message: 'Results differ - admin review required',
                disputed: true
            });
        }

        res.json({ 
            success: true, 
            message: 'Result submitted - waiting for opponent'
        });

    } catch (error) {
        console.error('Submit result error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// GET /api/matches/:id/status
router.get('/:id/status', auth, async (req, res) => {
    try {
        const match = await Match.findById(req.params.id)
            .populate('player1', 'username efootballId')
            .populate('player2', 'username efootballId')
            .populate('nextMatch', 'player1 player2 status round matchNumber');

        if (!match) return res.status(404).json({ message: 'Match not found' });

        const userId = req.user._id.toString();
        const isPlayer1 = match.player1?._id?.toString() === userId;

        res.json({
            matchId: match._id,
            status: match.status,
            player1: match.player1,
            player2: match.player2,
            round: match.round,
            nextMatch: match.nextMatch,
            mySubmission: isPlayer1 ? match.submissions?.player1 : match.submissions?.player2,
            opponentSubmitted: isPlayer1 ? !!match.submissions?.player2?.submittedAt : !!match.submissions?.player1?.submittedAt,
            bothSubmitted: !!(match.submissions?.player1?.submittedAt && match.submissions?.player2?.submittedAt),
            submissionsMatch: match.submissions?.player1 && match.submissions?.player2 ?
                match.submissionsMatch() : null
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/matches/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const match = await Match.findById(req.params.id)
            .populate('tournament', 'name')
            .populate('player1', 'username efootballId')
            .populate('player2', 'username efootballId')
            .populate('winner', 'username');
        
        if (!match) return res.status(404).json({ message: 'Match not found' });
        
        res.json(match);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper function
async function updatePlayerStats(match) {
    try {
        const winner = await User.findById(match.winner);
        const player1 = await User.findById(match.player1);
        const player2 = await User.findById(match.player2);

        if (winner) {
            winner.wins = (winner.wins || 0) + 1;
            winner.points = (winner.points || 0) + 3;
            await winner.save();
        }

        if (player1 && !player1._id.equals(match.winner)) {
            player1.losses = (player1.losses || 0) + 1;
            await player1.save();
        }

        if (player2 && !player2._id.equals(match.winner)) {
            player2.losses = (player2.losses || 0) + 1;
            await player2.save();
        }
    } catch (err) {
        console.error('Update stats error:', err);
    }
}

// CRITICAL: Export the router
module.exports = router;