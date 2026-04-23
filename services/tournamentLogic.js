// services/tournamentLogic.js - COMPLETE FIXED VERSION
const Match = require('../models/Match');

class TournamentLogic {
    constructor(tournament) {
        this.tournament = tournament;
    }

    async generateBracket(players) {
        throw new Error('Must implement generateBracket');
    }

    async advanceWinner(match) {
        throw new Error('Must implement advanceWinner');
    }

    calculateStandings() {
        return [];
    }

    getBracketData(matches) {
        const rounds = {};
        matches.forEach(match => {
            const round = match.round || 1;
            if (!rounds[round]) rounds[round] = [];
            rounds[round].push(match);
        });
        return Object.keys(rounds).sort((a, b) => a - b).map(round => ({
            round: parseInt(round),
            matches: rounds[round].sort((a, b) => a.matchNumber - b.matchNumber)
        }));
    }

    getFinalRankings(matches) {
        return [];
    }

    isTournamentComplete() {
        const matches = this.tournament.matches || [];
        if (matches.length === 0) return false;
        return matches.every(m => ['completed', 'bye'].includes(m.status));
    }

    _compareUsers(userA, userB) {
        if (!userA || !userB) return false;
        const idA = (userA._id || userA).toString();
        const idB = (userB._id || userB).toString();
        return idA === idB;
    }

    _shuffleAndSeed(players) {
        return [...players].sort((a, b) => {
            if (a.seed && b.seed) return a.seed - b.seed;
            if (a.seed) return -1;
            if (b.seed) return 1;
            return Math.random() - 0.5;
        });
    }

    _nextPowerOf2(n) {
        return Math.pow(2, Math.ceil(Math.log2(n)));
    }
}

// ==================== SINGLE ELIMINATION ====================
class SingleEliminationLogic extends TournamentLogic {
    async generateBracket(players) {
        const shuffled = this._shuffleAndSeed(players);
        const numPlayers = shuffled.length;
        const bracketSize = this._nextPowerOf2(numPlayers);
        const byes = bracketSize - numPlayers;
        const rounds = Math.log2(bracketSize);
        
        const matches = [];
        let matchNumber = 1;

        // Round 1 with byes
        const round1Matches = [];
        let playerIndex = 0;
        
        for (let i = 0; i < bracketSize / 2; i++) {
            let player1, player2;
            
            if (i < byes) {
                player1 = shuffled[playerIndex++];
                player2 = null;
            } else {
                player1 = shuffled[playerIndex++];
                player2 = shuffled[playerIndex++];
            }

            const match = new Match({
                tournament: this.tournament._id,
                round: 1,
                matchNumber: matchNumber++,
                player1: player1?.user || null,
                player2: player2?.user || null,
                status: player2 ? 'scheduled' : 'completed',
                winner: player2 ? null : (player1 ? player1.user : null),
                nextMatch: null
            });

            round1Matches.push(match);
            matches.push(match);
        }

        // Subsequent rounds
        for (let round = 2; round <= rounds; round++) {
            const matchesInRound = bracketSize / Math.pow(2, round);
            const roundMatches = [];
            
            for (let i = 0; i < matchesInRound; i++) {
                const match = new Match({
                    tournament: this.tournament._id,
                    round: round,
                    matchNumber: matchNumber++,
                    player1: null,
                    player2: null,
                    status: 'pending',
                    nextMatch: null
                });
                roundMatches.push(match);
                matches.push(match);
            }
            
            // Link previous round matches to this round
            const prevRoundMatches = matches.filter(m => m.round === round - 1);
            for (let i = 0; i < prevRoundMatches.length; i += 2) {
                const nextMatchIndex = Math.floor(i / 2);
                if (roundMatches[nextMatchIndex]) {
                    prevRoundMatches[i].nextMatch = roundMatches[nextMatchIndex]._id;
                    if (prevRoundMatches[i + 1]) {
                        prevRoundMatches[i + 1].nextMatch = roundMatches[nextMatchIndex]._id;
                    }
                }
            }
        }

        // Bronze match - losers of semifinals go here
        if (this.tournament.settings.bronzeMatch) {
            const semifinals = matches.filter(m => m.round === rounds - 1);
            const bronzeMatch = new Match({
                tournament: this.tournament._id,
                round: rounds,
                matchNumber: matchNumber,
                isBronzeMatch: true,
                player1: null,
                player2: null,
                status: 'pending',
                nextMatch: null
            });
            matches.push(bronzeMatch);
            
            if (semifinals.length === 2) {
                semifinals.forEach(sf => {
                    sf.bronzeMatch = bronzeMatch._id;
                });
            }
        }

        return matches;
    }

