const express = require('express');
const router = express.Router();
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
        req.userId = user._id.toString();
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// POST /api/matches/:id/result - Dual submission system
router.post('/:id/result', auth, require('../middleware/upload').single('screenshot'), async (req, res) => {
    try {
        const { score1, score2, winner, notes } = req.body;
        const userId = req.userId;

        console.log('Received submission:', { score1, score2, winner, userId });

        let match = await Match.findById(req.params.id)
            .populate('tournament', 'name')
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
            console.log('User not participant:', userId, 'is not', matchPlayer1Id, 'or', matchPlayer2Id);
            return res.status(403).json({ message: 'You are not a participant in this match' });
        }

        // Check if submission has actual data (not just empty object)
        const player1HasSubmitted = match.submissions?.player1?.submittedAt != null;
        const player2HasSubmitted = match.submissions?.player2?.submittedAt != null;

        console.log('Checking submissions:', {
            isPlayer1,
            isPlayer2,
            player1HasSubmitted,
            player2HasSubmitted,
            player1Data: match.submissions?.player1,
            player2Data: match.submissions?.player2
        });

        if (isPlayer1 && player1HasSubmitted) {
            console.log('Player 1 already submitted');
            return res.status(400).json({ message: 'You already submitted your result' });
        }
        if (isPlayer2 && player2HasSubmitted) {
            console.log('Player 2 already submitted');
            return res.status(400).json({ message: 'You already submitted your result' });
        }

        if (parseInt(score1) === parseInt(score2)) {
            return res.status(400).json({ message: 'Scores cannot be tied - play until there is a winner' });
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
            screenshotPath: req.file ? req.file.path : null
        };

        console.log('Saving submission for', playerKey, ':', submissionData);

        // Save submission
        await Match.findByIdAndUpdate(req.params.id, {
            $set: {
                [`submissions.${playerKey}`]: submissionData
            }
        });

        // Reload match to get both submissions
        match = await Match.findById(req.params.id)
            .populate('tournament', 'name')
            .populate('player1', 'username')
            .populate('player2', 'username');

        console.log('After save, match.submissions:', match.submissions);

        const bothSubmitted = match.submissions?.player1?.submittedAt && match.submissions?.player2?.submittedAt;
        
        // Use the schema method to check if submissions match
        const submissionsMatch = bothSubmitted ? match.submissionsMatch() : false;

        console.log('Both submitted:', bothSubmitted);
        console.log('Submissions match:', submissionsMatch);

        if (bothSubmitted && submissionsMatch) {
            // Auto-approve
            const winnerId = match.submissions.player1.winner === 'player1' 
                ? match.player1._id 
                : match.player2._id;
            let completedMatch = null;

            console.log('Auto-approving match. Winner ID:', winnerId?.toString());

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

            // ✅ FIXED: Advance winner to next match using tournament logic
            console.log('=== Starting winner advancement ===');

            // Get tournament with all matches populated
            const tournament = await Tournament.findById(match.tournament._id);

            if (!tournament) {
                console.log('❌ Tournament not found');
            } else {
                // Create logic instance and advance winner
                const { TournamentLogicFactory } = require('../services/tournamentLogic');
                const logic = TournamentLogicFactory.create(tournament);
                
                // Populate the tournament matches properly
                const allMatches = await Match.find({ tournament: tournament._id });
                tournament.matches = allMatches;
                
                // Get fresh match data
                completedMatch = await Match.findById(req.params.id)
                    .populate('player1')
                    .populate('player2');
                
                console.log('Calling advanceWinner with match:', {
                    id: completedMatch._id.toString(),
                    round: completedMatch.round,
                    matchNumber: completedMatch.matchNumber,
                    winner: completedMatch.winner?.toString()
                });
                
                // Get the next match info from logic
               const nextMatchInfo = await logic.advanceWinner(completedMatch);

if (nextMatchInfo && nextMatchInfo._id) {
    console.log('✅ Winner advanced to next match:', nextMatchInfo._id.toString());
    // The logic already updated the match, just fetch fresh data if needed
    const verifyMatch = await Match.findById(nextMatchInfo._id);
    console.log('Next match state:', {
        player1: verifyMatch.player1?.toString(),
        player2: verifyMatch.player2?.toString(),
        status: verifyMatch.status
    });
} else {
    console.log('ℹ️ No next match to advance to (final match or tournament complete)');
}
            }

            if (!completedMatch) {
                completedMatch = await Match.findById(req.params.id);
            }
            await updatePlayerStats(completedMatch);

            return res.json({ 
                success: true, 
                message: 'Both players submitted matching results - match approved automatically!',
                autoApproved: true,
                match: { id: match._id, status: 'completed' }
            });
        }

        if (bothSubmitted && !submissionsMatch) {
            // Mark as disputed
            await Match.findByIdAndUpdate(req.params.id, {
                $set: {
                    status: 'disputed',
                    'adminVerification.status': 'disputed'
                }
            });

            return res.json({ 
                success: true, 
                message: 'Results submitted but opponent result differs - admin review required',
                disputed: true
            });
        }

        res.json({ 
            success: true, 
            message: 'Result submitted - waiting for opponent to submit',
            waitingFor: isPlayer1 ? 'player2' : 'player1'
        });

    } catch (error) {
        console.error('Submit result error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// GET /api/matches/:id/status - FIXED with nextMatch population
router.get('/:id/status', auth, async (req, res) => {
    try {
        const match = await Match.findById(req.params.id)
            .populate('player1', 'username efootballId')
            .populate('player2', 'username efootballId')
            .populate('nextMatch', 'player1 player2 status round matchNumber'); // ✅ Added nextMatch population

        if (!match) return res.status(404).json({ message: 'Match not found' });

        const userId = req.userId;

        const isPlayer1 = match.player1?._id?.toString() === userId;

        res.json({
            matchId: match._id,
            status: match.status,
            player1: match.player1,
            player2: match.player2,
            round: match.round,
            nextMatch: match.nextMatch, // ✅ Now populated
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

// GET /api/matches/:id - Get match details
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

// DEBUG: Check match submissions state (development only)
if (process.env.NODE_ENV !== 'production') {
    router.get('/:id/debug', auth, async (req, res) => {
        try {
            const match = await Match.findById(req.params.id).lean();
            if (!match) return res.status(404).json({ message: 'Match not found' });
            
            const userId = req.userId;
            
            res.json({
                matchId: match._id.toString(),
                status: match.status,
                player1: match.player1?.toString(),
                player2: match.player2?.toString(),
                winner: match.winner?.toString(),
                nextMatch: match.nextMatch?.toString(),
                currentUser: userId,
                isPlayer1: match.player1?.toString() === userId,
                isPlayer2: match.player2?.toString() === userId,
                hasSubmissionsField: 'submissions' in match,
                submissions: match.submissions || null,
                player1HasSubmitted: !!(match.submissions?.player1?.submittedAt),
                player2HasSubmitted: !!(match.submissions?.player2?.submittedAt),
                player1SubmissionData: match.submissions?.player1 || null,
                player2SubmissionData: match.submissions?.player2 || null
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
}
// Public check - no auth needed
router.get('/check/:matchId', async (req, res) => {
    const match = await Match.findById(req.params.matchId)
        .populate('player1', 'username')
        .populate('player2', 'username');
    res.json({
        id: match._id,
        round: match.round,
        player1: match.player1?.username || null,
        player2: match.player2?.username || null,
        status: match.status
    });
});
// Add winner to final manually
router.post('/add-to-final/:finalMatchId/:winnerId', auth, async (req, res) => {
    try {
        const finalMatch = await Match.findById(req.params.finalMatchId);
        
        if (!finalMatch.player1) {
            await Match.findByIdAndUpdate(req.params.finalMatchId, {
                player1: req.params.winnerId,
                status: finalMatch.player2 ? 'scheduled' : 'pending'
            });
            return res.json({ message: 'Added winner to player1 slot' });
        } else if (!finalMatch.player2) {
            await Match.findByIdAndUpdate(req.params.finalMatchId, {
                player2: req.params.winnerId,
                status: finalMatch.player1 ? 'scheduled' : 'pending'
            });
            return res.json({ message: 'Added winner to player2 slot' });
        } else {
            return res.json({ message: 'Both slots already filled' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.post('/quick-status-fix/:matchId', auth, async (req, res) => {
    const match = await Match.findById(req.params.matchId);
    const newStatus = match.player1 && match.player2 ? 'scheduled' : 'pending';
    await Match.findByIdAndUpdate(req.params.matchId, { status: newStatus });
    res.json({ message: 'Status updated to ' + newStatus });
});
// Quick fix via API
router.post('/quick-fix/:matchId/:nextMatchId', auth, async (req, res) => {
    await Match.findByIdAndUpdate(req.params.matchId, {
        nextMatch: req.params.nextMatchId
    });
    res.json({ message: 'Fixed' });
});
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

        if (player1 && player1._id.toString() !== match.winner?.toString()) {
            player1.losses = (player1.losses || 0) + 1;
            await player1.save();
        }

        if (player2 && player2._id.toString() !== match.winner?.toString()) {
            player2.losses = (player2.losses || 0) + 1;
            await player2.save();
        }
    } catch (err) {
        console.error('Update stats error:', err);
    }
}

module.exports = router;