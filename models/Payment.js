const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    type: {
        type: String,
        enum: ['entry', 'prize'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    mpesaNumber: {
        type: String,
        required: true
    },
    transactionCode: {
        type: String,
        required: function() {
            return this.type === 'entry';
        }
    },
    screenshotPath: {
        type: String,
        required: function() {
            return this.type === 'entry';
        }
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: {
        type: Date
    },
    rejectionReason: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);