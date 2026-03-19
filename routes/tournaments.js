const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const jwt = require('jsonwebtoken');

// Middleware to verify token
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

// GET /api/tournaments
router.get('/', async (req, res) => {
    try {
        const tournaments = await Tournament.find()
            .populate('registeredPlayers.user', 'username teamName')
            .sort({ createdAt: -1 });
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/tournaments/:id
router.get('/:id', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('registeredPlayers.user', 'username teamName efootballId');
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/tournaments/:id/register - RACE-CONDITION-PROOF REGISTRATION
router.post('/:id/register', auth, async (req, res) => {
    const tournamentId = req.params.id;
    const userId = req.user._id;

    try {
        // ATOMIC CHECK-AND-UPDATE: Check capacity AND not already registered, then add
        const result = await Tournament.findOneAndUpdate(
            {
                _id: tournamentId,
                status: 'open',
                // Check tournament is not full
                $expr: { $lt: [{ $size: '$registeredPlayers' }, '$maxPlayers'] },
                // Check user is NOT already registered
                'registeredPlayers.user': { $ne: userId }
            },
            {
                $push: {
                    registeredPlayers: {
                        user: userId,
                        paid: false,
                        registeredAt: new Date()
                    }
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        // If findOneAndUpdate returned null, determine why
        if (!result) {
            const tournament = await Tournament.findById(tournamentId);
            
            if (!tournament) {
                return res.status(404).json({ message: 'Tournament not found' });
            }
            
            if (tournament.status !== 'open') {
                return res.status(400).json({ message: `Tournament is ${tournament.status}` });
            }
            
            // Check if already registered
            const alreadyRegistered = tournament.registeredPlayers.some(
                rp => rp.user.toString() === userId.toString()
            );
            if (alreadyRegistered) {
                return res.status(400).json({ message: 'Already registered for this tournament' });
            }
            
            // Must be full
            return res.status(400).json({ message: 'Tournament is full' });
        }

        // SUCCESS
        const currentCount = result.registeredPlayers.length;
        
        res.json({ 
            success: true, 
            message: 'Registered successfully',
            tournament: {
                _id: result._id,
                name: result.name,
                registeredCount: currentCount,
                maxPlayers: result.maxPlayers,
                spotsRemaining: result.maxPlayers - currentCount
            }
        });

        // SIDE EFFECT: Check if just became full and generate bracket
        if (currentCount >= result.maxPlayers) {
            // Use setImmediate to not block response
            setImmediate(() => closeTournamentAndGenerateBracket(tournamentId));
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
});

// Helper function: Close tournament and generate bracket
async function closeTournamentAndGenerateBracket(tournamentId) {
    try {
        // Atomically update status to prevent double-processing
        const tournament = await Tournament.findOneAndUpdate(
            {
                _id: tournamentId,
                status: 'open'  // Only if still open
            },
            {
                status: 'ongoing',
                bracketGeneratedAt: new Date()
            },
            { new: true }
        );

        if (!tournament) {
            console.log(`Tournament ${tournamentId} already closed or bracket generated`);
            return;
        }

        // Get all registered players
        const players = tournament.registeredPlayers.map(rp => rp.user);

        if (players.length !== tournament.maxPlayers) {
            console.log(`Warning: Tournament ${tournamentId} has ${players.length}/${tournament.maxPlayers} players`);
            return;
        }

        // Generate single elimination bracket
        const bracket = generateSingleEliminationBracket(players);
        
        // Create matches in database
        const matchDocs = await Promise.all(bracket.map(async (match, index) => {
            const newMatch = new Match({
                tournament: tournamentId,
                round: match.round,
                matchNumber: index + 1,
                player1: match.player1,
                player2: match.player2,
                status: 'pending'
            });
            return await newMatch.save();
        }));

        // Update tournament with match references
        await Tournament.findByIdAndUpdate(tournamentId, {
            $push: { matches: { $each: matchDocs.map(m => m._id) } }
        });

        console.log(`✅ Bracket generated for tournament ${tournamentId}: ${matchDocs.length} matches created`);

    } catch (error) {
        console.error(`❌ Bracket generation failed for ${tournamentId}:`, error);
    }
}

function generateSingleEliminationBracket(players) {
    // Shuffle for random seeding
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    
    const bracket = [];
    const numMatches = shuffled.length / 2;
    
    for (let i = 0; i < numMatches; i++) {
        bracket.push({
            round: 1,
            player1: shuffled[i * 2],
            player2: shuffled[i * 2 + 1]
        });
    }
    
    return bracket;
}

// GET /api/tournaments/:id/bracket
router.get('/:id/bracket', auth, async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id).populate({
            path: 'matches',
            populate: [
                { path: 'player1', select: 'username' },
                { path: 'player2', select: 'username' },
                { path: 'winner', select: 'username' }
            ]
        });

        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const isRegistered = tournament.registeredPlayers.some(p => p.user.toString() === req.user.id);
        if (!isRegistered && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You must be registered to view the bracket' });
        }

        const bracket = {};
        tournament.matches.forEach(match => {
            if (!bracket[match.round]) bracket[match.round] = [];
            bracket[match.round].push(match);
        });

        const bracketArray = Object.keys(bracket).sort((a, b) => a - b).map(round => ({
            round: parseInt(round),
            matches: bracket[round].sort((a, b) => a.matchNumber - b.matchNumber)
        }));

        res.json(bracketArray);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CRITICAL: Export the router
module.exports = router;