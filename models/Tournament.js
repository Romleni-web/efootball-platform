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
    // NEW: Tournament format
    format: {
        type: String,
        enum: ['single_elimination', 'double_elimination', 'round_robin', 'swiss', 'league'],
        default: 'single_elimination'
    },
    // NEW: Format-specific settings
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
        registrationDeadline: { type: Date }
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
    // NEW: Standings for round-based formats
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

module.exports = mongoose.model('Tournament', tournamentSchema);