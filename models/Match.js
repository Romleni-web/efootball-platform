// models/Match.js - FIXED VERSION
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
    // Bracket type for double elimination
    bracket: {
        type: String,
        enum: ['winners', 'losers', 'grand_finals', 'grand_finals_reset'],
        default: null
    },
    isBronzeMatch: {
        type: Boolean,
        default: false
    },
    nextMatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match',
        default: null
    },
    // For double elimination - where losers go
    losersNextMatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match',
        default: null
    },
    // Track source matches for proper slot assignment
    sourceMatches: [{
        matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
        slot: { type: String, enum: ['player1', 'player2'] },
        takesLoser: { type: Boolean, default: false }
    }],
    submissions: {
        player1: {
            score1: Number,
            score2: Number,
            winner: String,
            notes: String,
            submittedAt: Date,
            screenshotPath: String,
            submittedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        },
        player2: {
            score1: Number,
            score2: Number,
            winner: String,
            notes: String,
            submittedAt: Date,
            screenshotPath: String,
            submittedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
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

// FIXED: Properly validate both submission orientations
matchSchema.methods.submissionsMatch = function() {
    const s1 = this.submissions?.player1;
    const s2 = this.submissions?.player2;
    
    if (!s1 || !s2) return false;

    // Same orientation: both agree on scores and winner label
    const sameOrientation =
        s1.score1 === s2.score1 &&
        s1.score2 === s2.score2 &&
        s1.winner === s2.winner;

    // Mirrored orientation: P2 submitted from their perspective
    // P1's score1 = P2's score2 (P1's goals), P1's score2 = P2's score1 (P2's goals)
    // Winner labels must be opposite AND map correctly to actual players
    const mirroredOrientation =
        s1.score1 === s2.score2 &&
        s1.score2 === s2.score1 &&
        ((s1.winner === 'player1' && s2.winner === 'player2') ||
         (s1.winner === 'player2' && s2.winner === 'player1'));

    return sameOrientation || mirroredOrientation;
};

// Helper to check if both submitted
matchSchema.methods.bothSubmitted = function() {
    return !!(this.submissions?.player1?.submittedAt && this.submissions?.player2?.submittedAt);
};

// Get loser of match
matchSchema.methods.getLoser = function() {
    if (!this.winner || !this.player1 || !this.player2) return null;
    return this.player1.equals(this.winner) ? this.player2 : this.player1;
};

// Get winner label for a player
matchSchema.methods.getWinnerLabel = function(playerId) {
    if (!this.winner) return null;
    if (this.player1?.equals(playerId)) return 'player1';
    if (this.player2?.equals(playerId)) return 'player2';
    return null;
};

module.exports = mongoose.model('Match', matchSchema);