    async advanceWinner(match) {
        if (!match.winner) return null;
        const winnerId = (match.winner?._id || match.winner).toString();
        if (!winnerId) return null;

        // Handle bronze match for losers
        let bronzeUpdate = null;
        if (this.tournament.settings.bronzeMatch && match.bronzeMatch) {
            bronzeUpdate = await this._advanceToBronze(match);
        }
        // Continue to advance winner even if bronze match was handled

        const nextMatchId = match.nextMatch?._id || match.nextMatch;
        if (!nextMatchId) return null;

        const nextMatch = await Match.findById(nextMatchId);
        if (!nextMatch) return null;

        // Determine slot: odd matchNumbers → player1, even → player2
        const isPlayer1Slot = match.matchNumber % 2 !== 0;
        
        const updateData = {};
        if (isPlayer1Slot) {
            updateData.player1 = winnerId;
        } else {
            updateData.player2 = winnerId;
        }
        
        const willHavePlayer1 = isPlayer1Slot ? winnerId : nextMatch.player1;
        const willHavePlayer2 = isPlayer1Slot ? nextMatch.player2 : winnerId;
        
        if (willHavePlayer1 && willHavePlayer2) {
            updateData.status = 'scheduled';
        }
        
        return await Match.findByIdAndUpdate(
            nextMatchId,
            { $set: updateData },
            { new: true }
        );
    }

    async _advanceToBronze(match) {
        const bronzeMatchId = match.bronzeMatch?._id || match.bronzeMatch;
        const bronzeMatch = await Match.findById(bronzeMatchId);
        if (!bronzeMatch || bronzeMatch.status === 'completed') return null;

        const winnerId = (match.winner?._id || match.winner).toString();
        const loser = match.player1.toString() === winnerId ? match.player2 : match.player1;
        
        const updateData = {};
        if (!bronzeMatch.player1) {
            updateData.player1 = loser;
        } else if (!bronzeMatch.player2) {
            updateData.player2 = loser;
        } else {
            return null;
        }
        
        if (updateData.player1 && updateData.player2) {
            updateData.status = 'scheduled';
        }
        
        return await Match.findByIdAndUpdate(
            bronzeMatchId,
            { $set: updateData },
            { new: true }
        );
    }

    getFinalRankings(matches) {
        const rankings = [];
        const nonBronzeMatches = matches.filter(m => !m.isBronzeMatch);
        const finalMatch = nonBronzeMatches.reduce((max, m) => m.round > max.round ? m : max, nonBronzeMatches[0]);
        
        if (finalMatch?.winner) {
            rankings.push({ rank: 1, player: finalMatch.winner });
            rankings.push({ 
                rank: 2, 
                player: finalMatch.player1.equals(finalMatch.winner) ? finalMatch.player2 : finalMatch.player1 
            });
        }

        if (this.tournament.settings.bronzeMatch) {
            const bronzeMatch = matches.find(m => m.isBronzeMatch);
            if (bronzeMatch?.winner) {
                rankings.push({ rank: 3, player: bronzeMatch.winner });
            }
        }

        return rankings;
    }
}

