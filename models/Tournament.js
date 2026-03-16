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
    entryFee: {
        type: Number,
        required: true,
        min: 0
    },
    prizePool: {
        type: Number,
        default: 0
    },
    maxPlayers: {
        type: Number,
        default: 32
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
    status: {
        type: String,
        enum: ['open', 'ongoing', 'finished'],
        default: 'open'
    },
    registeredPlayers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        paid: {
            type: Boolean,
            default: false
        },
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payment'
        },
        registeredAt: {
            type: Date,
            default: Date.now
        }
    }],
    matches: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Tournament', tournamentSchema);