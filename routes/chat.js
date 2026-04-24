const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middleware/auth');

// Get chat history with pagination
router.get('/history/:roomId', auth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { page = 1, limit = 50, before } = req.query;
        
        const query = { roomId, isDeleted: false };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const total = await Message.countDocuments(query);

        res.json({
            messages: messages.reverse(),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                hasMore: total > parseInt(page) * parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Chat history error:', error);
        res.status(500).json({ message: 'Failed to load chat history' });
    }
});

// Add reaction to message
router.post('/reaction', auth, async (req, res) => {
    try {
        const { messageId, emoji } = req.body;
        const userId = req.user._id;
        const username = req.user.username;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Remove existing reaction from this user
        message.reactions = message.reactions.filter(r => r.userId.toString() !== userId.toString());

        // Add new reaction
        message.reactions.push({ emoji, userId, username });
        await message.save();

        res.json({ success: true, reactions: message.reactions });
    } catch (error) {
        console.error('Reaction error:', error);
        res.status(500).json({ message: 'Failed to add reaction' });
    }
});

// Remove reaction
router.delete('/reaction/:messageId', auth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        message.reactions = message.reactions.filter(r => r.userId.toString() !== userId.toString());
        await message.save();

        res.json({ success: true, reactions: message.reactions });
    } catch (error) {
        console.error('Remove reaction error:', error);
        res.status(500).json({ message: 'Failed to remove reaction' });
    }
});

// Mark messages as read
router.post('/read', auth, async (req, res) => {
    try {
        const { roomId, messageIds } = req.body;
        const userId = req.user._id;
        const username = req.user.username;

        await Message.updateMany(
            {
                _id: { $in: messageIds },
                'readBy.userId': { $ne: userId }
            },
            {
                $push: {
                    readBy: { userId, username, readAt: new Date() }
                }
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ message: 'Failed to mark as read' });
    }
});

// Delete message (soft delete)
router.delete('/message/:messageId', auth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findOne({ _id: messageId, 'sender.userId': userId });
        if (!message) {
            return res.status(404).json({ message: 'Message not found or not authorized' });
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ message: 'Failed to delete message' });
    }
});

module.exports = router;