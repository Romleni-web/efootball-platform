const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Tournament = require('../models/Tournament');
const auth = require('../middleware/auth');  // Use shared middleware

// Admin middleware
const adminOnly = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// POST /api/payments/entry - FIXED ORDER: auth before upload
router.post('/entry', 
    auth,  // Auth FIRST
    require('../middleware/upload').single('screenshot'), 
    [
        body('tournamentId').notEmpty().isMongoId(),
        body('mpesaNumber').notEmpty().matches(/^[0-9]{10,12}$/),
        body('transactionCode').trim().isLength({ min: 5, max: 20 }).matches(/^[A-Z0-9]+$/i)
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ message: errors.array()[0].msg });
            }

            const { tournamentId, mpesaNumber, transactionCode } = req.body;
            const userId = req.user._id.toString();

            const tournament = await Tournament.findById(tournamentId);
            if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
            if (tournament.status !== 'open') {
                return res.status(400).json({ message: 'Tournament registration is closed' });
            }

            // Check if already registered (atomic check)
            const alreadyRegistered = tournament.registeredPlayers.some(
                p => p.user.toString() === userId
            );
            if (alreadyRegistered) {
                return res.status(400).json({ message: 'Already registered for this tournament' });
            }

            // Check for existing pending payment
            const existingPayment = await Payment.findOne({
                user: userId,
                tournament: tournamentId,
                type: 'entry',
                status: 'pending'
            });
            if (existingPayment) {
                return res.status(400).json({ message: 'Payment already pending verification' });
            }

            // Create payment
            const payment = new Payment({
                user: userId,
                tournament: tournamentId,
                type: 'entry',
                amount: tournament.entryFee,
                mpesaNumber,
                transactionCode: transactionCode.toUpperCase(),
                screenshotPath: req.file ? req.file.filename : null,  // Store filename only, not full path
                status: 'pending'
            });

            await payment.save();

            // Add to tournament atomically
            await Tournament.findByIdAndUpdate(tournamentId, {
                $push: {
                    registeredPlayers: {
                        user: userId,
                        paid: false,
                        paymentId: payment._id,
                        registeredAt: new Date()
                    }
                }
            });

            res.status(201).json({
                success: true,
                message: 'Payment submitted. Waiting for admin verification.',
                payment: { id: payment._id, status: payment.status }
            });
        } catch (error) {
            console.error('Payment entry error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// GET /api/payments/status/:id
router.get('/status/:id', auth, async (req, res) => {
    try {
        const payment = await Payment.findOne({ 
            _id: req.params.id, 
            user: req.user._id 
        });
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        
        res.json({ 
            status: payment.status, 
            verifiedAt: payment.verifiedAt,
            rejectionReason: payment.rejectionReason 
        });
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

// POST /api/payments/verify/:id (Admin only) - FIXED RACE CONDITION
router.post('/verify/:id', auth, adminOnly, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { action, reason } = req.body;
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action' });
        }

        // Atomic fetch-and-update
        const payment = await Payment.findOneAndUpdate(
            { _id: req.params.id, status: 'pending' },
            {
                $set: {
                    status: action === 'approve' ? 'verified' : 'rejected',
                    verifiedBy: req.user._id,
                    verifiedAt: new Date(),
                    ...(action === 'reject' && { rejectionReason: reason })
                }
            },
            { new: true, session }
        );

        if (!payment) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Payment not found or already processed' });
        }

        const tournament = await Tournament.findById(payment.tournament).session(session);

        if (action === 'approve') {
            // Mark player as paid
            await Tournament.findOneAndUpdate(
                { 
                    _id: payment.tournament,
                    'registeredPlayers.user': payment.user
                },
                {
                    $set: { 'registeredPlayers.$.paid': true },
                    $inc: { 
                        prizePool: payment.amount * 0.8,
                        platformFee: payment.amount * 0.2  // Track fees separately
                    }
                },
                { session }
            );
        } else {
            // Remove player from tournament
            await Tournament.findByIdAndUpdate(
                payment.tournament,
                {
                    $pull: { registeredPlayers: { user: payment.user } }
                },
                { session }
            );
        }

        await session.commitTransaction();
        
        res.json({ 
            success: true,
            message: `Payment ${action}d successfully`,
            payment: { id: payment._id, status: payment.status }
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Payment verify error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        session.endSession();
    }
});

module.exports = router;