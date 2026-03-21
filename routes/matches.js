const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
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
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const adminOnly = async (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    next();
};

// POST /api/matches/:id/result - Dual submission system
router.post('/:id/result', auth, require('../middleware/upload').single('screenshot'), [
    body('score1').isInt({ min: 0 }),
    body('score2').isInt({ min: 0 }),
    body('winner').isIn(['player1', 'player2'])
], async (req, res) => {
    try {
        const { score1, score2, winner, notes } = req.body;
        const userId = req.user.id;

        const match = await Match.findById(req.params.id)
            .populate('tournament', 'name')
            .populate('player1', 'username')
            .populate('player2', 'username');

        if (!match) return res.status(404).json({ message: 'Match not found' });
        if (match.status === 'completed') return res.status(400).json({ message: 'Match already completed' });

        // Determine which player is submitting
        const isPlayer1 = match.player1?._id?.toString() === userId;
        const isPlayer2 = match.player2?._id?.toString() === userId;

        if (!isPlayer1 && !isPlayer2) return res.status(403).json({ message: 'You are not a participant in this match' });

        // Check if already submitted
        const playerKey = isPlayer1 ? 'player1' : 'player2';
        if (match.submissions?.[playerKey]) {
            return res.status(400).json({ message: 'You already submitted your result' });
        }

        // Validate scores
        if (parseInt(score1) === parseInt(score2)) {
            return res.status(400).json({ message: 'Scores cannot be tied' });
        }

        const expectedWinner = parseInt(score1) > parseInt(score2) ? 'player1' : 'player2';
        if (winner !== expectedWinner) {
            return res.status(400).json({ message: 'Winner does not match scores' });
        }

        // Store submission
        if (!match.submissions) match.submissions = {};
        match.submissions[playerKey] = {
            score1: parseInt(score1),
            score2: parseInt(score2),
            winner: winner,
            notes: notes || '',
            submittedAt: new Date(),
            screenshotPath: req.file ? req.file.path : null
        };

        await match.save();

        // Check if both submitted
        const bothSubmitted = match.submissions?.player1 && match.submissions?.player2;
        const submissionsMatch = bothSubmitted ? 
            (match.submissions.player1.score1 === match.submissions.player2.score1 &&
             match.submissions.player1.score2 === match.submissions.player2.score2 &&
             match.submissions.player1.winner === match.submissions.player2.winner) : false;

        // Auto-approve if both match
        if (bothSubmitted && submissionsMatch) {
            match.score1 = match.submissions.player1.score1;
            match.score2 = match.submissions.player1.score2;
            match.winner = match.submissions.player1.winner === 'player1' ? match.player1._id : match.player2._id;
            match.status = 'completed';
            match.adminVerification = {
                status: 'approved',
                verifiedAt: new Date(),
                finalScore1: match.score1,
                finalScore2: match.score2,
                finalWinner: match.winner
            };
            await match.save();

            // Advance winner
            if (match.nextMatch) {
                const nextMatch = await Match.findById(match.nextMatch);
                if (nextMatch) {
                    if (!nextMatch.player1) nextMatch.player1 = match.winner;
                    else if (!nextMatch.player2) nextMatch.player2 = match.winner;
                    await nextMatch.save();
                }
            }

            // Update stats
            await updatePlayerStats(match);

            return res.json({ 
                success: true, 
                message: 'Both players submitted matching results - match approved automatically!',
                autoApproved: true,
                match: { id: match._id, status: 'completed' }
            });
        }

        // Mark as disputed if both submitted but don't match
        if (bothSubmitted && !submissionsMatch) {
            match.status = 'disputed';
            match.adminVerification = { status: 'disputed' };
            await match.save();

            return res.json({ 
                success: true, 
                message: 'Results submitted but opponent result differs - admin review required',
                disputed: true
            });
        }

        // Only this player submitted
        res.json({ 
            success: true, 
            message: 'Result submitted - waiting for opponent to submit',
            waitingFor: isPlayer1 ? 'player2' : 'player1'
        });

    } catch (error) {
        console.error('Submit result error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/matches/:id/status - Check submission status
router.get('/:id/status', auth, async (req, res) => {
    try {
        const match = await Match.findById(req.params.id)
            .populate('player1', 'username')
            .populate('player2', 'username');

        if (!match) return res.status(404).json({ message: 'Match not found' });

        const userId = req.user.id;
        const isPlayer1 = match.player1?._id?.toString() === userId;

        res.json({
            matchId: match._id,
            status: match.status,
            mySubmission: isPlayer1 ? match.submissions?.player1 : match.submissions?.player2,
            opponentSubmitted: isPlayer1 ? !!match.submissions?.player2 : !!match.submissions?.player1,
            bothSubmitted: !!(match.submissions?.player1 && match.submissions?.player2),
            submissionsMatch: match.submissions?.player1 && match.submissions?.player2 ?
                (match.submissions.player1.score1 === match.submissions.player2.score1 &&
                 match.submissions.player1.score2 === match.submissions.player2.score2) : null
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/matches/:id/resolve - Admin resolves disputed match
router.post('/:id/resolve', auth, adminOnly, async (req, res) => {
    try {
        const { decision, score1, score2, winner, reason } = req.body;
        // decision: 'player1_correct', 'player2_correct', 'custom'

        const match = await Match.findById(req.params.id)
            .populate('player1')
            .populate('player2');

        if (!match) return res.status(404).json({ message: 'Match not found' });
        if (match.status === 'completed') return res.status(400).json({ message: 'Match already completed' });

        let finalScore1, finalScore2, finalWinner;

        if (decision === 'player1_correct') {
            finalScore1 = match.submissions.player1.score1;
            finalScore2 = match.submissions.player1.score2;
            finalWinner = match.submissions.player1.winner === 'player1' ? match.player1._id : match.player2._id;
        } else if (decision === 'player2_correct') {
            finalScore1 = match.submissions.player2.score1;
            finalScore2 = match.submissions.player2.score2;
            finalWinner = match.submissions.player2.winner === 'player1' ? match.player1._id : match.player2._id;
        } else if (decision === 'custom') {
            finalScore1 = parseInt(score1);
            finalScore2 = parseInt(score2);
            finalWinner = winner === 'player1' ? match.player1._id : match.player2._id;
        } else {
            return res.status(400).json({ message: 'Invalid decision' });
        }

        // Apply result
        match.score1 = finalScore1;
        match.score2 = finalScore2;
        match.winner = finalWinner;
        match.status = 'completed';
        match.adminVerification = {
            status: 'approved',
            verifiedBy: req.user.id,
            verifiedAt: new Date(),
            finalScore1,
            finalScore2,
            finalWinner,
            rejectionReason: reason || ''
        };
        await match.save();

        // Advance winner
        if (match.nextMatch) {
            const nextMatch = await Match.findById(match.nextMatch);
            if (nextMatch) {
                if (!nextMatch.player1) nextMatch.player1 = finalWinner;
                else if (!nextMatch.player2) nextMatch.player2 = finalWinner;
                await nextMatch.save();
            }
        }

        await updatePlayerStats(match);

        res.json({
            success: true,
            message: 'Match resolved by admin',
            match: { id: match._id, winner: finalWinner, status: 'completed' }
        });
    } catch (error) {
        console.error('Resolve match error:', error);
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

// CRITICAL: Export the router
module.exports = router;