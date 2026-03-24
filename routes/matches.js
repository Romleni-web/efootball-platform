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

        // ✅ FIXED: Check if submission has actual data (not just empty object)
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

            // Advance winner
            const updatedMatch = await Match.findById(req.params.id);
            if (updatedMatch.nextMatch) {
                const nextMatch = await Match.findById(updatedMatch.nextMatch);
                if (nextMatch) {
                    const updateData = {};
                    if (!nextMatch.player1) updateData.player1 = updatedMatch.winner;
                    else if (!nextMatch.player2) updateData.player2 = updatedMatch.winner;
                    
                    if (Object.keys(updateData).length > 0) {
                        await Match.findByIdAndUpdate(updatedMatch.nextMatch, { $set: updateData });
                    }
                }
            }

            await updatePlayerStats(updatedMatch);

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

// GET /api/matches/:id/status
router.get('/:id/status', auth, async (req, res) => {
    try {
        const match = await Match.findById(req.params.id)
            .populate('player1', 'username')
            .populate('player2', 'username');

        if (!match) return res.status(404).json({ message: 'Match not found' });

        const userId = req.userId;

        const isPlayer1 = match.player1?._id?.toString() === userId;

        res.json({
            matchId: match._id,
            status: match.status,
            player1: match.player1,
            player2: match.player2,
            round: match.round,
            mySubmission: isPlayer1 ? match.submissions?.player1 : match.submissions?.player2,
            opponentSubmitted: isPlayer1 ? !!match.submissions?.player2?.submittedAt : !!match.submissions?.player1?.submittedAt,
            bothSubmitted: !!(match.submissions?.player1?.submittedAt && match.submissions?.player2?.submittedAt),
            submissionsMatch: match.submissions?.player1 && match.submissions?.player2 ?
                (match.submissions.player1.score1 === match.submissions.player2.score1 &&
                 match.submissions.player1.score2 === match.submissions.player2.score2 &&
                 match.submissions.player1.winner === match.submissions.player2.winner) : null
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

// DEBUG: Check match submissions state
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