const Auth = {
    TOKEN_KEY: 'efootball_token',
    USER_KEY: 'efootball_user',

    setAuth(token, user) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.updateUI();
    },

    clearAuth() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.updateUI();
    },

    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    getUser() {
        const user = localStorage.getItem(this.USER_KEY);
        return user ? JSON.parse(user) : null;
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    isAdmin() {
        const user = this.getUser();
        return user?.role === 'admin';
    },

    updateUI() {
        const authLinks = document.getElementById('authLinks');
        if (!authLinks) return;

        if (this.isAuthenticated()) {
            const user = this.getUser();
            authLinks.innerHTML = `
                <a href="#" data-page="dashboard">Dashboard</a>
                ${user.role === 'admin' ? '<a href="#" data-page="admin">Admin</a>' : ''}
                <a href="#" onclick="Auth.logout()">Logout</a>
            `;
        } else {
            authLinks.innerHTML = `
                <a href="#" data-page="login">Login</a>
                <a href="#" data-page="register" class="btn btn-primary" style="padding: 0.5rem 1rem;">Register</a>
            `;
        }

        // Re-attach event listeners
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                Router.navigate(page);
            });
        });
    },

    logout() {
        this.clearAuth();
        Router.navigate('home');
        UI.showToast('Logged out successfully', 'success');
    },
    
    async init() {
    const token = this.getToken();
    if (token) {
        try {
            const user = await API.getMe();
            this.setAuth(token, user);
        } catch (error) {
            // Only clear auth if token is actually invalid, not for network errors
            if (error.message.includes('Token is not valid') || error.message.includes('401')) {
                console.log('Token invalid, clearing auth');
                this.clearAuth();
            } else {
                console.log('API error but keeping token:', error.message);
                // Keep existing auth for transient errors
            }
        }
    }
    this.updateUI();
}
    
};