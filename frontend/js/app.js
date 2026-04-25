const Router = {
    currentPage: 'home',

    routes: {
        home: () => Pages.home(),
        login: () => Pages.login(),
        forgot: () => Pages.forgotPassword(),
        'reset-password': () => Pages.resetPassword(),
        register: () => Pages.register(),
        tournaments: () => Pages.tournaments(),
        tournament: (id) => Pages.tournamentDetail(id),
        dashboard: () => Pages.dashboard(),
        leaderboard: () => Pages.leaderboard(),
        admin: () => Pages.admin(),
        profile: () => Pages.profile()
    },

    navigate(page, params = null) {
        this.currentPage = page;
        
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === page) {
                link.classList.add('active');
            }
        });

        document.getElementById('navLinks').classList.remove('active');

        const mainContent = document.getElementById('mainContent');
        
        if (page.startsWith('tournament/')) {
            const id = page.split('/')[1];
            this.routes.tournament(id);
        } else if (this.routes[page]) {
            if (['dashboard', 'profile'].includes(page) && !Auth.isAuthenticated()) {
                this.navigate('login');
                return;
            }
            if (page === 'admin' && !Auth.isAdmin()) {
                this.navigate('home');
                return;
            }
            this.routes[page]();
        } else {
            mainContent.innerHTML = '<div class="empty-state"><h1>404</h1><p>Page not found</p></div>';
        }

        window.scrollTo(0, 0);
    }
};