// ==================== ROUND ROBIN ====================
class RoundRobinLogic extends TournamentLogic {
    async generateBracket(players) {
        const matches = [];
        const numPlayers = players.length;
        let playerList = this._shuffleAndSeed(players);
        
        if (numPlayers % 2 !== 0) {
            playerList.push({ user: null, isBye: true });
        }

        const numRounds = (playerList.length - 1) * this.tournament.settings.rounds;
        let matchNumber = 1;

        for (let round = 1; round <= numRounds; round++) {
            for (let i = 0; i < playerList.length / 2; i++) {
                const player1 = playerList[i];
                const player2 = playerList[playerList.length - 1 - i];

                if (!player1?.isBye && !player2?.isBye && player1.user && player2.user) {
                    matches.push(new Match({
                        tournament: this.tournament._id,
                        round: Math.ceil(round / this.tournament.settings.rounds),
                        matchNumber: matchNumber++,
                        player1: player1.user,
                        player2: player2.user,
                        status: 'scheduled'
                    }));
                }
            }
            
            const last = playerList.pop();
            playerList.splice(1, 0, last);
        }

        return matches;
    }

    async advanceWinner(match) {
        return this.calculateStandings();
    }

    calculateStandings() {
        const standings = {};
        
        this.tournament.registeredPlayers.forEach(p => {
            if (p.paid) {
                standings[p.user.toString()] = {
                    player: p.user,
                    played: 0, wins: 0, draws: 0, losses: 0,
                    goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
                };
            }
        });

        this.tournament.matches.forEach(match => {
            if (match.status !== 'completed' || !match.winner) return;

            const p1Id = match.player1?.toString();
            const p2Id = match.player2?.toString();
            
            if (!standings[p1Id] || !standings[p2Id]) return;

            const p1Stats = standings[p1Id];
            const p2Stats = standings[p2Id];

            p1Stats.played++;
            p2Stats.played++;
            p1Stats.goalsFor += match.score1 || 0;
            p1Stats.goalsAgainst += match.score2 || 0;
            p2Stats.goalsFor += match.score2 || 0;
            p2Stats.goalsAgainst += match.score1 || 0;

            if (match.winner.equals(match.player1)) {
                p1Stats.wins++;
                p1Stats.points += this.tournament.settings.pointsWin;
                p2Stats.losses++;
                p2Stats.points += this.tournament.settings.pointsLoss;
            } else if (match.winner.equals(match.player2)) {
                p2Stats.wins++;
                p2Stats.points += this.tournament.settings.pointsWin;
                p1Stats.losses++;
                p1Stats.points += this.tournament.settings.pointsLoss;
            } else {
                p1Stats.draws++;
                p2Stats.draws++;
                p1Stats.points += this.tournament.settings.pointsDraw;
                p2Stats.points += this.tournament.settings.pointsDraw;
            }
        });

        const sorted = Object.values(standings).map(s => {
            s.goalDifference = s.goalsFor - s.goalsAgainst;
            return s;
        }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
        });

        sorted.forEach((s, i) => s.rank = i + 1);
        return sorted;
    }

    getFinalRankings() {
        return this.calculateStandings().map(s => ({
            rank: s.rank,
            player: s.player
        }));
    }
}

// ==================== SWISS SYSTEM ====================
class SwissLogic extends TournamentLogic {
    async generateBracket(players) {
        const shuffled = this._shuffleAndSeed(players);
        const matches = [];
        
        for (let i = 0; i < shuffled.length; i += 2) {
            if (shuffled[i + 1]) {
                matches.push(new Match({
                    tournament: this.tournament._id,
                    round: 1,
                    matchNumber: Math.floor(i / 2) + 1,
                    player1: shuffled[i].user,
                    player2: shuffled[i + 1].user,
                    status: 'scheduled'
                }));
            }
        }
        
        return matches;
    }

    async advanceWinner(match) {
        const currentRound = match.round;
        const allMatchesInRound = this.tournament.matches.filter(m => m.round === currentRound);
        const allCompleted = allMatchesInRound.every(m => m.status === 'completed');

        if (!allCompleted || currentRound >= this.tournament.settings.swissRounds) {
            return null;
        }

        const standings = this.calculateStandings();
        return this._pairSwissRound(currentRound + 1, standings);
    }

