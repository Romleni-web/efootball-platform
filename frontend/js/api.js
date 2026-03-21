// Auto-detect API URL - FIXED
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://efootball-platform.onrender.com/api';

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

    // Matches
    // UPDATED: Support both formats for UI compatibility
    async submitMatchResult(matchId, resultData) {
        // Handle object with matchId property (from UI)
        if (typeof matchId === 'object' && matchId.matchId) {
            resultData = matchId;
            matchId = resultData.matchId;
        }

        const formData = new FormData();
        formData.append('score1', resultData.score1);
        formData.append('score2', resultData.score2);
        formData.append('winner', resultData.winner); // 'player1' or 'player2'
        if (resultData.notes) {
            formData.append('notes', resultData.notes);
        }
        if (resultData.screenshot) {
            formData.append('screenshot', resultData.screenshot);
        }

        return this.authenticatedRequest(`/matches/${matchId}/result`, {
            method: 'POST',
            body: formData
        }, false);
    },

    // Admin
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

    // Helper methods
    // ADDED: getHeaders method
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
            throw new Error(data.message || 'Something went wrong');
        }
        return data;
    }
};