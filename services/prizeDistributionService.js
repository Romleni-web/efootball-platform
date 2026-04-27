// services/prizeDistributionService.js - For manual M-Pesa prize distribution
const ManualPayout = require('../models/ManualPayout');
const Tournament = require('../models/Tournament');

class PrizeDistributionService {
    async initializePayouts(tournamentId) {
        const tournament = await Tournament.findById(tournamentId)
            .populate('winners.player', 'username phoneNumber');

        if (!tournament) throw new Error('Tournament not found');
        if (tournament.status !== 'finished') {
            throw new Error('Tournament must be finished first');
        }

        const payouts = [];
        for (const winner of tournament.winners) {
            if (!winner.prize || winner.prize <= 0) continue;

            // Use findOne with upsert pattern to prevent race conditions
            let existing = await ManualPayout.findOne({
                tournament: tournamentId,
                winner: winner.player._id
            });
            
            if (existing) {
                payouts.push(existing);
                continue;
            }

            const payout = new ManualPayout({
                tournament: tournamentId,
                winner: winner.player._id,
                rank: winner.rank,
                amount: winner.prize,
                phoneNumber: winner.player.phoneNumber || 'PENDING',
                status: 'pending'
            });
            
            // Use findOneAndUpdate with upsert to handle race condition
            const savedPayout = await ManualPayout.findOneAndUpdate(
                { tournament: tournamentId, winner: winner.player._id },
                payout.toObject(),
                { upsert: true, new: true }
            );
            payouts.push(savedPayout);
        }

        tournament.prizeDistributionStatus = 'pending';
        tournament.prizeDistributionInitiatedAt = new Date();
        await tournament.save();
        return payouts;
    }

    async getPendingPayouts(tournamentId) {
        return await ManualPayout.find({ 
            tournament: tournamentId,
            status: { $in: ['pending', 'processing'] }
        })
        .populate('winner', 'username teamName phoneNumber')
        .sort({ rank: 1 });
    }

    async markAsProcessing(payoutId, adminId) {
        const payout = await ManualPayout.findById(payoutId);
        if (!payout) throw new Error('Payout not found');
        if (payout.status !== 'pending') {
            throw new Error('Payout is not in pending status');
        }

        payout.status = 'processing';
        payout.sentBy = adminId;
        await payout.save();
        return payout;
    }

    async markAsSent(payoutId, adminId, { transactionId, notes, screenshotPath }) {
        const payout = await ManualPayout.findById(payoutId);
        if (!payout) throw new Error('Payout not found');

        payout.status = 'completed';
        payout.sentAt = new Date();
        payout.sentBy = adminId;
        payout.transactionId = transactionId;
        payout.notes = notes;
        payout.transactionScreenshot = screenshotPath;

        await payout.save();
        await this._checkAllComplete(payout.tournament);
        return payout;
    }

    async confirmReceipt(payoutId, userId) {
        const payout = await ManualPayout.findOne({
            _id: payoutId,
            winner: userId
        });
        
        if (!payout) throw new Error('Payout not found');
        if (payout.status !== 'completed') {
            throw new Error('Payment not yet sent');
        }

        payout.confirmedByWinner = true;
        payout.confirmedAt = new Date();
        await payout.save();
        return payout;
    }

    async getPayoutSummary(tournamentId) {
        const payouts = await ManualPayout.find({ tournament: tournamentId });
        
        return {
            total: payouts.length,
            pending: payouts.filter(p => p.status === 'pending').length,
            processing: payouts.filter(p => p.status === 'processing').length,
            completed: payouts.filter(p => p.status === 'completed').length,
            confirmedByWinners: payouts.filter(p => p.confirmedByWinner).length,
            totalAmount: payouts.reduce((sum, p) => sum + p.amount, 0),
            paidAmount: payouts
                .filter(p => p.status === 'completed')
                .reduce((sum, p) => sum + p.amount, 0)
        };
    }

    async _checkAllComplete(tournamentId) {
        const pending = await ManualPayout.countDocuments({
            tournament: tournamentId,
            status: { $in: ['pending', 'processing'] }
        });

        if (pending === 0) {
            await Tournament.findByIdAndUpdate(tournamentId, {
                prizeDistributionStatus: 'completed',
                prizeDistributionCompletedAt: new Date()
            });
        }
    }
}

module.exports = new PrizeDistributionService();