    _pairSwissRound(round, standings) {
        const matches = [];
        const sorted = [...standings].sort((a, b) => b.points - a.points);
        const used = new Set();

        for (let i = 0; i < sorted.length; i++) {
            if (used.has(sorted[i].player.toString())) continue;

            const opponent = sorted.slice(i + 1).find(p => {
                const pid = p.player.toString();
                return !used.has(pid) && !this._havePlayed(sorted[i].player, p.player);
            });

            if (opponent) {
                matches.push(new Match({
                    tournament: this.tournament._id,
                    round: round,
                    matchNumber: matches.length + 1,
                    player1: sorted[i].player,
                    player2: opponent.player,
                    status: 'scheduled'
                }));
                used.add(sorted[i].player.toString());
                used.add(opponent.player.toString());
            } else {
                matches.push(new Match({
                    tournament: this.tournament._id,
                    round: round,
                    matchNumber: matches.length + 1,
                    player1: sorted[i].player,
                    player2: null,
                    status: 'completed',
                    winner: sorted[i].player
                }));
                used.add(sorted[i].player.toString());
            }
        }

        return matches;
    }

    _havePlayed(p1, p2) {
        return this.tournament.matches.some(m => 
            m.status === 'completed' && (
                (m.player1?.equals(p1) && m.player2?.equals(p2)) ||
                (m.player1?.equals(p2) && m.player2?.equals(p1))
            )
        );
    }

    calculateStandings() {
        const standings = {};
        
        this.tournament.registeredPlayers.forEach(p => {
            if (p.paid) {
                standings[p.user.toString()] = {
                    player: p.user,
                    played: 0, wins: 0, draws: 0, losses: 0,
                    buchholz: 0, points: 0
                };
            }
        });

        const opponentScores = {};

        this.tournament.matches.forEach(match => {
            if (match.status !== 'completed') return;

            const p1Id = match.player1?.toString();
            const p2Id = match.player2?.toString();
            
            if (!p1Id || !p2Id || !standings[p1Id] || !standings[p2Id]) return;

            const p1Stats = standings[p1Id];
            const p2Stats = standings[p2Id];

            p1Stats.played++;
            p2Stats.played++;

            if (!opponentScores[p1Id]) opponentScores[p1Id] = [];
            if (!opponentScores[p2Id]) opponentScores[p2Id] = [];
            opponentScores[p1Id].push(p2Stats.points);
            opponentScores[p2Id].push(p1Stats.points);

            if (match.winner.equals(match.player1)) {
                p1Stats.wins++;
                p1Stats.points += this.tournament.settings.pointsWin;
                p2Stats.losses++;
            } else if (match.winner.equals(match.player2)) {
                p2Stats.wins++;
                p2Stats.points += this.tournament.settings.pointsWin;
                p1Stats.losses++;
            } else {
                p1Stats.draws++;
                p2Stats.draws++;
                p1Stats.points += this.tournament.settings.pointsDraw;
                p2Stats.points += this.tournament.settings.pointsDraw;
            }
        });

        Object.keys(standings).forEach(pid => {
            standings[pid].buchholz = (opponentScores[pid] || []).reduce((a, b) => a + b, 0);
        });

        const sorted = Object.values(standings).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.buchholz - a.buchholz;
        });

        sorted.forEach((s, i) => s.rank = i + 1);
        return sorted;
    }

    getFinalRankings() {
        return this.calculateStandings().map(s => ({
            rank: s.rank,
            player: s.player
        }));
    }
}

