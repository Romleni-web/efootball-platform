const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const { TournamentLogicFactory } = require('./tournamentLogic');

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
 * Iterates through all completed matches and ensures winners have advanced.
 */
const syncTournamentBracket = async (tournamentId) => {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new Error('Tournament not found');

    const matches = await Match.find({ tournament: tournamentId });
    const logic = TournamentLogicFactory.create(tournament);

    console.log(`Syncing bracket for: ${tournament.name}`);
    
    // 1. Process all completed matches to ensure advancement
    const completedMatches = matches.filter(m => ['completed', 'bye'].includes(m.status) && m.winner);
    
    // Sort by round/matchNumber to ensure we advance in the correct order
    completedMatches.sort((a, b) => (a.round - b.round) || (a.matchNumber - b.matchNumber));

    for (const match of completedMatches) {
        await logic.advanceWinner(match);
        if (tournament.format === 'double_elimination' && logic.advanceLoser) {
            await logic.advanceLoser(match);
        }
    }

    // 2. Update standings if it's a round-based tournament
    if (['round_robin', 'league', 'swiss'].includes(tournament.format)) {
        tournament.standings = logic.calculateStandings();
        await tournament.save();
    }

    return { success: true, processedMatches: completedMatches.length };
};

const calculatePrize = (pool, rank, distribution) => {
        distribution.first || 50, 
        distribution.second || 30, 
        distribution.third || 20
;
    return Math.floor(pool * (percentages[rank - 1] || 0) / 100);
};

module.exports = {
    resolveMatchResult,
    calculatePrize
};