// models/Match.js - Fixed version

const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    round: {
        type: Number,
        required: true
    },
    matchNumber: {
        type: Number,
        required: true
    },
    player1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    player2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    score1: {
        type: Number,
        default: null
    },
    score2: {
        type: Number,
        default: null
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    screenshotPath: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'scheduled', 'ongoing', 'completed', 'disputed', 'bye'],
        default: 'scheduled'
    },
    nextMatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match',
        default: null
    },
    submissions: {
        player1: {
            score1: Number,  // P1's score
            score2: Number,  // P2's score
            winner: String,   // 'player1' or 'player2' - who won from P1's view
            notes: String,
            submittedAt: Date,
            screenshotPath: String
        },
        player2: {
            score1: Number,  // P2's score (their own score)
            score2: Number,  // P1's score (opponent's score from P2's view)
            winner: String,   // 'player1' or 'player2' - who won from P2's view
            notes: String,
            submittedAt: Date,
            screenshotPath: String
        }
    },
    adminVerification: {
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'disputed'],
            default: null
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        verifiedAt: Date,
        rejectionReason: String,
        finalScore1: Number,
        finalScore2: Number,
        finalWinner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true,
    minimize: false
});

// Check if submissions describe the same match result.
// Accept both formats:
// 1) Absolute match order (both submit P1/P2 in same order)
// 2) Player-perspective order (mirrored scores and opposite winner labels)
matchSchema.methods.submissionsMatch = function() {
    const s1 = this.submissions?.player1;
    const s2 = this.submissions?.player2;
    
    if (!s1 || !s2) return false;

    const sameOrientation =
        s1.score1 === s2.score1 &&
        s1.score2 === s2.score2 &&
        s1.winner === s2.winner;

    const mirroredOrientation =
        s1.score1 === s2.score2 &&
        s1.score2 === s2.score1 &&
        s1.winner !== s2.winner;

    return sameOrientation || mirroredOrientation;
};

// Helper to check if both submitted
matchSchema.methods.bothSubmitted = function() {
    return !!(this.submissions?.player1?.submittedAt && this.submissions?.player2?.submittedAt);
};

module.exports = mongoose.model('Match', matchSchema);