// ==================== DOUBLE ELIMINATION (COMPLETE) ====================
class DoubleEliminationLogic extends TournamentLogic {
    async generateBracket(players) {
        const matches = [];
        const numPlayers = players.length;
        const winnersRounds = Math.ceil(Math.log2(numPlayers));
        
        // Generate Winners Bracket
        const winnersLogic = new SingleEliminationLogic({
            ...this.tournament,
            settings: { ...this.tournament.settings, bronzeMatch: false }
        });
        const winnersMatches = await winnersLogic.generateBracket(players);
        winnersMatches.forEach(m => {
            m.bracket = 'winners';
            m.losersNextMatch = null;
        });
        matches.push(...winnersMatches);

        // Generate Losers Bracket
        const losersMatches = [];
        let losersMatchNum = 1000;
        
        // Losers bracket rounds
        for (let round = 1; round <= (winnersRounds * 2) - 2; round++) {
            const numMatches = this._getLosersRoundMatchCount(round, winnersRounds);
            for (let i = 0; i < numMatches; i++) {
                const match = new Match({
                    tournament: this.tournament._id,
                    round: round,
                    matchNumber: losersMatchNum++,
                    bracket: 'losers',
                    player1: null,
                    player2: null,
                    status: 'pending',
                    nextMatch: null,
                    sourceMatches: []
                });
                losersMatches.push(match);
            }
        }
        
        // Link losers bracket
        this._linkLosersBracket(losersMatches);
        
        // Link winners to losers
        this._linkWinnersToLosers(matches, losersMatches, winnersRounds);
        
        matches.push(...losersMatches);

        // Grand Finals
        const grandFinals = new Match({
            tournament: this.tournament._id,
            round: 999,
            matchNumber: 9999,
            bracket: 'grand_finals',
            player1: null,
            player2: null,
            status: 'pending',
            resetMatch: null
        });
        matches.push(grandFinals);

        // Grand Finals Reset
        const grandFinalsReset = new Match({
            tournament: this.tournament._id,
            round: 999,
            matchNumber: 10000,
            bracket: 'grand_finals_reset',
            player1: null,
            player2: null,
            status: 'pending'
        });
        matches.push(grandFinalsReset);

        grandFinals.resetMatch = grandFinalsReset._id;

        return matches;
    }

    _getLosersRoundMatchCount(round, winnersRounds) {
        const effectiveRound = Math.ceil(round / 2);
        return Math.max(1, Math.pow(2, winnersRounds - effectiveRound - 1));
    }

    _linkLosersBracket(losersMatches) {
        const byRound = {};
        losersMatches.forEach(m => {
            if (!byRound[m.round]) byRound[m.round] = [];
            byRound[m.round].push(m);
        });

        const rounds = Object.keys(byRound).sort((a, b) => a - b);
        
        for (let i = 0; i < rounds.length - 1; i++) {
            const current = byRound[rounds[i]];
            const next = byRound[rounds[i + 1]];
            
            for (let j = 0; j < current.length; j += 2) {
                const nextIdx = Math.floor(j / 2);
                if (next[nextIdx]) {
                    current[j].nextMatch = next[nextIdx]._id;
                    if (current[j + 1]) {
                        current[j + 1].nextMatch = next[nextIdx]._id;
                    }
                }
            }
        }

        const lastRound = byRound[rounds[rounds.length - 1]];
        if (lastRound && lastRound.length === 1) {
            lastRound[0].nextMatch = 'grand_finals';
        }
    }

    _linkWinnersToLosers(winnersMatches, losersMatches, winnersRounds) {
        const r1Winners = winnersMatches.filter(m => m.round === 1);
        const r1Losers = losersMatches.filter(m => m.round === 1);
        
        for (let i = 0; i < r1Winners.length; i++) {
            const wm = r1Winners[i];
            const lm = r1Losers[Math.floor(i / 2)];
            if (!lm.sourceMatches) lm.sourceMatches = [];
            lm.sourceMatches.push({
                matchId: wm._id,
                slot: i % 2 === 0 ? 'player1' : 'player2',
                takesLoser: true
            });
            wm.losersNextMatch = lm._id;
        }

        for (let wRound = 2; wRound <= winnersRounds; wRound++) {
            const wMatches = winnersMatches.filter(m => m.round === wRound);
            const lRound = (wRound - 1) * 2;
            const lMatches = losersMatches.filter(m => m.round === lRound);
            
            for (let i = 0; i < wMatches.length; i++) {
                const wm = wMatches[i];
                const lmIdx = Math.floor(i / (wRound === 2 ? 1 : 2));
                if (lMatches[lmIdx]) {
                    wm.losersNextMatch = lMatches[lmIdx]._id;
                    if (!lMatches[lmIdx].sourceMatches) lMatches[lmIdx].sourceMatches = [];
                    lMatches[lmIdx].sourceMatches.push({
                        matchId: wm._id,
                        takesLoser: true
                    });
                }
            }
        }
    }

