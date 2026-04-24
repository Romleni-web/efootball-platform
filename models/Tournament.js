const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    format: {
        type: String,
        enum: ['single_elimination', 'double_elimination', 'round_robin', 'swiss', 'league'],
        default: 'single_elimination'
    },
    settings: {
        bestOf: { type: Number, default: 1 },
        bronzeMatch: { type: Boolean, default: false },
        rounds: { type: Number, default: 1 },
        pointsWin: { type: Number, default: 3 },
        pointsDraw: { type: Number, default: 1 },
        pointsLoss: { type: Number, default: 0 },
        swissRounds: { type: Number, default: 5 },
        maxPlayers: { type: Number, default: 32 },
        minPlayers: { type: Number, default: 2 },
        registrationDeadline: { type: Date },
        // NEW: Dynamic bracket re-seeding settings
        reseedAfterRound: { 
            type: Boolean, 
            default: true,
            description: 'If true, bracket is re-generated after each round with winners re-seeded'
        },
        reseedMethod: {
            type: String,
            enum: ['original_seed', 'random', 'standings'],
            default: 'original_seed',
            description: 'How to re-seed winners for next round: original_seed (highest vs lowest), random, or standings-based'
        }
    },
    entryFee: {
        type: Number,
        required: true,
        min: 0
    },
    prizePool: {
        type: Number,
        default: 0
    },
    prizeDistribution: {
        first: { type: Number, default: 50 },
        second: { type: Number, default: 30 },
        third: { type: Number, default: 20 }
    },
    prizeDistributionStatus: {
        type: String,
        enum: ['pending', 'initiated', 'completed', 'failed', 'partial'],
        default: 'pending'
    },
    prizeDistributionResults: [{
        rank: Number,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['pending', 'initiated', 'completed', 'failed'] },
        paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
        transactionId: String,
        amount: Number,
        reason: String
    }],
    prizeDistributionInitiatedAt: Date,
    prizeDistributionCompletedAt: Date,
    adminPhone: {
        type: String,
        required: true
    },
    whatsappLink: {
        type: String,
        trim: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['draft', 'open', 'registration_closed', 'ongoing', 'finished'],
        default: 'open'
    },
    registeredPlayers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        seed: { type: Number, default: null },
        paid: { type: Boolean, default: false },
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payment'
        },
        registeredAt: { type: Date, default: Date.now },
        checkedIn: { type: Boolean, default: false }
    }],
    standings: [{
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        played: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        goalsFor: { type: Number, default: 0 },
        goalsAgainst: { type: Number, default: 0 },
        goalDifference: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        rank: { type: Number }
    }],
    matches: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bracketGeneratedAt: { type: Date, default: null },
    currentRound: { type: Number, default: 0 },
    winners: [{
        rank: Number,
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        prize: Number
    }]
}, {
    timestamps: true
});

tournamentSchema.index({ status: 1, format: 1 });
tournamentSchema.index({ 'registeredPlayers.user': 1 });

tournamentSchema.methods.canFinish = function() {
    return this.status === 'ongoing';
};

tournamentSchema.methods.getPrizeForRank = function(rank) {
    const distribution = this.prizeDistribution;
    const percentages = [distribution?.first || 50, distribution?.second || 30, distribution?.third || 20];
    return Math.floor(this.prizePool * (percentages[rank - 1] || 0) / 100);
};

tournamentSchema.methods.finalizeResults = function(rankings) {
    this.status = 'finished';
    this.winners = rankings.map((r, i) => ({
        rank: r.rank || (i + 1),
        player: r.player,
        prize: this.getPrizeForRank(r.rank || (i + 1))
    }));
    this.prizeDistributionStatus = 'initiated';
    this.prizeDistributionInitiatedAt = new Date();
};

module.exports = mongoose.model('Tournament', tournamentSchema);