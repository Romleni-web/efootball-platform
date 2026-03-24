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
                winner: player2 ? null : (player1 ? player1.user : null)
            });

            round1Matches.push(match);
            matches.push(match);
        }

        // Subsequent rounds
        for (let round = 2; round <= rounds; round++) {
            const matchesInRound = bracketSize / Math.pow(2, round);
            
            for (let i = 0; i < matchesInRound; i++) {
                matches.push(new Match({
                    tournament: this.tournament._id,
                    round: round,
                    matchNumber: matchNumber++,
                    player1: null,
                    player2: null,
                    status: 'pending'
                }));
            }
        }

        // Bronze match
        if (this.tournament.settings.bronzeMatch) {
            matches.push(new Match({
                tournament: this.tournament._id,
                round: rounds + 1,
                matchNumber: matchNumber,
                isBronzeMatch: true,
                player1: null,
                player2: null,
                status: 'pending'
            }));
        }

        return matches;
    }

    async advanceWinner(match) {
        if (!match.winner) return null;

        const currentRoundMatches = this.tournament.matches.filter(m => m.round === match.round);
        const sortedMatches = currentRoundMatches.sort((a, b) => a.matchNumber - b.matchNumber);
        const matchIndex = sortedMatches.findIndex(m => m._id.equals(match._id));
        
        const nextRound = match.round + 1;
        const nextRoundMatches = this.tournament.matches.filter(m => m.round === nextRound && !m.isBronzeMatch);
        
        if (nextRoundMatches.length === 0) {
            // Final - check for bronze match
            if (this.tournament.settings.bronzeMatch) {
                const bronzeMatch = this.tournament.matches.find(m => m.isBronzeMatch);
                if (bronzeMatch && (!bronzeMatch.player1 || !bronzeMatch.player2)) {
                    const loser = match.player1.equals(match.winner) ? match.player2 : match.player1;
                    if (!bronzeMatch.player1) {
                        bronzeMatch.player1 = loser;
                    } else {
                        bronzeMatch.player2 = loser;
                    }
                    if (bronzeMatch.player1 && bronzeMatch.player2) {
                        bronzeMatch.status = 'scheduled';
                    }
                    return bronzeMatch;
                }
            }
            return null;
        }

        const nextMatchIndex = Math.floor(matchIndex / 2);
        const isPlayer1Slot = matchIndex % 2 === 0;
        const nextMatch = nextRoundMatches.sort((a, b) => a.matchNumber - b.matchNumber)[nextMatchIndex];

        if (nextMatch) {
            if (isPlayer1Slot) {
                nextMatch.player1 = match.winner;
            } else {
                nextMatch.player2 = match.winner;
            }
            
            if (nextMatch.player1 && nextMatch.player2) {
                nextMatch.status = 'scheduled';
            }
            
            return nextMatch;
        }

        return null;
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

// ==================== DOUBLE ELIMINATION ====================
class DoubleEliminationLogic extends TournamentLogic {
    async generateBracket(players) {
        const matches = [];
        const numPlayers = players.length;
        const winnersRounds = Math.ceil(Math.log2(numPlayers));
        
        // Winners bracket
        const winnersLogic = new SingleEliminationLogic({
            ...this.tournament,
            settings: { ...this.tournament.settings, bronzeMatch: false }
        });
        const winnersMatches = await winnersLogic.generateBracket(players);
        winnersMatches.forEach(m => m.bracket = 'winners');
        matches.push(...winnersMatches);

        // Losers bracket
        let losersMatchNum = 1000;
        for (let round = 1; round < winnersRounds * 2 - 1; round++) {
            const numMatches = Math.max(1, Math.floor(Math.pow(2, winnersRounds - 1 - Math.floor((round + 1) / 2))));
            for (let i = 0; i < numMatches; i++) {
                matches.push(new Match({
                    tournament: this.tournament._id,
                    round: round,
                    matchNumber: losersMatchNum++,
                    bracket: 'losers',
                    player1: null,
                    player2: null,
                    status: 'pending'
                }));
            }
        }

        // Grand Finals
        matches.push(new Match({
            tournament: this.tournament._id,
            round: 999,
            matchNumber: 9999,
            bracket: 'grand_finals',
            player1: null,
            player2: null,
            status: 'pending'
        }));

        return matches;
    }

    async advanceWinner(match) {
        if (!match.winner) return null;

        // Keep tournament progress moving by at least advancing the winners bracket.
        // This avoids tournaments getting stuck while full losers-bracket logic is pending.
        if (match.bracket === 'winners' || !match.bracket) {
            const winnersMatches = this.tournament.matches.filter(m => m.bracket === 'winners');
            const winnersTournamentView = {
                ...this.tournament,
                matches: winnersMatches,
                settings: { ...this.tournament.settings, bronzeMatch: false }
            };
            const winnersLogic = new SingleEliminationLogic(winnersTournamentView);
            const nextWinnersMatch = await winnersLogic.advanceWinner(match);
            if (nextWinnersMatch) return nextWinnersMatch;

            // Winners bracket final completed -> seed grand finals player1.
            const grandFinal = this.tournament.matches.find(m => m.bracket === 'grand_finals');
            if (grandFinal && !grandFinal.player1) {
                grandFinal.player1 = match.winner;
                if (grandFinal.player1 && grandFinal.player2) {
                    grandFinal.status = 'scheduled';
                }
                return grandFinal;
            }
        }

        // TODO: full losers bracket routing.
        return null;
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
    SingleEliminationLogic,
    RoundRobinLogic,
    SwissLogic,
    DoubleEliminationLogic
};