    async advanceWinner(match) {
        if (!match.winner) return null;

        if (match.bracket === 'winners' || !match.bracket) {
            return await this._advanceWinnersBracket(match);
        }
        
        if (match.bracket === 'losers') {
            return await this._advanceLosersBracket(match);
        }
        
        if (match.bracket === 'grand_finals') {
            return await this._handleGrandFinals(match);
        }

        return null;
    }

    async _advanceWinnersBracket(match) {
        const winnersMatches = this.tournament.matches.filter(m => m.bracket === 'winners');
        const winnersView = {
            ...this.tournament,
            matches: winnersMatches,
            settings: { ...this.tournament.settings, bronzeMatch: false }
        };
        const winnersLogic = new SingleEliminationLogic(winnersView);
        
        const nextMatch = await winnersLogic.advanceWinner(match);
        if (nextMatch) return nextMatch;

        const grandFinals = this.tournament.matches.find(m => m.bracket === 'grand_finals');
        if (grandFinals && !grandFinals.player1) {
            await Match.findByIdAndUpdate(grandFinals._id, {
                $set: { player1: match.winner }
            });
            
            const updated = await Match.findById(grandFinals._id);
            if (updated.player1 && updated.player2) {
                await Match.findByIdAndUpdate(grandFinals._id, {
                    $set: { status: 'scheduled' }
                });
            }
            return grandFinals;
        }

        return null;
    }

    async _advanceLosersBracket(match) {
        if (match.nextMatch && match.nextMatch !== 'grand_finals') {
            const nextMatch = await Match.findById(match.nextMatch);
            if (!nextMatch) return null;

            const isPlayer1Slot = match.matchNumber % 2 !== 0;
            const updateData = {};
            
            if (isPlayer1Slot) {
                updateData.player1 = match.winner;
            } else {
                updateData.player2 = match.winner;
            }

            const willHaveP1 = isPlayer1Slot ? match.winner : nextMatch.player1;
            const willHaveP2 = isPlayer1Slot ? nextMatch.player2 : match.winner;
            
            if (willHaveP1 && willHaveP2) {
                updateData.status = 'scheduled';
            }

            return await Match.findByIdAndUpdate(match.nextMatch, { $set: updateData }, { new: true });
        }

        if (match.nextMatch === 'grand_finals') {
            const grandFinals = this.tournament.matches.find(m => m.bracket === 'grand_finals');
            if (grandFinals && !grandFinals.player2) {
                await Match.findByIdAndUpdate(grandFinals._id, {
                    $set: { player2: match.winner }
                });
                
                const updated = await Match.findById(grandFinals._id);
                if (updated.player1 && updated.player2) {
                    await Match.findByIdAndUpdate(grandFinals._id, {
                        $set: { status: 'scheduled' }
                    });
                }
                return grandFinals;
            }
        }

        return null;
    }

    async _handleGrandFinals(match) {
        const resetMatch = this.tournament.matches.find(m => m.bracket === 'grand_finals_reset');
        
        const winnersChampion = match.player1;
        const losersChampion = match.player2;
        
        if (this._compareUsers(match.winner, winnersChampion)) {
            await Match.findByIdAndUpdate(match._id, {
                $set: { status: 'completed', isTournamentComplete: true }
            });
            return null;
        }

        if (resetMatch && !resetMatch.player1) {
            return await Match.findByIdAndUpdate(resetMatch._id, {
                $set: {
                    player1: winnersChampion,
                    player2: losersChampion,
                    status: 'scheduled'
                }
            });
            return resetMatch;
        }

        return null;
    }

