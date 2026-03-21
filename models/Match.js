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
        enum: ['scheduled', 'ongoing', 'completed', 'disputed'],
        default: 'scheduled'
    },
    nextMatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match',
        default: null
    },
    // NEW: Dual submission system
    submissions: {
        player1: {
            score1: Number,
            score2: Number,
            winner: String, // 'player1' or 'player2'
            notes: String,
            submittedAt: Date,
            screenshotPath: String
        },
        player2: {
            score1: Number,
            score2: Number,
            winner: String,
            notes: String,
            submittedAt: Date,
            screenshotPath: String
        }
    },
    // Admin verification
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
    timestamps: true
});

// Helper method to check if submissions match
matchSchema.methods.submissionsMatch = function() {
    const s1 = this.submissions?.player1;
    const s2 = this.submissions?.player2;
    
    if (!s1 || !s2) return false;
    
    return s1.score1 === s2.score1 && 
           s1.score2 === s2.score2 && 
           s1.winner === s2.winner;
};

// Helper to check if both submitted
matchSchema.methods.bothSubmitted = function() {
    return this.submissions?.player1 && this.submissions?.player2;
};

module.exports = mongoose.model('Match', matchSchema);