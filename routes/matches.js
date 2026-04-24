// routes/matches.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { TournamentLogicFactory } = require('../services/tournamentLogic');

// POST /api/matches/:id/result - Dual submission system
router.post('/:id/result', auth, upload.fields([
    { name: 'screenshot', maxCount: 1 },
    { name: 'historyScreenshot', maxCount: 1 }
]), async (req, res) => {
    try {
        const { score1, score2, winner, notes } = req.body;
        const userId = req.user._id.toString();

        console.log('Received submission:', { score1, score2, winner, userId });

        let match = await Match.findById(req.params.id)
            .populate('tournament', 'name format')
            .populate('player1', 'username')
            .populate('player2', 'username');

        if (!match) return res.status(404).json({ message: 'Match not found' });
        if (match.status === 'completed') return res.status(400).json({ message: 'Match already completed' });

        const matchPlayer1Id = match.player1?._id?.toString();
        const matchPlayer2Id = match.player2?._id?.toString();
        
        console.log('Player IDs:', { matchPlayer1Id, matchPlayer2Id, currentUser: userId });

        const isPlayer1 = matchPlayer1Id === userId;
        const isPlayer2 = matchPlayer2Id === userId;

        if (!isPlayer1 && !isPlayer2) {
            console.log('User not participant:', userId);
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

        // Build submission data
        const submissionData = {
            score1: parseInt(score1),
            score2: parseInt(score2),
            winner: winner,
            notes: notes || '',
            submittedAt: new Date(),
            screenshotPath: req.files?.['screenshot'] ? req.files['screenshot'][0].path : null,
            historyScreenshotPath: req.files?.['historyScreenshot'] ? req.files['historyScreenshot'][0].path : null,
            submittedBy: req.user._id
        };

        console.log('Saving submission for', playerKey);

        // Save submission
        await Match.findByIdAndUpdate(req.params.id, {
            $set: {
                [`submissions.${playerKey}`]: submissionData,
                status: 'ongoing'
            }
        });

        // Reload match to get both submissions
        match = await Match.findById(req.params.id)
            .populate('tournament', 'name format')
            .populate('player1', 'username')
            .populate('player2', 'username');

        const bothSubmitted = match.submissions?.player1?.submittedAt && match.submissions?.player2?.submittedAt;
        const submissionsMatch = bothSubmitted ? match.submissionsMatch() : false;

        console.log('Both submitted:', bothSubmitted);
        console.log('Submissions match:', submissionsMatch);

        if (bothSubmitted && submissionsMatch) {
            // Calculate winner ID from submission
            const winnerId = match.submissions.player1.winner === 'player1' 
                ? match.player1._id 
                : match.player2._id;

            console.log('Auto-approving match. Winner ID:', winnerId.toString());

            // Update match as completed
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

            // RELOAD match with populated fields for advancement
            const completedMatch = await Match.findById(req.params.id)
                .populate('player1')
                .populate('player2')
                .populate('winner');

            console.log('Completed match:', {
                id: completedMatch._id.toString(),
                player1: completedMatch.player1?._id?.toString(),
                player2: completedMatch.player2?._id?.toString(),
                winner: completedMatch.winner?._id?.toString(),
                nextMatch: completedMatch.nextMatch?.toString()
            });

            // Advance tournament
            const tournament = await Tournament.findById(match.tournament._id);
            if (tournament) {
                // Get fresh matches and populate tournament object properly
                const allMatches = await Match.find({ tournament: tournament._id });
                
                // Create tournament object for logic with populated matches
                const tournamentForLogic = {
                    ...tournament.toObject(),
                    matches: allMatches
                };
                
                const logic = TournamentLogicFactory.create(tournamentForLogic);
                
                console.log('Advancing winner...');
                const nextMatch = await logic.advanceWinner(completedMatch);
                console.log('Next match result:', nextMatch ? nextMatch._id.toString() : 'null');
                
                // For double elimination, also advance loser
                if (tournament.format === 'double_elimination' && logic.advanceLoser) {
                    console.log('Advancing loser (double elimination)...');
                    const loserMatch = await logic.advanceLoser(completedMatch);
                    console.log('Loser match result:', loserMatch ? loserMatch._id.toString() : 'null');
                }
                
                // Check if tournament complete
                if (logic.isTournamentComplete && logic.isTournamentComplete()) {
                    console.log('Tournament complete!');
                    tournament.status = 'finished';
                    const rankings = logic.getFinalRankings(allMatches);
                    tournament.winners = rankings.map((r, i) => ({
                        rank: r.rank || (i + 1),
                        player: r.player._id || r.player,
                        prize: tournament.getPrizeForRank(r.rank || (i + 1))
                    }));
                    await tournament.save();
                } else if (['round_robin', 'league', 'swiss'].includes(tournament.format)) {
                    tournament.standings = logic.calculateStandings();
                    await tournament.save();

                    const io = req.app.get('io');
if (io) { const { emitBracketUpdate } = require('../socket/bracketEvents'); emitBracketUpdate(io, tournament._id); }
                }
            }

            // Update player stats
            await updatePlayerStats(completedMatch);

            return res.json({ 
                success: true, 
                message: 'Both players submitted matching results - match approved!',
                autoApproved: true,
                match: { id: match._id, status: 'completed' }
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
            message: 'Result submitted - waiting for opponent',
            waitingFor: isPlayer1 ? 'player2' : 'player1'
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

// Helper function to update player stats
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

// Debug routes (development only)
if (process.env.NODE_ENV !== 'production') {
    router.get('/:id/debug', auth, async (req, res) => {
        try {
            const match = await Match.findById(req.params.id).lean();
            if (!match) return res.status(404).json({ message: 'Match not found' });
            
            const userId = req.user._id.toString();
            
            res.json({
                matchId: match._id.toString(),
                status: match.status,
                player1: match.player1?.toString(),
                player2: match.player2?.toString(),
                winner: match.winner?.toString(),
                nextMatch: match.nextMatch?.toString(),
                losersNextMatch: match.losersNextMatch?.toString(),
                currentUser: userId,
                isPlayer1: match.player1?.toString() === userId,
                isPlayer2: match.player2?.toString() === userId,
                submissions: match.submissions || null,
                player1HasSubmitted: !!(match.submissions?.player1?.submittedAt),
                player2HasSubmitted: !!(match.submissions?.player2?.submittedAt)
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
}

module.exports = router;