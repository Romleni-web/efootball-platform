const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
    emoji: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true }
}, { _id: false });

const messageSchema = new mongoose.Schema({
    roomId: { type: String, required: true, index: true },
    type: { type: String, enum: ['global', 'match'], default: 'global' },
    content: { type: String, required: true },
    sender: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        username: { type: String, required: true },
        avatar: { type: String, default: '' }
    },
    replyTo: {
        messageId: { type: String, default: null },
        content: { type: String, default: null },
        username: { type: String, default: null }
    },
    reactions: [reactionSchema],
    readBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: { type: String },
        readAt: { type: Date, default: Date.now }
    }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
}, {
    timestamps: true
});

// Index for efficient querying
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ roomId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);