const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const { TournamentLogicFactory } = require('./tournamentLogic');
const logger = require('../utils/logger')('AdminService');

/**
 * Resolve a match result and handle tournament advancement.
 * In dynamic mode, automatically generates the next round when all matches in current round complete.
 */
const resolveMatchResult = async (matchId, adminUser, resolutionData) => {
    const { decision, score1, score2, winner, reason } = resolutionData;
    const match = await Match.findById(matchId);
    if (!match) throw new Error('Match not found');

    // 1. Apply the resolution to the match
    if (decision === 'custom') {
        match.score1 = parseInt(score1);
        match.score2 = parseInt(score2);
        match.winner = winner === 'player1' ? match.player1 : match.player2;
    } else {
        const source = decision === 'player1_correct' ? match.submissions.player1 : match.submissions.player2;
        if (!source) throw new Error('Submission source missing for resolution');
        
        match.score1 = source.score1;
        match.score2 = source.score2;
        match.winner = source.winner === 'player1' ? match.player1 : match.player2;
    }

    match.status = 'completed';
    match.adminVerification = {
        status: 'approved',
        verifiedBy: adminUser._id,
        verifiedAt: new Date(),
        rejectionReason: reason || (decision === 'custom' ? 'Admin custom resolution' : `Approved ${decision.replace('_correct', '')} version`)
    };

    await match.save();

    // 2. Handle Tournament Advancement
    const tournament = await Tournament.findById(match.tournament);
    if (tournament) {
        const allMatches = await Match.find({ tournament: tournament._id });
        const tournamentForLogic = { ...tournament.toObject(), matches: allMatches };
        const logic = TournamentLogicFactory.create(tournamentForLogic);
        
        if (['round_robin', 'league', 'swiss'].includes(tournament.format)) {
            tournament.standings = logic.calculateStandings();
        } else {
            // For single/double elimination, use dynamic advancement
            await logic.advanceWinner(match);
            if (tournament.format === 'double_elimination' && logic.advanceLoser) {
                await logic.advanceLoser(match);
            }
        }

        // 3. Check for completion and finalize
        const updatedMatches = await Match.find({ tournament: tournament._id });
        if (logic.isTournamentComplete()) {
            const rankings = logic.getFinalRankings ? 
                logic.getFinalRankings(updatedMatches) : 
                logic.calculateStandings();
            
            tournament.finalizeResults(rankings);
        }

        await tournament.save();
    }

    return match;
};

/**
 * Self-healing function to fix stuck brackets.
 * For dynamic mode: detects if next round needs to be generated and creates it.
 * For static mode: iterates through all completed matches and ensures winners have advanced.
 */
const syncTournamentBracket = async (tournamentId) => {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new Error('Tournament not found');

    const matches = await Match.find({ tournament: tournamentId });
    const logic = TournamentLogicFactory.create(tournament);

    logger.info(`Syncing bracket for: ${tournament.name}`);
    
    // Check if we're in dynamic mode (single elimination with reseeding enabled)
    const isDynamic = tournament.format === 'single_elimination' && 
                      tournament.settings?.reseedAfterRound !== false;
    
    if (isDynamic) {
        // Dynamic mode: find the highest completed round and generate next if needed
        const completedRounds = [...new Set(matches.filter(m => 
            ['completed', 'bye'].includes(m.status) && m.winner
        ).map(m => m.round))].sort((a, b) => a - b);
        
        if (completedRounds.length > 0) {
            const lastCompletedRound = completedRounds[completedRounds.length - 1];
            const nextRoundExists = matches.some(m => m.round === lastCompletedRound + 1);
            
            if (!nextRoundExists) {
                // Generate next round
                const roundMatches = matches.filter(m => m.round === lastCompletedRound);
                const allCompleted = roundMatches.every(m => 
                    ['completed', 'bye'].includes(m.status)
                );
                
                if (allCompleted) {
                    const winners = roundMatches.filter(m => m.winner).map(m => m.winner);
                    if (winners.length > 1) {
                        logger.info(`Generating round ${lastCompletedRound + 1} from sync...`);
                        const nextMatches = await logic.generateNextRound(lastCompletedRound + 1, winners);
                        const saved = await Match.insertMany(nextMatches);
                        tournament.matches.push(...saved.map(m => m._id));
                        tournament.currentRound = lastCompletedRound + 1;
                        await tournament.save();
                        return { 
                            success: true, 
                            mode: 'dynamic', 
                            action: 'generated_next_round',
                            round: lastCompletedRound + 1,
                            newMatches: saved.length 
                        };
                    }
                }
            }
        }
        
        return { 
            success: true, 
            mode: 'dynamic', 
            action: 'no_action_needed',
            message: 'Bracket is up to date' 
        };
    }
    
    // Static mode: process all completed matches to ensure advancement
    const completedMatches = matches.filter(m => 
        ['completed', 'bye'].includes(m.status) && m.winner
    ).sort((a, b) => (a.round - b.round) || (a.matchNumber - b.matchNumber));

    for (const match of completedMatches) {
        await logic.advanceWinner(match);
        if (tournament.format === 'double_elimination' && logic.advanceLoser) {
            await logic.advanceLoser(match);
        }
    }

    // Update standings if it's a round-based tournament
    if (['round_robin', 'league', 'swiss'].includes(tournament.format)) {
        tournament.standings = logic.calculateStandings();
        await tournament.save();
    }

    return { 
        success: true, 
        mode: 'static', 
        processedMatches: completedMatches.length 
    };
};

