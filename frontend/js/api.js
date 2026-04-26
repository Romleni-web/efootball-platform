// Auto-detect API URL
const API_BASE_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
    }
    if (window.location.origin.includes('render.com')) {
        return `${window.location.origin}/api`;
    }
    return 'https://efootball-platform.onrender.com/api';
})();

const SOCKET_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    if (window.location.origin.includes('render.com')) {
        return window.location.origin;
    }
    return 'https://efootball-platform.onrender.com';
})();

console.log('API URL:', API_BASE_URL);

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
        const response = await fetch(`${API_BASE_URL}/tournaments/${id}/bracket`);
        return this.handleResponse(response);
    },

    async getTournamentMatches(id) {
        return this.authenticatedRequest(`/tournaments/${id}/matches`);
    },

    async registerForTournament(tournamentId) {
        return this.authenticatedRequest(`/tournaments/${tournamentId}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    },

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
        
        if (response.user) {
            const currentUser = Auth.getUser();
            const updatedUser = { ...currentUser, ...response.user };
            Auth.setAuth(Auth.getToken(), updatedUser);
        } else if (response.success) {
            const currentUser = Auth.getUser();
            const updatedUser = { ...currentUser, ...profileData };
            Auth.setAuth(Auth.getToken(), updatedUser);
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

    // Share Match Card
    async getMatchShareCard(matchId) {
        const token = Auth.getToken();
        const response = await fetch(`${API_BASE_URL}/matches/${matchId}/share-card`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate share card');
        }
        
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    },

    async shareMatchResult(matchId) {
        try {
            const imageUrl = await this.getMatchShareCard(matchId);
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `match-card-${matchId}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(imageUrl);
            return true;
        } catch (error) {
            console.error('Share error:', error);
            throw new Error('Could not share match result');
        }
    },

    // Prize Distribution
    async getTournamentPayouts(tournamentId) {
        return this.authenticatedRequest(`/admin/payouts/${tournamentId}`);
    },

    async markPayoutProcessing(payoutId) {
        return this.authenticatedRequest(`/admin/payouts/${payoutId}/processing`, {
            method: 'POST'
        });
    },

    async markPayoutSent(payoutId, transactionId, notes) {
        return this.authenticatedRequest(`/admin/payouts/${payoutId}/sent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId, notes })
        });
    },

    // Chat
    socket: null,
    socketReady: false,
    
    initSocket() {
        if (this.socket || typeof io === 'undefined') {
            console.log('Socket already exists or io not available');
            return;
        }
        
        console.log('Initializing socket connection to:', SOCKET_URL);
        this.socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            console.log('Socket connected, ID:', this.socket.id);
            this.socketReady = true;
            if (window.Chat && !Chat.initialized) {
                Chat.init();
            }
            if (window.Chat) {
                Chat.flushMessageQueue();
            }
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.socketReady = false;
        });
        
        this.socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            this.socketReady = false;
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
            this.socketReady = true;
        });
    },

    joinChat(roomId) {
        this.initSocket();
        if (window.Chat) {
            if (!Chat.initialized) {
                Chat.init();
            }
            Chat.joinRoom(roomId);
            return;
        }
        if (this.socket) {
            if (roomId === 'global') this.socket.emit('join-global');
            else this.socket.emit('join-match', roomId);
        }
    },

    sendMessage(roomId, message) {
        const user = Auth.getUser();
        if (!user || !this.socket) return;
        if (window.Chat && Chat.initialized) {
            return;
        }
        this.socket.emit('send-message', {
            roomId, message, username: user.username, type: roomId === 'global' ? 'global' : 'match'
        });
    },

    // Match Results
    async getMatchStatus(matchId) {
        return this.authenticatedRequest(`/matches/${matchId}/status`);
    },

    async submitMatchResult(tournamentId, matchId, resultData) {
        const formData = new FormData();
        formData.append('score1', resultData.score1);
        formData.append('score2', resultData.score2);
        formData.append('winner', resultData.winner);
        
        if (resultData.notes) {
            formData.append('notes', resultData.notes);
        }
        
        if (resultData.screenshot && resultData.screenshot instanceof File && resultData.screenshot.size > 0) {
            formData.append('screenshot', resultData.screenshot);
        }
        
        if (resultData.historyScreenshot && resultData.historyScreenshot instanceof File && resultData.historyScreenshot.size > 0) {
            formData.append('historyScreenshot', resultData.historyScreenshot);
        }

        const token = Auth.getToken();
        const response = await fetch(`${API_BASE_URL}/matches/${matchId}/result`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        return this.handleResponse(response);
    },

    // Admin
    async getPendingResults() {
        return this.authenticatedRequest('/admin/results/pending');
    },

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
        return this.authenticatedRequest(`/tournaments/${tournamentId}/settings`, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(settings) 
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
    getHeaders() {
        const token = Auth.getToken();
        const headers = { 'Content-Type': 'application/json' };
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

        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
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