    async advanceLoser(match) {
        const winnerId = match.winner?._id || match.winner;
        const losersNextMatchId = match.losersNextMatch?._id || match.losersNextMatch;
        if (!winnerId || !losersNextMatchId) return null;
        
        const loser = this._compareUsers(match.player1, winnerId) ? match.player2 : match.player1;
        const losersMatch = await Match.findById(losersNextMatchId);
        
        if (!losersMatch) return null;

        const sourceInfo = losersMatch.sourceMatches?.find(
            s => s.matchId.toString() === match._id.toString()
        );
        
        if (!sourceInfo) return null;

        const updateData = {};
        if (sourceInfo.slot === 'player1') {
            updateData.player1 = loser;
        } else {
            updateData.player2 = loser;
        }

        const willHaveP1 = sourceInfo.slot === 'player1' ? loser : losersMatch.player1;
        const willHaveP2 = sourceInfo.slot === 'player2' ? loser : losersMatch.player2;
        
        if (willHaveP1 && willHaveP2) {
            updateData.status = 'scheduled';
        }

        return await Match.findByIdAndUpdate(match.losersNextMatch, { $set: updateData }, { new: true });
    }

    calculateStandings() {
        const matches = this.tournament.matches;
        const standings = [];
        
        const grandFinals = matches.find(m => m.bracket === 'grand_finals' && m.status === 'completed');
        const grandFinalsReset = matches.find(m => m.bracket === 'grand_finals_reset' && m.status === 'completed');
        
        if (grandFinalsReset?.winner) {
            standings.push({ rank: 1, player: grandFinalsReset.winner });
            standings.push({ 
                rank: 2, 
                player: grandFinalsReset.player1.equals(grandFinalsReset.winner) 
                    ? grandFinalsReset.player2 
                    : grandFinalsReset.player1 
            });
        } else if (grandFinals?.winner) {
            standings.push({ rank: 1, player: grandFinals.winner });
            standings.push({ 
                rank: 2, 
                player: grandFinals.player1.equals(grandFinals.winner) 
                    ? grandFinals.player2 
                    : grandFinals.player1 
            });
        }

        const losersFinals = matches
            .filter(m => m.bracket === 'losers')
            .sort((a, b) => b.round - a.round)[0];
            
        if (losersFinals?.winner && losersFinals.status === 'completed') {
            const third = losersFinals.player1.equals(losersFinals.winner) 
                ? losersFinals.player2 
                : losersFinals.player1;
            standings.push({ rank: 3, player: third });
        }

        return standings;
    }

    getFinalRankings(matches) {
        return this.calculateStandings();
    }

    isTournamentComplete() {
        const grandFinals = this.tournament.matches.find(m => m.bracket === 'grand_finals');
        const reset = this.tournament.matches.find(m => m.bracket === 'grand_finals_reset');
        
        if (reset && reset.status === 'completed') return true;
        if (grandFinals && grandFinals.status === 'completed' && !reset?.player1) return true;
        
        return false;
    }
}

// Factory
const TournamentLogicFactory = {
    create(tournament) {
        switch (tournament.format) {
            case 'single_elimination':
                return new SingleEliminationLogic(tournament);
            case 'double_elimination':
                return new DoubleEliminationLogic(tournament);
            case 'round_robin':
                return new RoundRobinLogic(tournament);
            case 'swiss':
                return new SwissLogic(tournament);
            case 'league':
                return new RoundRobinLogic(tournament);
            default:
                return new SingleEliminationLogic(tournament);
        }
    }
};

module.exports = {
    TournamentLogicFactory,
    TournamentLogic,
    SingleEliminationLogic,
    RoundRobinLogic,
    SwissLogic,
    DoubleEliminationLogic
};