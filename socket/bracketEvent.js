const Tournament = require('../models/Tournament');
const Match = require('../models/Match');

function initBracketEvents(io) {
    io.on('connection', (socket) => {
        socket.on('join-tournament', (id) => socket.join(`tournament-${id}`));
        socket.on('leave-tournament', (id) => socket.leave(`tournament-${id}`));
    });
}

async function emitBracketUpdate(io, tournamentId) {
    const tournament = await Tournament.findById(tournamentId).populate('registeredPlayers.user', 'username seed');
    const matches = await Match.find({ tournament: tournamentId }).populate('player1', 'username').populate('player2', 'username').populate('winner', 'username').sort({ round: 1, matchNumber: 1 });
    io.to(`tournament-${tournamentId}`).emit('bracket-update', {
        tournament: { id: tournament._id, currentRound: tournament.currentRound, status: tournament.status },
        matches: matches.map(m => ({ id: m._id, round: m.round, matchNumber: m.matchNumber, player1: m.player1, player2: m.player2, winner: m.winner, status: m.status, score1: m.score1, score2: m.score2, isBye: m.isBye, isBronzeMatch: m.isBronzeMatch })),
        isDynamic: tournament.settings?.reseedAfterRound !== false
    });
}

module.exports = { initBracketEvents, emitBracketUpdate };