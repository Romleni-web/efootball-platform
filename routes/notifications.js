const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

// Configure VAPID keys (generate these once and store in .env)
// Run: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@efootball-arena.com';

webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Save push subscription
router.post('/subscribe', auth, async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        const userId = req.user._id;

        await User.findByIdAndUpdate(userId, {
            pushSubscription: {
                endpoint,
                keys,
                createdAt: new Date()
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ message: 'Failed to save subscription' });
    }
});

// Remove push subscription
router.post('/unsubscribe', auth, async (req, res) => {
    try {
        const { endpoint } = req.body;
        const userId = req.user._id;

        await User.findByIdAndUpdate(userId, {
            $pull: {
                pushSubscriptions: { endpoint }
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ message: 'Failed to remove subscription' });
    }
});

// Send notification to specific user (admin or system)
router.post('/send', auth, async (req, res) => {
    try {
        // Only admin can send push notifications
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }

        const { userId, title, body, data } = req.body;

        const user = await User.findById(userId);
        if (!user || !user.pushSubscription) {
            return res.status(404).json({ message: 'User has no push subscription' });
        }

        const payload = JSON.stringify({
            title: title || 'eFootball Arena',
            body: body || 'New notification',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: 'efootball-notification',
            requireInteraction: true,
            data: data || { url: '/' }
        });

        await webpush.sendNotification(user.pushSubscription, payload);

        res.json({ success: true });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ message: 'Failed to send notification' });
    }
});

// Send notification to all users (broadcast)
router.post('/broadcast', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }

        const { title, body, data } = req.body;

        const users = await User.find({ pushSubscription: { $exists: true, $ne: null } });
        
        const payload = JSON.stringify({
            title: title || 'eFootball Arena',
            body: body || 'New announcement',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: 'efootball-broadcast',
            requireInteraction: false,
            data: data || { url: '/' }
        });

        const results = await Promise.allSettled(
            users.map(user => 
                webpush.sendNotification(user.pushSubscription, payload)
                    .catch(err => {
                        // Remove invalid subscriptions
                        if (err.statusCode === 410) {
                            User.findByIdAndUpdate(user._id, { $unset: { pushSubscription: 1 } });
                        }
                        throw err;
                    })
            )
        );

        const sent = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        res.json({ success: true, sent, failed, total: users.length });
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ message: 'Failed to broadcast' });
    }
});

module.exports = router;