function parseQuotedArgs(expression) {
    const args = [];
    const regex = /'((?:\\'|[^'])*)'/g;
    let match;
    while ((match = regex.exec(expression)) !== null) {
        args.push(match[1].replace(/\\'/g, "'"));
    }
    return args;
}

function executeLegacyHandlerExpression(expression, element, event) {
    const expr = (expression || '').trim();

    if (expr.startsWith('Router.navigate(')) {
        const [page] = parseQuotedArgs(expr);
        if (page) Router.navigate(page);
        return;
    }
    if (expr === 'Auth.logout()') {
        Auth.logout();
        return;
    }
    if (expr === 'UI.closeModal()') {
        UI.closeModal();
        return;
    }
    if (expr.startsWith('Pages.switchTab(')) {
        const [tabName] = parseQuotedArgs(expr);
        if (tabName) Pages.switchTab.call(element, tabName, event);
        return;
    }
    if (expr.startsWith('UI.showSubmitResultModal(')) {
        const args = parseQuotedArgs(expr);
        UI.showSubmitResultModal(...args);
        return;
    }
    if (expr.startsWith('UI.startTournament(')) {
        const [tournamentId] = parseQuotedArgs(expr);
        if (tournamentId) UI.startTournament(tournamentId);
        return;
    }
    if (expr.startsWith('UI.showBracketModal(')) {
        const args = parseQuotedArgs(expr);
        UI.showBracketModal(...args);
        return;
    }
    if (expr.startsWith('UI.showJoinModal(')) {
        const match = expr.match(/^UI\.showJoinModal\('((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)',\s*([0-9.]+),\s*'((?:\\'|[^'])*)'\)$/);
        if (match) {
            const tournamentId = match[1].replace(/\\'/g, "'");
            const tournamentName = match[2].replace(/\\'/g, "'");
            const entryFee = Number(match[3]);
            const adminPhone = match[4].replace(/\\'/g, "'");
            UI.showJoinModal(tournamentId, tournamentName, entryFee, adminPhone);
            return;
        }
    }
    if (expr.startsWith('Pages.showCreateTournamentModal(')) {
        Pages.showCreateTournamentModal();
        return;
    }
    if (expr.startsWith('Pages.verifyPayment(')) {
        const args = parseQuotedArgs(expr);
        Pages.verifyPayment(...args);
        return;
    }
    if (expr.startsWith('Pages.resolveMatch(')) {
        const args = parseQuotedArgs(expr);
        Pages.resolveMatch(...args);
        return;
    }
    if (expr.startsWith('Pages.showCustomResolveModal(')) {
        const args = parseQuotedArgs(expr);
        Pages.showCustomResolveModal(...args);
        return;
    }
    if (expr.startsWith('Pages.showAdvancementDebug(')) {
        const args = parseQuotedArgs(expr);
        Pages.showAdvancementDebug(...args);
        return;
    }
    if (expr.startsWith('window.open(')) {
        const args = parseQuotedArgs(expr);
        if (args[0]) window.open(args[0], args[1] || '_blank');
        return;
    }
    if (expr.startsWith('navigator.clipboard.writeText(')) {
        if (expr.includes("document.getElementById('resetLinkField').value")) {
            const resetField = document.getElementById('resetLinkField');
            navigator.clipboard.writeText(resetField?.value || '');
            return;
        }
        const [text] = parseQuotedArgs(expr);
        navigator.clipboard.writeText(text || '');
    }
}

function wireLegacyInlineHandlers(root = document) {
    const nodes = root.querySelectorAll ? root.querySelectorAll('[onclick]') : [];
    nodes.forEach((node) => {
        const expression = node.getAttribute('onclick');
        if (!expression) return;
        node.removeAttribute('onclick');
        node.addEventListener('click', (event) => {
            if (node.tagName === 'A') event.preventDefault();
            executeLegacyHandlerExpression(expression, node, event);
        });
    });
}

const ChatUI = {
    render(roomId, title = 'Community Chat') {
        API.initSocket();
        
        if (window.Chat) {
            Chat.joinRoom(roomId, title);
            return Chat.render(roomId, title);
        }
        
        return `
            <div class="chat-container" id="chat-${roomId}" data-room="${roomId}">
                <div class="chat-header">${title}</div>
                <div class="chat-messages" id="messages-${roomId}"></div>
                <form class="chat-input-area" id="form-${roomId}">
                    <input type="text" id="input-${roomId}" placeholder="Type a message..." required>
                    <button type="submit">${UI.icons.arrowRight}</button>
                </form>
            </div>
        `;
    },

    attachListeners(roomId) {
        if (window.Chat) {
            Chat.attachListeners(roomId);
            return;
        }

        const form = document.getElementById(`form-${roomId}`);
        const input = document.getElementById(`input-${roomId}`);
        const messages = document.getElementById(`messages-${roomId}`);

        if (!form || !input || !messages) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (input.value.trim()) {
                API.sendMessage(roomId, input.value);
                input.value = '';
            }
        });

        if (API.socket) {
            API.socket.on('new-message', (data) => {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-msg';
                msgDiv.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
                messages.appendChild(msgDiv);
                messages.scrollTop = messages.scrollHeight;
            });
        }
    }
};

const Pages = {
    TOURNAMENT_FORMATS: {
        single_elimination: {
            name: 'Single Elimination',
            description: 'Lose once and you\'re out. Fast and simple.',
            recommended: '8-64 players'
        },
        double_elimination: {
            name: 'Double Elimination',
            description: 'Two losses to eliminate. Fairer but longer.',
            recommended: '8-32 players'
        },
        round_robin: {
            name: 'Round Robin',
            description: 'Everyone plays everyone. Best for small groups.',
            recommended: '4-12 players'
        },
        swiss: {
            name: 'Swiss System',
            description: 'Play similar-skilled opponents. Chess/Esports standard.',
            recommended: '8-128 players'
        },
        league: {
            name: 'League',
            description: 'Season-long competition with home/away fixtures.',
            recommended: '4-20 players'
        }
    },

        async home() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = '<div class="spinner"></div>';

        let liveTournamentHtml = `
            <div class="empty-state">
                <p>No live tournament right now.</p>
                <p style="color: var(--gray-500); font-size: 0.875rem; margin-top: 0.5rem;">Check upcoming competitions in the tournaments page.</p>
            </div>
        `;

        try {
            const tournaments = await API.getTournaments();
            const ongoing = tournaments.find(t => t.status === 'ongoing');
            const fallbackOpen = tournaments.find(t => t.status === 'open');
            const liveTournament = ongoing || fallbackOpen || null;

            if (liveTournament) {
                const statusLabel = ongoing ? 'Live Now' : 'Starting Soon';
                liveTournamentHtml = `
                    <div class="live-tournament-card">
                        <div class="live-tournament-header">
                            <h3>${liveTournament.name}</h3>
                            <span class="tournament-status status-${liveTournament.status}">${statusLabel}</span>
                        </div>
                        <p style="color: var(--gray-500); margin: 0.5rem 0 1rem;">
                            ${liveTournament.description || 'Join the action and compete for the top spot.'}
                        </p>
                        <div class="live-tournament-meta">
                            <span>${UI.formatCurrency(liveTournament.entryFee || 0)} entry</span>
                            <span>${UI.formatCurrency(liveTournament.prizePool || 0)} prize</span>
                            <span>${(liveTournament.registeredPlayers || []).length} players</span>
                        </div>
                        <div style="margin-top: 1rem;">
                            <button class="btn btn-primary" onclick="Router.navigate('tournament/${liveTournament._id}')">View Tournament</button>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            liveTournamentHtml = `
                <div class="empty-state">
                    <p>Could not load live tournament.</p>
                    <p style="color: var(--gray-500); font-size: 0.875rem; margin-top: 0.5rem;">Try refreshing the page.</p>
                </div>
            `;
        }

        mainContent.innerHTML = `
            <section class="hero">
                <h1>Compete. <span>Win.</span> Earn.</h1>
                <p>Join the ultimate eFootball tournament platform. Compete against the best players in Kenya, win cash prizes, and climb the leaderboard.</p>
                <div class="cta-buttons">
                    <button class="btn btn-primary btn-lg" onclick="Router.navigate('tournaments')">
                        ${UI.icons.arrowRight} Browse Tournaments
                    </button>
                    ${!Auth.isAuthenticated() ? `<button class="btn btn-secondary btn-lg" onclick="Router.navigate('register')">Create Account</button>` : ''}
                </div>
            </section>

            <!-- Player Cards Showcase - Only on Home -->
            <section class="player-showcase" aria-label="Featured players">
                <h2>Featured Players</h2>
                <div class="player-cards-grid">
                    <div class="player-card featured">
                        <img src="messi.png" alt="Lionel Messi" loading="lazy">
                        <div class="player-card-overlay">
                            <h3>Lionel Messi</h3>
                            <p>OVR 98 &bull; CF</p>
                        </div>
                    </div>
                    
                    <div class="player-card">
                        <img src="batistuta.png" alt="Gabriel Batistuta" loading="lazy">
                        <div class="player-card-overlay">
                            <h3>Gabriel Batistuta</h3>
                            <p>OVR 95 &bull; ST</p>
                        </div>
                    </div>
                    
                    <div class="player-card">
                        <img src="ronaldo.png" alt="Cristiano Ronaldo" loading="lazy">
                        <div class="player-card-overlay">
                            <h3>Cristiano Ronaldo</h3>
                            <p>OVR 97 &bull; ST</p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="live-tournament-section">
                <h2>Live Tournament</h2>
                ${liveTournamentHtml}
            </section>
            
            <section class="how-it-works">
                <h2>How It Works</h2>
                <div class="steps-grid">
                    <div class="step-card">
                        <div class="step-icon" data-step="1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <h3>Register</h3>
                        <p>Create your account and set your eFootball ID</p>
                    </div>
                    <div class="step-card">
                        <div class="step-icon" data-step="2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>
                        </div>
                        <h3>Pay Entry Fee</h3>
                        <p>Send M-Pesa to admin and upload proof</p>
                    </div>
                    <div class="step-card">
                        <div class="step-icon" data-step="3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/></svg>
                        </div>
                        <h3>Play & Win</h3>
                        <p>Compete in matches and submit results</p>
                    </div>
                    <div class="step-card">
                        <div class="step-icon" data-step="4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                        </div>
                        <h3>Collect Prizes</h3>
                        <p>Winners receive M-Pesa prize money</p>
                    </div>
                </div>
            </section>
        `;

        // Initialize chat after content is in DOM
        ChatUI.attachListeners('global');
    },

    login() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="form-container fade-in">
                <h2>Welcome Back</h2>
                <form id="loginForm">
                    ${UI.createFormGroup('Email', 'email', 'email', 'your@email.com')}
                    ${UI.createFormGroup('Password', 'password', 'password', '••••••••')}
                    <p style="text-align: right; margin-top: -0.5rem; margin-bottom: 1rem;">
                        <a href="#" onclick="Router.navigate('forgot')" style="color: var(--primary); font-size: 0.875rem; font-weight: 500;">Forgot password?</a>
                    </p>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Login</button>
                </form>
                <p style="text-align: center; margin-top: 1.5rem; color: var(--gray-500);">
                    Don't have an account? <a href="#" onclick="Router.navigate('register')" style="color: var(--primary); font-weight: 600;">Register</a>
                </p>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                UI.showLoading();
                const data = await API.login({
                    email: formData.get('email'),
                    password: formData.get('password')
                });
                Auth.setAuth(data.token, data.user);
                UI.showToast('Welcome back!', 'success');
                Router.navigate('dashboard');
            } catch (error) {
                UI.showToast(error.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    },

    forgotPassword() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="form-container fade-in">
                <h2>Forgot Password</h2>
                <p style="color: var(--gray-500); margin-bottom: 1rem; text-align: center; font-size: 0.9375rem;">
                    Enter your account email and we will generate a reset link.
                </p>
                <form id="forgotPasswordForm">
                    ${UI.createFormGroup('Email', 'email', 'email', 'your@email.com')}
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Generate Reset Link</button>
                </form>
                <p style="text-align: center; margin-top: 1.5rem; color: var(--gray-500);">
                    Remembered your password? <a href="#" onclick="Router.navigate('login')" style="color: var(--primary); font-weight: 600;">Login</a>
                </p>
                <div id="resetLinkContainer" style="display: none; margin-top: 1rem; padding: 0.875rem; background: var(--gray-100); border-radius: 8px;">
                    <small style="color: var(--gray-500);">Reset link:</small>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <input id="resetLinkField" readonly style="width: 100%; padding: 0.625rem; background: var(--light); border: 1px solid var(--border); color: var(--gray-800); border-radius: 6px;">
                        <button type="button" class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('resetLinkField').value)">Copy</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                UI.showLoading();
                const result = await API.forgotPassword(formData.get('email'));
                UI.showToast(result.message || 'Check your email for the reset link.', 'success');
                
                if (result.debugLink) {
                    const container = document.getElementById('resetLinkContainer');
                    const field = document.getElementById('resetLinkField');
                    if (container && field) {
                        container.style.display = 'block';
                        field.value = result.debugLink;
                    }
                }
            } catch (error) {
                UI.showToast(error.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    },

    resetPassword() {
        const mainContent = document.getElementById('mainContent');
        const token = new URLSearchParams(window.location.search).get('token') || '';

        mainContent.innerHTML = `
            <div class="form-container fade-in">
                <h2>Reset Password</h2>
                <form id="resetPasswordForm">
                    ${UI.createFormGroup('Reset Token', 'text', 'token', 'Paste reset token')}
                    ${UI.createFormGroup('New Password', 'password', 'password', '••••••••')}
                    ${UI.createFormGroup('Confirm Password', 'password', 'confirmPassword', '••••••••')}
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Reset Password</button>
                </form>
                <p style="text-align: center; margin-top: 1.5rem; color: var(--gray-500);">
                    Back to <a href="#" onclick="Router.navigate('login')" style="color: var(--primary); font-weight: 600;">Login</a>
                </p>
            </div>
        `;

        if (token) {
            const tokenField = document.getElementById('token');
            if (tokenField) tokenField.value = token;
        }

        document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const tokenValue = formData.get('token');
            const password = formData.get('password');
            const confirmPassword = formData.get('confirmPassword');

            if (password !== confirmPassword) {
                UI.showToast('Passwords do not match', 'error');
                return;
            }

            try {
                UI.showLoading();
                const result = await API.resetPassword(tokenValue, password);
                UI.showToast(result.message || 'Password reset successful', 'success');
                Router.navigate('login');
            } catch (error) {
                UI.showToast(error.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    },

    register() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="form-container fade-in">
                <h2>Create Account</h2>
                <form id="registerForm">
                    ${UI.createFormGroup('Username', 'text', 'username', 'GamerTag')}
                    ${UI.createFormGroup('Email', 'email', 'email', 'your@email.com')}
                    ${UI.createFormGroup('Password', 'password', 'password', '••••••••')}
                    ${UI.createFormGroup('Team Name', 'text', 'teamName', 'Your Team')}
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Create Account</button>
                </form>
                <p style="text-align: center; margin-top: 1.5rem; color: var(--gray-500);">
                    Already have an account? <a href="#" onclick="Router.navigate('login')" style="color: var(--primary); font-weight: 600;">Login</a>
                </p>
            </div>
        `;

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                UI.showLoading();
                const data = await API.register({
                    username: formData.get('username'),
                    email: formData.get('email'),
                    password: formData.get('password'),
                    teamName: formData.get('teamName')
                });
                Auth.setAuth(data.token, data.user);
                UI.showToast('Account created! Welcome!', 'success');
                Router.navigate('dashboard');
            } catch (error) {
                UI.showToast(error.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    },

    async tournaments() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = '<div class="spinner"></div>';

        try {
            const tournaments = await API.getTournaments();
            mainContent.innerHTML = `
                <h2 style="color: var(--dark); margin-bottom: 1rem; font-weight: 800; font-family: var(--font-display); letter-spacing: -0.02em;">Active Tournaments</h2>
                <div class="card-grid">
                    ${tournaments.length ? tournaments.map(t => UI.renderTournamentCard(t)).join('') : 
                    '<div class="empty-state"><p>No tournaments available</p></div>'}
                </div>
            `;
        } catch (error) {
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading tournaments</p></div>`;
        }
    },

    async tournamentDetail(id) {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = '<div class="spinner"></div>';

        try {
            const tournament = await API.getTournament(id);
            const isRegistered = tournament.registeredPlayers?.some(
                p => p.user?._id === Auth.getUser()?._id
            );

            const isRoundBased = ['round_robin', 'league', 'swiss'].includes(tournament.format);
            const formatInfo = this.TOURNAMENT_FORMATS[tournament.format] || this.TOURNAMENT_FORMATS.single_elimination;
            
            mainContent.innerHTML = `
                <div class="tournament-detail-header">
                    <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h1 style="color: var(--dark); font-weight: 800; font-family: var(--font-display); letter-spacing: -0.03em;">${tournament.name}</h1>
                            <p style="color: var(--gray-500); margin-top: 0.5rem;">
                                ${tournament.description || ''}
                                <span class="format-badge">
                                    <span>${formatInfo.name}</span>
                                </span>
                            </p>
                        </div>
                        <span class="tournament-status status-${tournament.status}">${tournament.status}</span>
                    </div>
                    
                    <div class="stats-grid" style="margin-top: 1.5rem;">
                        <div class="stat-card">
                            <div class="stat-value">${UI.formatCurrency(tournament.prizePool || tournament.entryFee * tournament.registeredPlayers?.length * 0.8)}</div>
                            <div class="stat-label">Prize Pool</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${UI.formatCurrency(tournament.entryFee)}</div>
                            <div class="stat-label">Entry Fee</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${tournament.registeredPlayers?.length || 0}</div>
                            <div class="stat-label">Players</div>
                        </div>
                        ${isRoundBased ? `
                        <div class="stat-card">
                            <div class="stat-value">${tournament.settings?.rounds || 1}</div>
                            <div class="stat-label">Rounds</div>
                        </div>
                        ` : `
                        <div class="stat-card">
                            <div class="stat-value">Bo${tournament.settings?.bestOf || 1}</div>
                            <div class="stat-label">Format</div>
                        </div>
                        `}
                    </div>

                    ${tournament.whatsappLink ? `
                        <div style="margin-top: 1.5rem;">
                            <a href="${tournament.whatsappLink}" target="_blank" rel="noopener noreferrer" class="whatsapp-btn">
                                ${UI.icons.phone} Join Tournament WhatsApp Group
                            </a>
                        </div>
                    ` : ''}
                </div>

                <div class="tournament-tabs">
                    <button class="tab-btn active" onclick="Pages.switchTab('standings')">
                        ${isRoundBased ? 'Standings' : 'Rankings'}
                    </button>
                    <button class="tab-btn" onclick="Pages.switchTab('players')">Players</button>
                    <button class="tab-btn" onclick="Pages.switchTab('matches')">Matches</button>
                    ${!isRoundBased ? `<button class="tab-btn" onclick="Pages.switchTab('bracket')">Bracket</button>` : ''}
                </div>

                <div id="tab-standings" class="tab-content active">
                    ${await this.renderTournamentLeaderboard(id, tournament)}
                </div>
                <div id="tab-players" class="tab-content">
                    ${this.renderPlayersList(tournament.registeredPlayers)}
                </div>
                <div id="tab-matches" class="tab-content">
                    ${await this.renderMatches(id, tournament.format)}
                </div>
                ${!isRoundBased ? `
                <div id="tab-bracket" class="tab-content">
                    ${await this.renderBracket(id)}
                </div>` : ''}
            `;

            // Initialize any match lobby chats found in the matches list
            document.querySelectorAll('.chat-container').forEach(chat => {
                const roomId = chat.dataset.room;
                if (roomId && roomId !== 'global') ChatUI.attachListeners(roomId);
            });
        } catch (error) {
            mainContent.innerHTML = `<div class="empty-state"><p>Tournament not found</p></div>`;
        }
    },

    switchTab(tabName, eventArg = null) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const evt = eventArg || window.event;
        if (evt?.target) {
            evt.target.classList.add('active');
        }
        document.getElementById(`tab-${tabName}`).classList.add('active');
    },

    async renderTournamentLeaderboard(id, tournament) {
        try {
            const data = await API.getTournamentBracket(id);
            const standings = data.standings || (await API.authenticatedRequest(`/tournaments/${id}/standings`));
            return UI.renderStandings(standings);
        } catch (error) {
            console.error('Leaderboard error:', error);
            return '<div class="empty-state"><p>Leaderboard not available yet.</p></div>';
        }
    },

    renderStandings(tournament) {
        if (!tournament.standings || tournament.standings.length === 0) {
            return `
                <div class="empty-state">
                    <p>Standings will appear once matches are played</p>
                    ${tournament.status === 'ongoing' ? '<p style="color: var(--gray-500); font-size: 0.875rem; margin-top: 0.5rem;">Matches are in progress...</p>' : ''}
                </div>
            `;
        }

        return `
            <div class="standings-container">
                <table class="standings-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            <th>P</th>
                            <th>W</th>
                            <th>D</th>
                            <th>L</th>
                            <th>GF</th>
                            <th>GA</th>
                            <th>GD</th>
                            <th>PTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tournament.standings.map((s, i) => `
                            <tr class="${i < 3 ? 'rank-' + (i + 1) : ''} ${s.player?._id === Auth.getUser()?._id ? 'highlight-user' : ''}">
                                <td>${s.rank}</td>
                                <td>
                                    <strong>${s.player?.username || 'Unknown'}</strong>
                                    ${s.player?.teamName ? `<br><small>${s.player.teamName}</small>` : ''}
                                    ${s.player?._id === Auth.getUser()?._id ? '<span class="you-badge">(You)</span>' : ''}
                                </td>
                                <td>${s.played}</td>
                                <td class="text-success">${s.wins}</td>
                                <td>${s.draws}</td>
                                <td class="text-danger">${s.losses}</td>
                                <td>${s.goalsFor}</td>
                                <td>${s.goalsAgainst}</td>
                                <td class="${s.goalDifference > 0 ? 'text-success' : s.goalDifference < 0 ? 'text-danger' : ''}">${s.goalDifference > 0 ? '+' : ''}${s.goalDifference}</td>
                                <td class="points">${s.points}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async renderBracket(tournamentId) {
        if (!Auth.isAuthenticated()) {
            return '<div class="empty-state"><p>Login to view bracket</p></div>';
        }

        if (!window._bracketSocketInit) {
    API.initSocket();
    if (API.socket) {
        API.socket.emit('join-tournament', tournamentId);
        API.socket.on('bracket-update', (data) => {
            const container = document.querySelector('.bracket');
            if (container) container.outerHTML = this.renderBracketFromData(data.matches);
        });
    }
    window._bracketSocketInit = true;
}

        try {
            const data = await API.getTournamentBracket(tournamentId);
            const rounds = data.rounds || data;
            
            if (!rounds || rounds.length === 0) {
                return '<div class="empty-state"><p>Bracket not generated yet</p></div>';
            }

            return `
                <div class="bracket">
                    ${rounds.map((round, idx) => `
                        <div class="round">
                            <h4 class="round-title">Round ${round.round || idx + 1}</h4>
                            ${round.matches.map(match => `
                                <div class="match ${match.status || ''}">
                                    <div class="player ${match.winner?._id === match.player1?._id ? 'winner' : ''} ${!match.player1 ? 'tbd' : ''}">
                                        <span class="player-name">
                                            ${match.player1?.username || 'TBD'}
                                            ${match.player1?.efootballId ? `
                                                <br><small class="efootball-id" style="font-size: 0.7rem; opacity: 0.8;">
                                                    ID: ${match.player1.efootballId}
                                                </small>
                                            ` : ''}
                                        </span>
                                        <span class="player-score">${match.score1 ?? '-'}</span>
                                    </div>
                                    <div class="player ${match.winner?._id === match.player2?._id ? 'winner' : ''} ${!match.player2 ? 'tbd' : ''}">
                                        <span class="player-name">
                                            ${match.player2?.username || 'TBD'}
                                            ${match.player2?.efootballId ? `
                                                <br><small class="efootball-id" style="font-size: 0.7rem; opacity: 0.8;">
                                                    ID: ${match.player2.efootballId}
                                                </small>
                                            ` : ''}
                                        </span>
                                        <span class="player-score">${match.score2 ?? '-'}</span>
                                    </div>
                                    ${match.status === 'completed' ? '<div class="match-status-check"></div>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Bracket error:', error);
            return `<div class="empty-state"><p>Unable to load bracket: ${error.message}</p></div>`;
        }
    },

    renderBracketFromData(matches) {
    const rounds = {};
    matches.forEach(m => { if (!rounds[m.round]) rounds[m.round] = []; rounds[m.round].push(m); });
    return `<div class="bracket">${Object.keys(rounds).sort((a,b)=>a-b).map(r=>`<div class="round"><h4 class="round-title">Round ${r}</h4>${rounds[r].map(m=>`<div class="match ${m.status}"><div class="player ${m.winner?._id===m.player1?._id?'winner':''} ${!m.player1?'tbd':''}"><span class="player-name">${m.player1?.username||'TBD'}</span><span class="player-score">${m.score1??'-'}</span></div><div class="player ${m.winner?._id===m.player2?._id?'winner':''} ${!m.player2?'tbd':''}"><span class="player-name">${m.player2?.username||'TBD'}</span><span class="player-score">${m.score2??'-'}</span></div></div>`).join('')}</div>`).join('')}</div>`;
},

    renderPlayersList(players) {
        if (!players || players.length === 0) {
            return '<div class="empty-state"><p>No players registered yet</p></div>';
        }

        return `
            <div class="leaderboard-table">
                <table style="width: 100%;">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            <th>Team</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((p, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${p.user?.username || 'Unknown'}</td>
                                <td>${p.user?.teamName || '-'}</td>
                                <td>${p.paid ? '<span class="status-paid">Paid</span>' : '<span class="status-pending">Pending</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async renderMatches(tournamentId, format) {
        try {
            const tournament = await API.getTournament(tournamentId);
            let matches = tournament.matches || [];
            matches = matches.filter(match => match.player1 !== null || match.player2 !== null);
            
            if (matches.length === 0) {
                return '<div class="empty-state"><p>No active matches yet. Tournament may still be in registration phase.</p></div>';
            }

            const isRoundBased = ['round_robin', 'league', 'swiss'].includes(format);

            return `
                <div class="matches-list">
                    ${matches.map((match) => {
                        const player1 = match.player1;
                        const player2 = match.player2;
                        const winner = match.winner;
                        const status = match.status || 'scheduled';
                        const round = match.round || 1;
                        
                        const isPlayer1 = player1?._id === Auth.getUser()?._id;
                        const isPlayer2 = player2?._id === Auth.getUser()?._id;
                        const isMyMatch = isPlayer1 || isPlayer2;
                        
                        const p1Name = player1?.username || 'TBD';
                        const p2Name = player2?.username || 'TBD';
                        const winnerName = winner?.username;

                        return `
                            <div class="match-card ${status} ${isMyMatch ? 'my-match' : ''}">
                                <div class="match-card-header">
                                    <div class="match-badges">
                                        <span class="match-status-badge ${status}">${status}</span>
                                        ${isRoundBased ? `<span class="match-round">Round ${round}</span>` : ''}
                                        ${match.matchNumber ? `<span class="match-number">#${match.matchNumber}</span>` : ''}
                                        ${isMyMatch ? '<span class="match-your">Your Match</span>' : ''}
                                    </div>
                                </div>
                                
                                <div class="match-players-row">
                                    <span class="${winner?._id === player1?._id ? 'winner' : winner && winner._id !== player1?._id ? 'loser' : ''}">${p1Name}</span>
                                    <span class="match-vs">
                                        ${status === 'completed' ? `${match.score1 ?? 0} - ${match.score2 ?? 0}` : 'VS'}
                                    </span>
                                    <span class="${winner?._id === player2?._id ? 'winner' : winner && winner._id !== player2?._id ? 'loser' : ''}">${p2Name}</span>
                                </div>
                                
                                ${winnerName ? `
                                    <div class="match-winner">
                                        Winner: ${winnerName}
                                    </div>
                                ` : ''}
                                
                                ${isMyMatch && status === 'scheduled' ? `
                                    <div class="match-lobby-integration">
                                        ${ChatUI.render(match._id, 'Match Lobby')}
                                    </div>
                                ` : ''}

                                ${isMyMatch && status === 'scheduled' && player1 && player2 ? `
                                    <button class="btn btn-primary" onclick="UI.showSubmitResultModal('${match._id}', '${tournamentId}', '${p1Name}', '${p2Name}')">
                                        Submit Result
                                    </button>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Matches error:', error);
            return `<div class="empty-state"><p>Error loading matches: ${error.message}</p></div>`;
        }
    },

    async dashboard() {
        const mainContent = document.getElementById('mainContent');
        
        try {
            const [stats, tournaments, upcoming] = await Promise.all([
                API.getUserStats(),
                API.getUserTournaments(),
                API.getUpcomingMatches()
            ]);

            const safeUpcoming = (upcoming || []).map(m => ({
                ...m,
                opponent: m.opponent || { username: 'Unknown', efootballId: 'N/A' },
                player: m.player || { username: 'You' },
                tournament: m.tournament || { name: 'Unknown Tournament' }
            }));

            mainContent.innerHTML = `
                <div class="dashboard">
                    <aside class="sidebar">
                        <ul class="sidebar-menu">
                            <li><a href="#" class="active" onclick="Router.navigate('dashboard')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                                Overview
                            </a></li>
                            <li><a href="#" onclick="Router.navigate('profile')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                My Profile
                            </a></li>
                            <li><a href="#" onclick="Router.navigate('tournaments')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                                Browse Tournaments
                            </a></li>
                        </ul>
                    </aside>

                    <div class="dashboard-content">
                        <h2 style="color: var(--dark); margin-bottom: 1.5rem; font-weight: 800; font-family: var(--font-display); letter-spacing: -0.02em;">Dashboard</h2>
                        
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">${stats?.points || 0}</div>
                                <div class="stat-label">Points</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats?.wins || 0}</div>
                                <div class="stat-label">Wins</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats?.losses || 0}</div>
                                <div class="stat-label">Losses</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${((stats?.wins || 0) + (stats?.losses || 0)) > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%</div>
                                <div class="stat-label">Win Rate</div>
                            </div>
                        </div>

                        <h3 style="color: var(--dark); margin: 2rem 0 1rem; font-weight: 700; font-family: var(--font-display);">My Tournaments</h3>
                        ${tournaments?.length ? `
                            <div class="card-grid">
                                ${tournaments.map(t => UI.renderTournamentCard(t)).join('')}
                            </div>
                        ` : '<p style="color: var(--gray-500);">You haven\'t joined any tournaments yet.</p>'}

                        <h3 style="color: var(--dark); margin: 2rem 0 1rem; font-weight: 700; font-family: var(--font-display);">Upcoming Matches</h3>
                        ${safeUpcoming.length ? safeUpcoming.map(m => `
                            <div class="tournament-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <h4 style="font-weight: 700;">vs ${m.opponent?.username || 'Unknown'}</h4>
                                        <p style="color: var(--gray-500); font-size: 0.875rem;">${m.tournament?.name || 'Unknown Tournament'}</p>
                                    </div>
                                    <button class="btn btn-primary" onclick="UI.showSubmitResultModal('${m._id}', '${m.tournament?._id}', '${m.player?.username || 'You'}', '${m.opponent?.username || 'Opponent'}')">Submit Result</button>
                                </div>
                                <div class="efootball-id-box">
                                    <p style="margin-bottom: 0.5rem; font-weight: 600; font-size: 0.875rem;"><strong>Opponent eFootball ID:</strong></p>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <code>${m.opponent?.efootballId || 'N/A'}</code>
                                        <button class="copy-btn" onclick="navigator.clipboard.writeText('${m.opponent?.efootballId || ''}')">Copy</button>
                                    </div>
                                </div>
                            </div>
                        `).join('') : '<p style="color: var(--gray-500);">No upcoming matches.</p>'}
                    </div>
                </div>
            `;
        } catch (error) {  
            console.error('Dashboard error details:', error);
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading dashboard: ${error.message}</p></div>`;
        }
    },

    async leaderboard() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = '<div class="spinner"></div>';

        try {
            const players = await API.getLeaderboard();
            mainContent.innerHTML = `
                <h2 style="color: var(--dark); margin-bottom: 2rem; font-weight: 800; font-family: var(--font-display); letter-spacing: -0.02em;">Global Leaderboard</h2>
                <div class="leaderboard-table responsive-leaderboard">
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th class="hide-mobile">Played</th>
                                <th>W</th>
                                <th>L</th>
                                <th class="hide-tablet">Win%</th>
                                <th class="hide-tablet">GF</th>
                                <th class="hide-tablet">GA</th>
                                <th>Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${players.map((p, idx) => `
                                <tr class="${idx < 3 ? 'rank-' + (idx + 1) : ''} ${p._id === Auth.getUser()?._id ? 'highlight-user' : ''}">
                                    <td class="rank-cell">${p.rank || (idx + 1)}</td>
                                    <td>
                                        <strong>${p.username}</strong>
                                        ${p.teamName ? `<br><small>${p.teamName}</small>` : ''}
                                        ${p.efootballId ? `<br><small class="efootball-id">ID: ${p.efootballId}</small>` : ''}
                                        ${p._id === Auth.getUser()?._id ? '<span class="you-badge">(You)</span>' : ''}
                                    </td>
                                    <td class="hide-mobile">${p.played}</td>
                                    <td class="text-success">${p.wins}</td>
                                    <td class="text-danger">${p.losses}</td>
                                    <td class="hide-tablet">${p.winRate}%</td>
                                    <td class="hide-tablet">${p.goalsFor}</td>
                                    <td class="hide-tablet">${p.goalsAgainst}</td>
                                    <td class="points">${p.points}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="color: var(--gray-500); text-align: center; margin-top: 1rem; font-size: 0.875rem;">
                    Points: 3 for win, 1 for loss | Updated from all tournament matches
                </p>
            `;
        } catch (error) {
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading leaderboard: ${error.message}</p></div>`;
        }
    },

    async admin() {
        const mainContent = document.getElementById('mainContent');
        
        try {
            const [stats, pendingPayments, pendingResults] = await Promise.all([
                API.getAdminStats(),
                API.getPendingPayments(),
                API.getPendingResults()
            ]);

            mainContent.innerHTML = `
                <div class="dashboard">
                    <aside class="sidebar">
                        <ul class="sidebar-menu">
                            <li><a href="#" class="active">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                                Dashboard
                            </a></li>
                            <li><a href="#" onclick="Pages.showCreateTournamentModal()">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                Create Tournament
                            </a></li>
                            <li><a href="#" onclick="Router.navigate('tournaments')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                                All Tournaments
                            </a></li>
                        </ul>
                    </aside>

                    <div class="dashboard-content">
                        <h2 style="color: var(--dark); margin-bottom: 1.5rem; font-weight: 800; font-family: var(--font-display); letter-spacing: -0.02em;">
                            Admin Panel <span class="admin-badge">Admin</span>
                        </h2>

                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">${stats.totalUsers || 0}</div>
                                <div class="stat-label">Total Users</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats.totalTournaments || 0}</div>
                                <div class="stat-label">Tournaments</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${(pendingPayments?.length || 0) + (pendingResults?.length || 0)}</div>
                                <div class="stat-label">Pending Verifications</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${UI.formatCurrency(stats.totalRevenue || 0)}</div>
                                <div class="stat-label">Total Revenue</div>
                            </div>
                        </div>

                        <h3 style="color: var(--dark); margin: 2rem 0 1rem; font-weight: 700; font-family: var(--font-display);">
                            Payment Verifications (${pendingPayments?.length || 0})
                        </h3>
                        ${pendingPayments?.length ? `
                            <div class="pending-payments">
                                ${pendingPayments.map(p => `
                                    <div class="payment-item">
                                        <div class="payment-info">
                                            <img src="${p.screenshotPath}" alt="Payment proof" class="payment-proof-img" onclick="window.open('${p.screenshotPath}', '_blank')" loading="lazy">
                                            <div>
                                                <strong>${p.user?.username || 'Unknown'}</strong>
                                                <p style="color: var(--gray-500); font-size: 0.875rem; margin: 0;">
                                                    ${p.tournament?.name || 'Unknown Tournament'}<br>
                                                    ${UI.formatCurrency(p.amount)} | ${p.mpesaNumber}
                                                </p>
                                            </div>
                                        </div>
                                        <div class="payment-actions">
                                            <button class="btn btn-success btn-sm" onclick="Pages.verifyPayment('${p._id}', 'approve')">Approve</button>
                                            <button class="btn btn-danger btn-sm" onclick="Pages.verifyPayment('${p._id}', 'reject')">Reject</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p style="color: var(--gray-500);">No pending payments.</p>'}

                        <h3 style="color: var(--dark); margin: 2rem 0 1rem; font-weight: 700; font-family: var(--font-display);">
                            Match Verifications (${pendingResults?.length || 0})
                        </h3>
                        ${pendingResults?.length ? `
                            <div class="pending-results">
                                ${pendingResults.map(r => `
                                    <div class="result-item ${r.status === 'disputed' ? 'disputed' : 'pending'}">
                                        <div class="result-header">
                                            <div>
                                                <strong>${r.tournament?.name || 'Unknown Tournament'}</strong>
                                                <p style="color: var(--gray-500); font-size: 0.875rem; margin: 0.25rem 0;">
                                                    Round ${r.round || '-'} | ${r.status === 'disputed' ? 'DISPUTED' : 'Waiting for opponent'}
                                                </p>
                                            </div>
                                            <span class="status-badge ${r.status}">${r.status === 'disputed' ? 'Disputed' : 'Pending'}</span>
                                        </div>
                                        
                                        <div class="result-submissions">
                                            <div class="submission ${r.player1?.submitted ? 'submitted' : ''}">
                                                <div class="submission-header">
                                                    <strong>${r.player1?.user?.username || 'Player 1'}</strong>
                                                    ${r.player1?.submitted ? '<span class="status-check"></span>' : '<span class="status-wait"></span>'}
                                                </div>
                                                ${r.player1?.submitted ? `
                                                    <div class="submission-score">${r.player1?.submission?.score1} - ${r.player1?.submission?.score2}</div>
                                                    <div class="submission-winner">Winner: ${r.player1?.submission?.winner === 'player1' ? r.player1?.user?.username : r.player2?.user?.username}</div>
                                                ` : '<span class="not-submitted">Not submitted</span>'}
                                            </div>

                                            <div class="submission ${r.player2?.submitted ? 'submitted' : ''}">
                                                <div class="submission-header">
                                                    <strong>${r.player2?.user?.username || 'Player 2'}</strong>
                                                    ${r.player2?.submitted ? '<span class="status-check"></span>' : '<span class="status-wait"></span>'}
                                                </div>
                                                ${r.player2?.submitted ? `
                                                    <div class="submission-score">${r.player2?.submission?.score1} - ${r.player2?.submission?.score2}</div>
                                                    <div class="submission-winner">Winner: ${r.player2?.submission?.winner === 'player1' ? r.player1?.user?.username : r.player2?.user?.username}</div>
                                                ` : '<span class="not-submitted">Not submitted</span>'}
                                            </div>
                                        </div>

                                        ${r.status === 'disputed' ? `
                                            <div class="dispute-actions">
                                                <p class="dispute-warning">
                                                    ${UI.icons.warning} Results do not match! 
                                                    <span style="font-size: 0.75rem; opacity: 0.8;">
                                                        (${r.conflicts.score ? 'Score Conflict' : ''} 
                                                         ${r.conflicts.score && r.conflicts.winner ? '&' : ''} 
                                                         ${r.conflicts.winner ? 'Winner Conflict' : ''})
                                                    </span>
                                                </p>
                                                ${r.isStale ? `<p style="color: var(--danger); font-size: 0.75rem; font-weight: 700;">STALE: No activity for 30m</p>` : ''}
                                                <div class="action-buttons">
                                                    <button class="btn btn-success btn-sm" onclick="Pages.resolveMatch('${r.matchId}', 'player1_correct')">
                                                        ${r.player1?.user?.username} Correct
                                                    </button>
                                                    <button class="btn btn-success btn-sm" onclick="Pages.resolveMatch('${r.matchId}', 'player2_correct')">
                                                        ${r.player2?.user?.username} Correct
                                                    </button>
                                                    <button class="btn btn-warning btn-sm" onclick="Pages.showCustomResolveModal('${r.matchId}', '${r.player1?.user?.username}', '${r.player2?.user?.username}')">
                                                        Custom
                                                    </button>
                                                    <button class="btn btn-secondary btn-sm" onclick="Pages.showAdvancementDebug('${r.matchId}')">
                                                        Debug
                                                    </button>
                                                </div>
                                            </div>
                                        ` : `
                                            <p style="color: var(--gray-500); font-size: 0.875rem; margin-top: 0.5rem;">
                                                ${r.disputeReason || ''}
                                            </p>
                                            <div style="margin-top: 0.75rem;">
                                                <button class="btn btn-secondary btn-sm" onclick="Pages.showAdvancementDebug('${r.matchId}')">
                                                    Debug
                                                </button>
                                            </div>
                                        `}
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p style="color: var(--gray-500);">No matches need verification.</p>'}
                    </div>
                </div>
            `;
        } catch (error) {
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading admin panel</p></div>`;
        }
    },

    showCreateTournamentModal() {
        const content = `
            <div class="modal-header">
                <h3>Create New Tournament</h3>
                <button class="close-btn" onclick="UI.closeModal()" aria-label="Close modal">&times;</button>
            </div>
            <form id="createTournamentForm" style="padding: 1.5rem;">
                ${UI.createFormGroup('Tournament Name', 'text', 'name', 'eFootball Championship')}
                ${UI.createFormGroup('Description', 'text', 'description', 'Brief description')}
                
                <div class="form-group">
                    <label>Tournament Format</label>
                    <select id="formatSelect" name="format" onchange="Pages.updateFormatSettings()">
                        <option value="single_elimination">Single Elimination - Lose once = out</option>
                        <option value="double_elimination">Double Elimination - Two lives</option>
                        <option value="round_robin">Round Robin - Everyone plays everyone</option>
                        <option value="swiss">Swiss System - Chess style</option>
                        <option value="league">League - Season long</option>
                    </select>
                    <p id="formatDescription" style="color: var(--gray-500); font-size: 0.875rem; margin-top: 0.5rem;">
                        Fast tournament. Players eliminated after one loss.
                    </p>
                </div>

                <div id="dynamicSettings"></div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    ${UI.createFormGroup('Entry Fee (KES)', 'number', 'entryFee', '100')}
                    ${UI.createFormGroup('Max Players', 'number', 'maxPlayers', '32')}
                </div>
                
                ${UI.createFormGroup('Start Date', 'datetime-local', 'startDate')}
                ${UI.createFormGroup('Admin Phone (M-Pesa)', 'tel', 'adminPhone', '2547XXXXXXXX')}
                ${UI.createFormGroup('WhatsApp Group Link', 'url', 'whatsappLink', 'https://chat.whatsapp.com/...', false)}
                
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Create Tournament</button>
            </form>
        `;

        const modal = UI.showModal(content);
        Pages.updateFormatSettings();

        document.getElementById('createTournamentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const format = formData.get('format');
            const settings = {
                maxPlayers: parseInt(formData.get('maxPlayers')),
                bestOf: parseInt(document.getElementById('bestOf')?.value) || 1,
                bronzeMatch: document.getElementById('bronzeMatch')?.checked || false,
                rounds: parseInt(document.getElementById('rounds')?.value) || 1,
                pointsWin: parseInt(document.getElementById('pointsWin')?.value) || 3,
                pointsDraw: parseInt(document.getElementById('pointsDraw')?.value) || 1,
                pointsLoss: parseInt(document.getElementById('pointsLoss')?.value) || 0,
                swissRounds: parseInt(document.getElementById('swissRounds')?.value) || 5
            };

            try {
                UI.showLoading();
                await API.createTournament({
                    name: formData.get('name'),
                    description: formData.get('description'),
                    format: format,
                    settings: settings,
                    entryFee: parseInt(formData.get('entryFee')),
                    startDate: formData.get('startDate'),
                    adminPhone: formData.get('adminPhone'),
                    whatsappLink: formData.get('whatsappLink')
                });
                UI.closeModal();
                UI.showToast('Tournament created!', 'success');
                Router.navigate('admin');
            } catch (error) {
                UI.showToast(error.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    },

    updateFormatSettings() {
        const format = document.getElementById('formatSelect').value;
        const container = document.getElementById('dynamicSettings');
        const description = document.getElementById('formatDescription');
        const formatInfo = this.TOURNAMENT_FORMATS[format];

        description.textContent = formatInfo.description;

        const settingsHTML = {
            single_elimination: `
                <div class="form-row">
                    <div class="form-group">
                        <label>Games per Match</label>
                        <select id="bestOf">
                            <option value="1">1 game (Bo1)</option>
                            <option value="3">3 games (Bo3)</option>
                            <option value="5">5 games (Bo5)</option>
                        </select>
                    </div>
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="bronzeMatch">
                            3rd Place Match
                        </label>
                    </div>
                </div>
            `,
            double_elimination: `
                <div class="form-group">
                    <label>Games  per Match</label>
                    <select id="bestOf">
                        <option value="1">1 game (Bo1)</option>
                        <option value="3">3 games (Bo3)</option>
                        <option value="5">5 games (Bo5)</option>
                    </select>
                </div>
            `,
            round_robin: `
                <div class="form-row">
                    <div class="form-group">
                        <label>Times Each Pair Plays</label>
                        <input type="number" id="rounds" min="1" max="4" value="1">
                    </div>
                    <div class="form-group">
                        <label>Points for Win</label>
                        <input type="number" id="pointsWin" value="3">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Points for Draw</label>
                        <input type="number" id="pointsDraw" value="1">
                    </div>
                    <div class="form-group">
                        <label>Points for Loss</label>
                        <input type="number" id="pointsLoss" value="0">
                    </div>
                </div>
            `,
            swiss: `
                <div class="form-row">
                    <div class="form-group">
                        <label>Number of Rounds</label>
                        <input type="number" id="swissRounds" min="3" max="12" value="5">
                        <small>Recommended: log₂(players) + 1</small>
                    </div>
                    <div class="form-group">
                        <label>Points for Win</label>
                        <input type="number" id="pointsWin" value="3">
                    </div>
                </div>
            `,
            league: `
                <div class="form-row">
                    <div class="form-group">
                        <label>Times Each Pair Plays</label>
                        <input type="number" id="rounds" min="1" max="4" value="2">
                        <small>Home & Away = 2</small>
                    </div>
                    <div class="form-group">
                        <label>Points for Win</label>
                        <input type="number" id="pointsWin" value="3">
                    </div>
                </div>
            `
        };

        container.innerHTML = settingsHTML[format] || '';
    },

    async resolveMatch(matchId, decision) {
        try {
            UI.showLoading();
            await API.resolveMatch(matchId, decision);
            UI.showToast('Match resolved successfully', 'success');
            Router.navigate('admin');
        } catch (error) {
            UI.showToast(error.message, 'error');
        } finally {
            UI.hideLoading();
        }
    },

    showCustomResolveModal(matchId, player1Name, player2Name) {
        const p1 = player1Name || 'Player 1';
        const p2 = player2Name || 'Player 2';
        
        const content = `
            <div class="modal-header">
                <h3>Custom Match Resolution</h3>
                <button class="close-btn" onclick="UI.closeModal()" aria-label="Close modal">&times;</button>
            </div>
            <form id="resolveForm" style="padding: 1.5rem;">
                <div class="score-inputs">
                    <div class="form-group">
                        <label>${p1} Score</label>
                        <input type="number" name="score1" min="0" required>
                    </div>
                    <span>-</span>
                    <div class="form-group">
                        <label>${p2} Score</label>
                        <input type="number" name="score2" min="0" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Winner</label>
                    <select name="winner" required>
                        <option value="">Select Winner</option>
                        <option value="player1">${p1}</option>
                        <option value="player2">${p2}</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Reason/Notes</label>
                    <textarea name="reason" rows="2" placeholder="Why are you overriding the submitted results?"></textarea>
                </div>
                
                <button type="submit" class="btn btn-warning" style="width: 100%;">Resolve Match</button>
            </form>
        `;

        const modal = UI.showModal(content);

        document.getElementById('resolveForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                UI.showLoading();
                await API.resolveMatch(matchId, 'custom', {
                    score1: formData.get('score1'),
                    score2: formData.get('score2'),
                    winner: formData.get('winner'),
                    reason: formData.get('reason')
                });
                UI.closeModal();
                UI.showToast('Match resolved with custom result', 'success');
                Router.navigate('admin');
            } catch (error) {
                UI.showToast(error.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    },

    async showAdvancementDebug(matchId) {
        try {
            UI.showLoading();
            const data = await API.getMatchAdvancementDebug(matchId);
            UI.hideLoading();

            const current = data.currentMatch;
            const computed = data.computedNextMatch;
            const persisted = data.persistedNextMatch;

            const content = `
                <div class="modal-header">
                    <h3>Advancement Debug</h3>
                    <button class="close-btn" onclick="UI.closeModal()" aria-label="Close modal">&times;</button>
                </div>
                <div style="padding: 1rem 1.5rem 1.5rem;">
                    <p style="color: var(--gray-500); margin-bottom: 1rem;">
                        ${data.tournament?.name || 'Tournament'} (${data.tournament?.format || 'unknown'})
                    </p>

                    <div class="debug-box">
                        <strong>Current Match</strong>
                        <div>Round ${current.round} - Match #${current.matchNumber} - ${current.status}</div>
                        <div>${current.player1?.username || 'TBD'} vs ${current.player2?.username || 'TBD'}</div>
                        <div>Winner: ${current.winner?.username || 'None'}</div>
                    </div>

                    <div class="debug-box">
                        <strong>Computed Next Match (Logic)</strong>
                        ${computed ? `
                            <div>Round ${computed.round} - Match #${computed.matchNumber} - ${computed.status}</div>
                            <div>${computed.player1?.username || computed.player1 || 'TBD'} vs ${computed.player2?.username || computed.player2 || 'TBD'}</div>
                        ` : '<div>No next match (possibly final or missing winner)</div>'}
                    </div>

                    <div class="debug-box">
                        <strong>Persisted Next Match (DB)</strong>
                        ${persisted ? `
                            <div>Round ${persisted.round} - Match #${persisted.matchNumber} - ${persisted.status}</div>
                            <div>${persisted.player1?.username || 'TBD'} vs ${persisted.player2?.username || 'TBD'}</div>
                        ` : '<div>No persisted next match found</div>'}
                    </div>
                </div>
            `;

            UI.showModal(content);
        } catch (error) {
            UI.hideLoading();
            UI.showToast(error.message || 'Failed to load advancement debug', 'error');
        }
    },

    async verifyPayment(paymentId, action) {
        try {
            UI.showLoading();
            await API.verifyPayment(paymentId, action);
            UI.showToast('Payment ' + action + 'd successfully', 'success');
            Router.navigate('admin');
        } catch (error) {
            UI.showToast(error.message, 'error');
        } finally {
            UI.hideLoading();
        }
    },

    async profile() {
        const mainContent = document.getElementById('mainContent');
        const user = Auth.getUser();

        mainContent.innerHTML = `
            <div class="form-container fade-in">
                <h2>My Profile</h2>
                <form id="profileForm">
                    ${UI.createFormGroup('eFootball ID', 'text', 'efootballId', user.efootballId || '123456789')}
                    ${UI.createFormGroup('Phone Number', 'tel', 'phoneNumber', user.phoneNumber || '2547XXXXXXXX')}
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Update Profile</button>
                </form>
            </div>
        `;

        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                UI.showLoading();
                await API.updateProfile({ 
                    efootballId: formData.get('efootballId'),
                    phoneNumber: formData.get('phoneNumber')
                });
                UI.showToast('Profile updated!', 'success');
                this.profile();
            } catch (error) {
                UI.showToast(error.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    }
};

window.Router = Router;
window.Pages = Pages;

document.addEventListener('DOMContentLoaded', async () => {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            document.getElementById('navLinks').classList.toggle('active');
        });
    }

    await Auth.init();

    if (window.ChatApp) {
        ChatApp.init();
    }
    
    wireLegacyInlineHandlers(document);
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    wireLegacyInlineHandlers(node);
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const pageFromQuery = new URLSearchParams(window.location.search).get('page');
    if (pageFromQuery && Router.routes[pageFromQuery]) {
        Router.navigate(pageFromQuery);
    } else {
        Router.navigate('home');
    }
});