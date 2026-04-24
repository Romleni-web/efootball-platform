// Auto-detect API URL - FIXED
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://efootball-platform.onrender.com/api';

const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://efootball-platform.onrender.com';

console.log('API URL:', API_BASE_URL); // Debug log

const API = {
    // Auth
    async register(userData) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            return this.handleResponse(response);
        } catch (error) {
            console.error('Register error:', error);
            throw new Error('Cannot connect to server. Please try again.');
        }
    },

    async login(credentials) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });
            return this.handleResponse(response);
        } catch (error) {
            console.error('Login error:', error);
            throw new Error('Cannot connect to server. Please try again.');
        }
    },

    async getMe() {
        return this.authenticatedRequest('/auth/me');
    },

    async forgotPassword(email) {
        const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return this.handleResponse(response);
    },

    async resetPassword(token, password) {
        const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });
        return this.handleResponse(response);
    },

    // Tournaments
    async getTournaments() {
        const response = await fetch(`${API_BASE_URL}/tournaments`);
        return this.handleResponse(response);
    },

    async getTournament(id) {
        const response = await fetch(`${API_BASE_URL}/tournaments/${id}`);
        return this.handleResponse(response);
    },

    async getTournamentBracket(id) {
        return this.authenticatedRequest(`/tournaments/${id}/bracket`);
    },

    // Alias for UI compatibility
    async getBracket(tournamentId) {
        return this.getTournamentBracket(tournamentId);
    },

    // FIXED: Direct tournament registration (no payment needed for now)
    async registerForTournament(tournamentId) {
        return this.authenticatedRequest(`/tournaments/${tournamentId}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    },

    // Keep old payment-based join for backward compatibility
    async joinTournament(tournamentId, paymentData) {
        const formData = new FormData();
        formData.append('tournamentId', tournamentId);
        formData.append('mpesaNumber', paymentData.mpesaNumber);
        formData.append('transactionCode', paymentData.transactionCode);
        if (paymentData.screenshot) {
            formData.append('screenshot', paymentData.screenshot);
        }

        return this.authenticatedRequest('/payments/entry', {
            method: 'POST',
            body: formData
        }, false);
    },

    // User
    async getUserStats() {
        return this.authenticatedRequest('/users/stats');
    },

    async getUserTournaments() {
        return this.authenticatedRequest('/users/tournaments');
    },

    async getUpcomingMatches() {
        return this.authenticatedRequest('/users/matches/upcoming');
    },

    async getMatchHistory() {
        return this.authenticatedRequest('/users/matches/history');
    },

    async updateProfile(profileData) {
        const response = await this.authenticatedRequest('/users/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });
        
        // Update stored user data immediately
        if (response.user) {
            const currentUser = Auth.getUser();
            const updatedUser = { ...currentUser, ...response.user };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        } else if (response.success) {
            // Fallback: merge sent data with current user
            const currentUser = Auth.getUser();
            const updatedUser = { ...currentUser, ...profileData };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        return response;
    },

    async searchPlayer(efootballId) {
        return this.authenticatedRequest(`/users/search/${efootballId}`);
    },

    // Leaderboard
    async getLeaderboard() {
        const response = await fetch(`${API_BASE_URL}/users/leaderboard`);
        return this.handleResponse(response);
    },

    // ============================================
    // CHAT UTILITIES - WHATSAPP STYLE
    // ============================================

    socket: null,
    socketReady: false,
    
    initSocket() {
        if (this.socket || typeof io === 'undefined') return;
        
        this.socket = io(SOCKET_URL);
        
        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.socketReady = true;
            // Initialize Chat module when socket connects
            if (window.Chat && !Chat.initialized) {
                Chat.init();
            }
        });
        
        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.socketReady = false;
        });
        
        this.socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });
    },

    joinChat(roomId) {
        this.initSocket();
        
        // If Chat module is available, use it
        if (window.Chat) {
            // Ensure Chat is initialized before joining
            if (!Chat.initialized) {
                Chat.init();
            }
            Chat.joinRoom(roomId);
            return;
        }
        
        // Legacy fallback
        if (this.socket) {
            if (roomId === 'global') this.socket.emit('join-global');
            else this.socket.emit('join-match', roomId);
        }
    },

    sendMessage(roomId, message) {
        const user = Auth.getUser();
        if (!user || !this.socket) return;
        
        // Use Chat module if available
        if (window.Chat && Chat.initialized) {
            // Chat handles its own sending
            return;
        }
        
        // Legacy fallback
        this.socket.emit('send-message', {
            roomId, message, username: user.username, type: roomId === 'global' ? 'global' : 'match'
        });
    },

    // ============================================
    // MATCH RESULT SUBMISSION - DUAL SYSTEM
    // ============================================

    // Get match status and submissions
    async getMatchStatus(matchId) {
        return this.authenticatedRequest(`/matches/${matchId}/status`);
    },

    // FIXED: Submit match result - now includes tournamentId in URL
      // api.js - FIXED
    async submitMatchResult(tournamentId, matchId, resultData) {
    const formData = new FormData();
    formData.append('score1', resultData.score1);
    formData.append('score2', resultData.score2);
    formData.append('winner', resultData.winner);
    
    if (resultData.notes) {
        formData.append('notes', resultData.notes);
    }
    if (resultData.screenshot && resultData.screenshot.size > 0) {
        formData.append('screenshot', resultData.screenshot);
    }

    const token = Auth.getToken();
    
    // FIXED: Use /matches/ endpoint (has upload middleware)
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/result`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });

    return this.handleResponse(response);
    },
    // ============================================
    // ADMIN - MATCH VERIFICATION
    // ============================================

    // Get pending/disputed match results for admin
    async getPendingResults() {
        return this.authenticatedRequest('/admin/results/pending');
    },

    // Admin resolve disputed match
    async resolveMatch(matchId, decision, data = {}) {
        return this.authenticatedRequest(`/admin/matches/${matchId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision, ...data })
        });
    },

    async getMatchAdvancementDebug(matchId) {
        return this.authenticatedRequest(`/admin/matches/${matchId}/advancement-debug`);
    },

    // ============================================
    // ADMIN - PAYMENTS & TOURNAMENTS
    // ============================================

    async getPendingPayments() {
        return this.authenticatedRequest('/payments/pending');
    },

    async verifyPayment(paymentId, action, reason = '') {
        return this.authenticatedRequest(`/payments/verify/${paymentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reason })
        });
    },

    async createTournament(tournamentData) {
        return this.authenticatedRequest('/admin/tournaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tournamentData)
        });
    },

    async startTournament(tournamentId) {
        return this.authenticatedRequest(`/admin/tournaments/${tournamentId}/start`, {
            method: 'POST'
        });
    },

    async regenerateRound(tournamentId, round) {
        return this.authenticatedRequest(`/tournaments/${tournamentId}/regenerate-round`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ round })
        });
    },

    async generateNextRound(tournamentId) {
    return this.authenticatedRequest(`/tournaments/${tournamentId}/generate-next-round`, { method: 'POST' });
},
async syncBracket(tournamentId) {
    return this.authenticatedRequest(`/tournaments/${tournamentId}/sync-bracket`, { method: 'POST' });
},
async updateTournamentSettings(tournamentId, settings) {
    return this.authenticatedRequest(`/tournaments/${tournamentId}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
},

    async getAdminStats() {
        return this.authenticatedRequest('/admin/stats');
    },

    async recordPrizePayment(paymentData) {
        return this.authenticatedRequest('/admin/send-prize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData)
        });
    },
    
    async getTournamentMatches(tournamentId) {
    return this.authenticatedRequest(`/tournaments/${tournamentId}/matches`);
   },
    // Helper methods
    getHeaders() {
        const token = Auth.getToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    async authenticatedRequest(endpoint, options = {}, includeJson = true) {
        const token = Auth.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const headers = {
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };

        if (includeJson && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        return this.handleResponse(response);
    },

    async handleResponse(response) {
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401 && Auth.isAuthenticated()) {
                Auth.logout();
                throw new Error('Session expired. Please login again.');
            }
            throw new Error(data.message || 'Something went wrong');
        }
        return data;
    }
};

window.API = API;