/**
 * Manually triggers the generation of the next round pairings.
 * Works for both Swiss and dynamic single elimination.
 */
const regenerateRound = async (tournamentId, roundNumber) => {
    const tournament = await Tournament.findById(tournamentId).populate('matches');
    if (!tournament) throw new Error('Tournament not found');

    const logic = TournamentLogicFactory.create(tournament);
    
    // Find any match in the round to use as a trigger for advancement logic
    const roundMatch = tournament.matches.find(m => m.round === roundNumber && m.status === 'completed');
    if (!roundMatch) throw new Error(`No completed matches found in round ${roundNumber} to trigger regeneration.`);

    // For dynamic single elimination, use generateNextRound
    if (tournament.format === 'single_elimination' && logic.generateNextRound) {
        const roundMatches = await Match.find({ 
            tournament: tournamentId, 
            round: roundNumber 
        });
        const winners = roundMatches.filter(m => m.winner).map(m => m.winner);
        
        if (winners.length === 0) {
            return { success: false, message: 'No winners found to generate next round.' };
        }
        
        const nextMatches = await logic.generateNextRound(roundNumber + 1, winners);
        
        if (Array.isArray(nextMatches) && nextMatches.length > 0) {
            const saved = await Match.insertMany(nextMatches);
            tournament.matches.push(...saved.map(m => m._id));
            tournament.currentRound = roundNumber + 1;
            await tournament.save();
            return { success: true, newMatches: saved.length, round: roundNumber + 1 };
        }
    }
    
    // Fallback to legacy behavior for Swiss
    const nextMatches = await logic.advanceWinner(roundMatch);
    
    if (Array.isArray(nextMatches) && nextMatches.length > 0) {
        const saved = await Match.insertMany(nextMatches);
        tournament.matches.push(...saved.map(m => m._id));
        tournament.currentRound = roundNumber + 1;
        await tournament.save();
        return { success: true, newMatches: saved.length };
    }
    
    return { success: false, message: 'No new matches were generated for the next round.' };
};

/**
 * Force generate a specific round (admin override).
 * Useful for manual bracket adjustments or recovery.
 */
const forceGenerateRound = async (tournamentId, roundNumber, playerIds) => {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new Error('Tournament not found');

    const logic = TournamentLogicFactory.create(tournament);
    
    if (!logic.generateNextRound) {
        throw new Error('This tournament format does not support dynamic round generation');
    }

    // Verify all players are valid ObjectIds
    const validPlayers = playerIds.filter(id => mongoose.isValidObjectId(id));
    
    if (validPlayers.length < 2) {
        throw new Error('At least 2 valid players required to generate a round');
    }

    const matches = await logic.generateNextRound(roundNumber, validPlayers);
    const saved = await Match.insertMany(matches);
    
    tournament.matches.push(...saved.map(m => m._id));
    if (roundNumber > tournament.currentRound) {
        tournament.currentRound = roundNumber;
    }
    await tournament.save();

    return {
        success: true,
        round: roundNumber,
        newMatches: saved.length,
        matches: saved
    };
};

const getPrizeDistributionList = async (tournamentId) => {
    const tournament = await Tournament.findById(tournamentId).populate('winners.player');
    if (!tournament || tournament.status !== 'finished') return [];

    return tournament.winners.map(w => ({
        username: w.player.username,
        phoneNumber: w.player.phoneNumber || 'Not Set',
        rank: w.rank,
        amount: w.prize
    }));
};

const calculatePrize = (pool, rank, distribution) => {
    const percentages = [
        distribution.first || 50,
        distribution.second || 30, 
        distribution.third || 20
    ];
    return Math.floor(pool * (percentages[rank - 1] || 0) / 100);
};

module.exports = {
    resolveMatchResult,
    calculatePrize,
    syncTournamentBracket,
    regenerateRound,
    forceGenerateRound
};