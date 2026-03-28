// models/ManualPayout.js - For tracking manual M-Pesa prize payments
const mongoose = require('mongoose');

const manualPayoutSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rank: {
        type: Number,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    sentAt: {
        type: Date
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    transactionId: {
        type: String
    },
    transactionScreenshot: {
        type: String
    },
    notes: {
        type: String
    },
    confirmedByWinner: {
        type: Boolean,
        default: false
    },
    confirmedAt: {
        type: Date
    }
}, {
    timestamps: true
});

manualPayoutSchema.index({ tournament: 1, rank: 1 });
manualPayoutSchema.index({ status: 1 });

module.exports = mongoose.model('ManualPayout', manualPayoutSchema);