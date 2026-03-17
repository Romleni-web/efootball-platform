const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Tournament = require('../models/Tournament');
const jwt = require('jsonwebtoken');

// Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ message: 'No token' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'efootball_secret_key');
        const user = await require('../models/User').findById(decoded.id);
        if (!user) return res.status(401).json({ message: 'Invalid token' });
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const adminOnly = async (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    next();
};

// POST /api/payments/entry
router.post('/entry', require('../middleware/upload').single('screenshot'), auth, [
    body('tournamentId').notEmpty(),
    body('mpesaNumber').notEmpty(),
    body('transactionCode').trim().isLength({ min: 5 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

        const { tournamentId, mpesaNumber, transactionCode } = req.body;

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        if (tournament.status !== 'open') return res.status(400).json({ message: 'Tournament registration is closed' });

        const alreadyRegistered = tournament.registeredPlayers.some(p => p.user.toString() === req.user.id);
        if (alreadyRegistered) return res.status(400).json({ message: 'Already registered for this tournament' });

        const existingPayment = await Payment.findOne({
            user: req.user.id,
            tournament: tournamentId,
            type: 'entry',
            status: 'pending'
        });
        if (existingPayment) return res.status(400).json({ message: 'Payment already pending verification' });

        const payment = new Payment({
            user: req.user.id,
            tournament: tournamentId,
            type: 'entry',
            amount: tournament.entryFee,
            mpesaNumber,
            transactionCode,
            screenshotPath: req.file ? req.file.path : null
        });

        await payment.save();

        tournament.registeredPlayers.push({
            user: req.user.id,
            paid: false,
            paymentId: payment._id
        });
        await tournament.save();

        res.status(201).json({
            message: 'Payment submitted successfully. Waiting for admin verification.',
            payment: { id: payment._id, status: payment.status }
        });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// GET /api/payments/status/:id
router.get('/status/:id', auth, async (req, res) => {
    try {
        const payment = await Payment.findOne({ _id: req.params.id, user: req.user.id });
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        res.json({ status: payment.status, verifiedAt: payment.verifiedAt });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/payments/pending (Admin only)
router.get('/pending', auth, adminOnly, async (req, res) => {
    try {
        const payments = await Payment.find({ status: 'pending' })
            .populate('user', 'username email')
            .populate('tournament', 'name entryFee')
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/payments/verify/:id (Admin only)
router.post('/verify/:id', auth, adminOnly, async (req, res) => {
    try {
        const { action, reason } = req.body;
        if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'Invalid action' });

        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        if (payment.status !== 'pending') return res.status(400).json({ message: 'Payment already processed' });

        const tournament = await Tournament.findById(payment.tournament);

        if (action === 'approve') {
            payment.status = 'verified';
            payment.verifiedBy = req.user.id;
            payment.verifiedAt = new Date();

            const playerIndex = tournament.registeredPlayers.findIndex(p => p.user.toString() === payment.user.toString());
            if (playerIndex !== -1) tournament.registeredPlayers[playerIndex].paid = true;
            tournament.prizePool += payment.amount * 0.8;
        } else {
            payment.status = 'rejected';
            payment.rejectionReason = reason;
            payment.verifiedBy = req.user.id;
            payment.verifiedAt = new Date();
            tournament.registeredPlayers = tournament.registeredPlayers.filter(p => p.user.toString() !== payment.user.toString());
        }

        await payment.save();
        await tournament.save();

        res.json({ message: `Payment ${action}d successfully`, payment: { id: payment._id, status: payment.status } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CRITICAL: Export the router
module.exports = router;