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

const Pages = {
    // Tournament Format Configuration
    TOURNAMENT_FORMATS: {
        single_elimination: {
            name: 'Single Elimination',
            icon: '⚔️',
            description: 'Lose once and you\'re out. Fast and simple.',
            recommended: '8-64 players'
        },
        double_elimination: {
            name: 'Double Elimination',
            icon: '🛡️',
            description: 'Two losses to eliminate. Fairer but longer.',
            recommended: '8-32 players'
        },
        round_robin: {
            name: 'Round Robin',
            icon: '🔄',
            description: 'Everyone plays everyone. Best for small groups.',
            recommended: '4-12 players'
        },
        swiss: {
            name: 'Swiss System',
            icon: '🇨🇭',
            description: 'Play similar-skilled opponents. Chess/Esports standard.',
            recommended: '8-128 players'
        },
        league: {
            name: 'League',
            icon: '🏆',
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
                <p style="color: var(--gray); font-size: 0.9rem; margin-top: 0.5rem;">Check upcoming competitions in the tournaments page.</p>
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
                        <p style="color: var(--gray); margin: 0.5rem 0 1rem;">
                            ${liveTournament.description || 'Join the action and compete for the top spot.'}
                        </p>
                        <div class="live-tournament-meta">
                            <span>💰 ${UI.formatCurrency(liveTournament.entryFee || 0)} entry</span>
                            <span>🏆 ${UI.formatCurrency(liveTournament.prizePool || 0)} prize</span>
                            <span>👥 ${(liveTournament.registeredPlayers || []).length} players</span>
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
                    <p style="color: var(--gray); font-size: 0.9rem; margin-top: 0.5rem;">Try refreshing the page.</p>
                </div>
            `;
        }

        mainContent.innerHTML = `
            <section class="hero">
                <h1>COMPETE. WIN. EARN.</h1>
                <p>Join the ultimate eFootball tournament platform. Compete against the best players in Kenya, win cash prizes, and climb the leaderboard.</p>
                <div class="cta-buttons">
                    <button class="btn btn-primary" onclick="Router.navigate('tournaments')">Browse Tournaments</button>
                    ${!Auth.isAuthenticated() ? `<button class="btn btn-secondary" onclick="Router.navigate('register')">Create Account</button>` : ''}
                </div>
            </section>

            <section class="live-tournament-section">
                <h2 style="font-family: Orbitron; text-align: center; margin-bottom: 1.5rem; color: var(--primary);">Live Tournament</h2>
                ${liveTournamentHtml}
            </section>
            
            <section style="margin-top: 4rem;">
                <h2 style="font-family: Orbitron; text-align: center; margin-bottom: 2rem; color: var(--primary);">How It Works</h2>
                <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                    <div class="tournament-card" style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
                        <h3>1. Register</h3>
                        <p style="color: var(--gray);">Create your account and set your eFootball ID</p>
                    </div>
                    <div class="tournament-card" style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">💰</div>
                        <h3>2. Pay Entry Fee</h3>
                        <p style="color: var(--gray);">Send M-Pesa to admin and upload proof</p>
                    </div>
                    <div class="tournament-card" style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">⚽</div>
                        <h3>3. Play & Win</h3>
                        <p style="color: var(--gray);">Compete in matches and submit results</p>
                    </div>
                    <div class="tournament-card" style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🏆</div>
                        <h3>4. Collect Prizes</h3>
                        <p style="color: var(--gray);">Winners receive M-Pesa prize money</p>
                    </div>
                </div>
            </section>
        `;
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
                        <a href="#" onclick="Router.navigate('forgot')" style="color: var(--primary); font-size: 0.9rem;">Forgot password?</a>
                    </p>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Login</button>
                </form>
                <p style="text-align: center; margin-top: 1.5rem; color: var(--gray);">
                    Don't have an account? <a href="#" onclick="Router.navigate('register')" style="color: var(--primary);">Register</a>
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
                <p style="color: var(--gray); margin-bottom: 1rem; text-align: center;">
                    Enter your account email and we will generate a reset link.
                </p>
                <form id="forgotPasswordForm">
                    ${UI.createFormGroup('Email', 'email', 'email', 'your@email.com')}
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Generate Reset Link</button>
                </form>
                <p style="text-align: center; margin-top: 1.5rem; color: var(--gray);">
                    Remembered your password? <a href="#" onclick="Router.navigate('login')" style="color: var(--primary);">Login</a>
                </p>
                <div id="resetLinkContainer" style="display: none; margin-top: 1rem; padding: 0.8rem; background: var(--dark); border-radius: 10px;">
                    <small style="color: var(--gray);">Reset link:</small>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <input id="resetLinkField" readonly style="width: 100%; padding: 0.6rem; background: var(--glass); border: 1px solid var(--glass-border); color: var(--light); border-radius: 6px;">
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
                UI.showToast(result.message || 'Reset link generated', 'success');
                if (result.resetLink) {
                    document.getElementById('resetLinkField').value = result.resetLink;
                    document.getElementById('resetLinkContainer').style.display = 'block';
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
                <p style="text-align: center; margin-top: 1.5rem; color: var(--gray);">
                    Back to <a href="#" onclick="Router.navigate('login')" style="color: var(--primary);">Login</a>
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
                <p style="text-align: center; margin-top: 1.5rem; color: var(--gray);">
                    Already have an account? <a href="#" onclick="Router.navigate('login')" style="color: var(--primary);">Login</a>
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
                <h2 style="font-family: Orbitron; color: var(--primary); margin-bottom: 1rem;">Active Tournaments</h2>
                <div class="card-grid">
                    ${tournaments.length ? tournaments.map(t => UI.renderTournamentCard(t)).join('') : 
                    '<div class="empty-state"><p>No tournaments available</p></div>'}
                </div>
            `;
        } catch (error) {
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading tournaments</p></div>`;
        }
    },

    // UPDATED: Tournament Detail with Format Support
    async tournamentDetail(id) {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = '<div class="spinner"></div>';

        try {
            const tournament = await API.getTournament(id);
            const isRegistered = tournament.registeredPlayers?.some(
                p => p.user?._id === Auth.getUser()?._id
            );

            // Check if round-based format
            const isRoundBased = ['round_robin', 'league', 'swiss'].includes(tournament.format);
            const formatInfo = this.TOURNAMENT_FORMATS[tournament.format] || this.TOURNAMENT_FORMATS.single_elimination;
            
            mainContent.innerHTML = `
                <div class="tournament-detail-header">
                    <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h1 style="font-family: Orbitron; color: var(--primary);">${tournament.name}</h1>
                            <p style="color: var(--gray); margin-top: 0.5rem;">
                                ${tournament.description || ''}
                                <span class="format-badge" style="background: var(--glass); padding: 0.25rem 0.75rem; border-radius: 20px; margin-left: 0.5rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                                    <span>${formatInfo.icon}</span>
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
                            <a href="${tournament.whatsappLink}" target="_blank" class="whatsapp-btn">
                                📱 Join Tournament WhatsApp Group
                            </a>
                        </div>
                    ` : ''}
                </div>

                <div class="tournament-tabs">
                    <button class="tab-btn active" onclick="Pages.switchTab('${isRoundBased ? 'standings' : 'bracket'}')">
                        ${isRoundBased ? '📊 Standings' : '🏆 Bracket'}
                    </button>
                    <button class="tab-btn" onclick="Pages.switchTab('players')">👥 Players</button>
                    <button class="tab-btn" onclick="Pages.switchTab('matches')">⚽ Matches</button>
                </div>

                <div id="tab-${isRoundBased ? 'standings' : 'bracket'}" class="tab-content active">
                    ${isRoundBased ? this.renderStandings(tournament) : await this.renderBracket(id)}
                </div>
                <div id="tab-players" class="tab-content">
                    ${this.renderPlayersList(tournament.registeredPlayers)}
                </div>
                <div id="tab-matches" class="tab-content">
                    ${await this.renderMatches(id, tournament.format)}
                </div>
            `;
        } catch (error) {
            mainContent.innerHTML = `<div class="empty-state"><p>Tournament not found</p></div>`;
        }
    },

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
    },

    // NEW: Render Standings for Round-Based Formats
    renderStandings(tournament) {
        if (!tournament.standings || tournament.standings.length === 0) {
            return `
                <div class="empty-state">
                    <p>Standings will appear once matches are played</p>
                    ${tournament.status === 'ongoing' ? '<p style="color: var(--gray); font-size: 0.9rem; margin-top: 0.5rem;">Matches are in progress...</p>' : ''}
                </div>
            `;
        }

        return `
            <div class="standings-container" style="background: var(--glass); border-radius: 12px; overflow: hidden; margin-top: 1rem;">
                <table class="standings-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05);">
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem;">#</th>
                            <th style="padding: 1rem; text-align: left; font-family: Orbitron; font-size: 0.85rem;">Player</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem;">P</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem;">W</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem;">D</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem;">L</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem;">GF</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem;">GA</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem;">GD</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--accent);">PTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tournament.standings.map((s, i) => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${i < 3 ? `background: ${i === 0 ? 'rgba(255,215,0,0.1)' : i === 1 ? 'rgba(192,192,192,0.1)' : 'rgba(205,127,50,0.1)'};` : ''} ${s.player?._id === Auth.getUser()?._id ? 'background: rgba(76,175,80,0.15) !important; border-left: 3px solid var(--primary);' : ''}">
                                <td style="padding: 0.75rem; text-align: center; font-weight: bold; font-family: Orbitron;">${s.rank}</td>
                                <td style="padding: 0.75rem;">
                                    <strong>${s.player?.username || 'Unknown'}</strong>
                                    ${s.player?.teamName ? `<br><small style="color: var(--gray);">${s.player.teamName}</small>` : ''}
                                    ${s.player?._id === Auth.getUser()?._id ? '<span style="color: var(--primary); font-size: 0.8rem; margin-left: 0.5rem;">(You)</span>' : ''}
                                </td>
                                <td style="padding: 0.75rem; text-align: center;">${s.played}</td>
                                <td style="padding: 0.75rem; text-align: center; color: var(--success); font-weight: 500;">${s.wins}</td>
                                <td style="padding: 0.75rem; text-align: center;">${s.draws}</td>
                                <td style="padding: 0.75rem; text-align: center; color: var(--danger);">${s.losses}</td>
                                <td style="padding: 0.75rem; text-align: center;">${s.goalsFor}</td>
                                <td style="padding: 0.75rem; text-align: center;">${s.goalsAgainst}</td>
                                <td style="padding: 0.75rem; text-align: center; ${s.goalDifference > 0 ? 'color: var(--success);' : s.goalDifference < 0 ? 'color: var(--danger);' : ''}; font-weight: 500;">
                                    ${s.goalDifference > 0 ? '+' : ''}${s.goalDifference}
                                </td>
                                <td style="padding: 0.75rem; text-align: center; font-size: 1.1rem; font-weight: bold; color: var(--accent); font-family: Orbitron;">
                                    ${s.points}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // FIXED: Updated renderBracket to handle API response structure
    async renderBracket(tournamentId) {
        if (!Auth.isAuthenticated()) {
            return '<div class="empty-state"><p>Login to view bracket</p></div>';
        }

        try {
            const data = await API.getTournamentBracket(tournamentId);
            
            // Handle API response structure (object with rounds array)
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
                                        <span class="player-name">${match.player1?.username || 'TBD'}</span>
                                        <span class="player-score">${match.score1 ?? '-'}</span>
                                    </div>
                                    <div class="player ${match.winner?._id === match.player2?._id ? 'winner' : ''} ${!match.player2 ? 'tbd' : ''}">
                                        <span class="player-name">${match.player2?.username || 'TBD'}</span>
                                        <span class="player-score">${match.score2 ?? '-'}</span>
                                    </div>
                                    ${match.status === 'completed' ? '<div class="match-status">✓</div>' : ''}
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
                                <td>${p.paid ? '✅ Paid' : '⏳ Pending'}</td>
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
            
            // Filter out matches that don't have any players yet (future bracket matches)
            matches = matches.filter(match => match.player1 !== null || match.player2 !== null);
            
            if (matches.length === 0) {
                return '<div class="empty-state"><p>No active matches yet. Tournament may still be in registration phase.</p></div>';
            }

            const isRoundBased = ['round_robin', 'league', 'swiss'].includes(format);

            return `
                <div class="matches-list">
                    ${matches.map((match, idx) => {
                        // Handle populated player data
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
                            <div class="match-card ${status} ${isMyMatch ? 'my-match' : ''}" style="background: var(--glass); padding: 1rem; border-radius: 10px; margin-bottom: 1rem; ${isMyMatch ? 'border: 2px solid var(--primary);' : ''}">
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 4px; text-transform: uppercase; background: ${status === 'completed' ? 'var(--success)' : status === 'ongoing' ? 'var(--warning)' : 'var(--gray)'};">
                                                ${status}
                                            </span>
                                            ${isRoundBased ? `<span style="font-size: 0.75rem; color: var(--gray);">Round ${round}</span>` : ''}
                                            ${match.matchNumber ? `<span style="font-size: 0.75rem; color: var(--gray);">#${match.matchNumber}</span>` : ''}
                                            ${isMyMatch ? '<span style="font-size: 0.75rem; color: var(--primary); font-weight: bold;">YOUR MATCH</span>' : ''}
                                        </div>
                                        
                                        <div style="display: flex; align-items: center; gap: 0.75rem; font-family: Orbitron; flex-wrap: wrap;">
                                            <span style="font-size: 1rem; ${winner?._id === player1?._id ? 'color: var(--success); font-weight: bold;' : winner && winner._id !== player1?._id ? 'opacity: 0.6;' : ''}">
                                                ${p1Name}
                                            </span>
                                            
                                            <span style="font-size: 1.1rem; color: var(--accent); font-weight: bold;">
                                                ${status === 'completed' ? `${match.score1 ?? 0} - ${match.score2 ?? 0}` : 'VS'}
                                            </span>
                                            
                                            <span style="font-size: 1rem; ${winner?._id === player2?._id ? 'color: var(--success); font-weight: bold;' : winner && winner._id !== player2?._id ? 'opacity: 0.6;' : ''}">
                                                ${p2Name}
                                            </span>
                                        </div>
                                        
                                        ${winnerName ? `
                                            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--success);">
                                                ✅ Winner: ${winnerName}
                                            </div>
                                        ` : status === 'completed' && !winner ? `
                                            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--warning);">
                                                ⚠️ Awaiting verification
                                            </div>
                                        ` : ''}
                                    </div>
                                    
                                    ${isMyMatch && status === 'scheduled' && player1 && player2 ? `
                                        <button class="btn btn-primary" style="white-space: nowrap;" onclick="UI.showSubmitResultModal('${match._id}', '${tournamentId}', '${p1Name}', '${p2Name}')">
                                            Submit Result
                                        </button>
                                    ` : ''}
                                </div>
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
                            <li><a href="#" class="active" onclick="Router.navigate('dashboard')">Overview</a></li>
                            <li><a href="#" onclick="Router.navigate('profile')">My Profile</a></li>
                            <li><a href="#" onclick="Router.navigate('tournaments')">Browse Tournaments</a></li>
                        </ul>
                    </aside>

                    <div class="dashboard-content">
                        <h2 style="font-family: Orbitron; color: var(--primary); margin-bottom: 1.5rem;">Dashboard</h2>
                        
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

                        <h3 style="font-family: Orbitron; color: var(--primary); margin: 2rem 0 1rem;">My Tournaments</h3>
                        ${tournaments?.length ? `
                            <div class="card-grid">
                                ${tournaments.map(t => UI.renderTournamentCard(t)).join('')}
                            </div>
                        ` : '<p style="color: var(--gray);">You haven\'t joined any tournaments yet.</p>'}

                        <h3 style="font-family: Orbitron; color: var(--primary); margin: 2rem 0 1rem;">Upcoming Matches</h3>
                        ${safeUpcoming.length ? safeUpcoming.map(m => `
                            <div class="tournament-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <h4>vs ${m.opponent?.username || 'Unknown'}</h4>
                                        <p style="color: var(--gray);">${m.tournament?.name || 'Unknown Tournament'}</p>
                                    </div>
                                   <button class="btn btn-primary" onclick="UI.showSubmitResultModal('${m._id}', '${m.tournament?._id}', '${m.player?.username || 'You'}', '${m.opponent?.username || 'Opponent'}')">Submit Result</button>
                                </div>
                                <div style="margin-top: 1rem; padding: 1rem; background: var(--dark); border-radius: 10px;">
                                    <p style="margin-bottom: 0.5rem;"><strong>Opponent eFootball ID:</strong></p>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <code style="background: var(--glass); padding: 0.5rem 1rem; border-radius: 5px; font-family: Orbitron;">${m.opponent?.efootballId || 'N/A'}</code>
                                        <button class="copy-btn" onclick="navigator.clipboard.writeText('${m.opponent?.efootballId || ''}')">Copy</button>
                                    </div>
                                </div>
                            </div>
                        `).join('') : '<p style="color: var(--gray);">No upcoming matches.</p>'}
                    </div>
                </div>
            `;
        } catch (error) {  
            console.error('❌ Dashboard error details:', error);
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading dashboard: ${error.message}</p></div>`;
        }
    },

    async leaderboard() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = '<div class="spinner"></div>';

        try {
            const players = await API.getLeaderboard();
            mainContent.innerHTML = `
                <h2 style="font-family: Orbitron; color: var(--primary); margin-bottom: 2rem;">🏆 Global Leaderboard</h2>
                <div class="leaderboard-table">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: rgba(255,255,255,0.05);">
                                <th style="padding: 1rem; text-align: center; font-family: Orbitron; color: var(--gray);">Rank</th>
                                <th style="padding: 1rem; text-align: left; font-family: Orbitron; color: var(--gray);">Player</th>
                                <th style="padding: 1rem; text-align: center; font-family: Orbitron; color: var(--gray);">Played</th>
                                <th style="padding: 1rem; text-align: center; font-family: Orbitron; color: var(--gray);">W</th>
                                <th style="padding: 1rem; text-align: center; font-family: Orbitron; color: var(--gray);">L</th>
                                <th style="padding: 1rem; text-align: center; font-family: Orbitron; color: var(--gray);">Win%</th>
                                <th style="padding: 1rem; text-align: center; font-family: Orbitron; color: var(--gray);">GF</th>
                                <th style="padding: 1rem; text-align: center; font-family: Orbitron; color: var(--gray);">GA</th>
                                <th style="padding: 1rem; text-align: center; font-family: Orbitron; color: var(--accent);">Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${players.map((p, idx) => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${idx < 3 ? `background: ${idx === 0 ? 'rgba(255,215,0,0.1)' : idx === 1 ? 'rgba(192,192,192,0.1)' : 'rgba(205,127,50,0.1)'};` : ''} ${p._id === Auth.getUser()?._id ? 'background: rgba(76,175,80,0.15) !important;' : ''}">
                                    <td style="padding: 0.75rem; text-align: center; font-weight: bold; font-family: Orbitron; font-size: 1.1rem; color: ${idx < 3 ? 'var(--accent)' : 'var(--light)'};">
                                        ${idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : p.rank}
                                    </td>
                                    <td style="padding: 0.75rem;">
                                        <strong style="color: var(--light); font-size: 1.05rem;">${p.username}</strong>
                                        ${p.teamName ? `<br><small style="color: var(--gray);">${p.teamName}</small>` : ''}
                                        ${p.efootballId ? `<br><small style="color: var(--primary); font-family: Orbitron;">ID: ${p.efootballId}</small>` : ''}
                                        ${p._id === Auth.getUser()?._id ? '<span style="color: var(--primary); font-size: 0.8rem; margin-left: 0.5rem;">(You)</span>' : ''}
                                    </td>
                                    <td style="padding: 0.75rem; text-align: center; color: var(--light);">${p.played}</td>
                                    <td style="padding: 0.75rem; text-align: center; color: var(--success); font-weight: 500;">${p.wins}</td>
                                    <td style="padding: 0.75rem; text-align: center; color: var(--danger);">${p.losses}</td>
                                    <td style="padding: 0.75rem; text-align: center; color: var(--light); font-weight: 500;">${p.winRate}%</td>
                                    <td style="padding: 0.75rem; text-align: center; color: var(--light);">${p.goalsFor}</td>
                                    <td style="padding: 0.75rem; text-align: center; color: var(--light);">${p.goalsAgainst}</td>
                                    <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; font-weight: bold; color: var(--accent); font-family: Orbitron;">
                                        ${p.points}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="color: var(--gray); text-align: center; margin-top: 1rem; font-size: 0.9rem;">
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
                            <li><a href="#" class="active">Dashboard</a></li>
                            <li><a href="#" onclick="Pages.showCreateTournamentModal()">Create Tournament</a></li>
                            <li><a href="#" onclick="Router.navigate('tournaments')">All Tournaments</a></li>
                        </ul>
                    </aside>

                    <div class="dashboard-content">
                        <h2 style="font-family: Orbitron; color: var(--primary); margin-bottom: 1.5rem;">
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

                        <h3 style="font-family: Orbitron; color: var(--primary); margin: 2rem 0 1rem;">
                            💰 Payment Verifications (${pendingPayments?.length || 0})
                        </h3>
                        ${pendingPayments?.length ? `
                            <div class="pending-payments">
                                ${pendingPayments.map(p => `
                                    <div class="payment-item" style="background: var(--glass); padding: 1rem; border-radius: 10px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display: flex; gap: 1rem; align-items: center;">
                                            <img src="${p.screenshotPath}" alt="Proof" class="payment-proof-img" style="width: 60px; height: 60px; object-fit: cover; border-radius: 5px; cursor: pointer;" onclick="window.open('${p.screenshotPath}', '_blank')">
                                            <div>
                                                <strong>${p.user?.username || 'Unknown'}</strong>
                                                <p style="color: var(--gray); font-size: 0.9rem; margin: 0;">
                                                    ${p.tournament?.name || 'Unknown Tournament'}<br>
                                                    ${UI.formatCurrency(p.amount)} | ${p.mpesaNumber}
                                                </p>
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <button class="btn btn-success" onclick="Pages.verifyPayment('${p._id}', 'approve')">✓ Approve</button>
                                            <button class="btn btn-danger" onclick="Pages.verifyPayment('${p._id}', 'reject')">✗ Reject</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p style="color: var(--gray);">No pending payments.</p>'}

                        <h3 style="font-family: Orbitron; color: var(--primary); margin: 2rem 0 1rem;">
                            ⚽ Match Verifications (${pendingResults?.length || 0})
                        </h3>
                        ${pendingResults?.length ? `
                            <div class="pending-results">
                                ${pendingResults.map(r => `
                                    <div class="result-item" style="background: var(--glass); padding: 1rem; border-radius: 10px; margin-bottom: 1rem; border-left: 4px solid ${r.status === 'disputed' ? 'var(--danger)' : 'var(--warning)'};">
                                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                            <div>
                                                <strong>${r.tournament?.name || 'Unknown Tournament'}</strong>
                                                <p style="color: var(--gray); font-size: 0.9rem; margin: 0.25rem 0;">
                                                    Round ${r.round || '-'} | ${r.status === 'disputed' ? '🔥 DISPUTED' : '⏳ Waiting for opponent'}
                                                </p>
                                            </div>
                                            <span style="font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: ${r.status === 'disputed' ? 'var(--danger)' : 'var(--warning)'};">
                                                ${r.status === 'disputed' ? 'Disputed' : 'Pending'}
                                            </span>
                                        </div>
                                        
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                            <div style="padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; ${r.player1?.submitted ? 'border: 1px solid var(--success)' : 'opacity: 0.6'};">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                    <strong>${r.player1?.user?.username || 'Player 1'}</strong>
                                                    ${r.player1?.submitted ? '<span style="color: var(--success);">✓</span>' : '<span style="color: var(--gray);">⏳</span>'}
                                                </div>
                                                ${r.player1?.submitted ? `
                                                    <div style="font-family: Orbitron; font-size: 1.1rem;">
                                                        ${r.player1?.submission?.score1} - ${r.player1?.submission?.score2}
                                                    </div>
                                                    <div style="color: var(--gray); font-size: 0.8rem; margin-top: 0.25rem;">
                                                        Winner: ${r.player1?.submission?.winner === 'player1' ? r.player1?.user?.username : r.player2?.user?.username}
                                                    </div>
                                                ` : '<span style="color: var(--gray);">Not submitted</span>'}
                                            </div>

                                            <div style="padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; ${r.player2?.submitted ? 'border: 1px solid var(--success)' : 'opacity: 0.6'};">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                    <strong>${r.player2?.user?.username || 'Player 2'}</strong>
                                                    ${r.player2?.submitted ? '<span style="color: var(--success);">✓</span>' : '<span style="color: var(--gray);">⏳</span>'}
                                                </div>
                                                ${r.player2?.submitted ? `
                                                    <div style="font-family: Orbitron; font-size: 1.1rem;">
                                                        ${r.player2?.submission?.score1} - ${r.player2?.submission?.score2}
                                                    </div>
                                                    <div style="color: var(--gray); font-size: 0.8rem; margin-top: 0.25rem;">
                                                        Winner: ${r.player2?.submission?.winner === 'player1' ? r.player1?.user?.username : r.player2?.user?.username}
                                                    </div>
                                                ` : '<span style="color: var(--gray);">Not submitted</span>'}
                                            </div>
                                        </div>

                                        ${r.status === 'disputed' ? `
                                            <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,0,0,0.1); border-radius: 8px;">
                                                <p style="color: var(--danger); margin-bottom: 0.75rem; font-weight: bold;">⚠️ Results do not match!</p>
                                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                                    <button class="btn btn-success" onclick="Pages.resolveMatch('${r.matchId}', 'player1_correct')">
                                                        ✓ ${r.player1?.user?.username} Correct
                                                    </button>
                                                    <button class="btn btn-success" onclick="Pages.resolveMatch('${r.matchId}', 'player2_correct')">
                                                        ✓ ${r.player2?.user?.username} Correct
                                                    </button>
                                                    <button class="btn btn-warning" onclick="Pages.showCustomResolveModal('${r.matchId}', '${r.player1?.user?.username}', '${r.player2?.user?.username}')">
                                                        ⚖️ Custom
                                                    </button>
                                                </div>
                                            </div>
                                        ` : `
                                            <p style="color: var(--gray); font-size: 0.9rem; margin-top: 0.5rem;">
                                                ${r.disputeReason}
                                            </p>
                                        `}
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p style="color: var(--gray);">No matches need verification.</p>'}
                    </div>
                </div>
            `;
        } catch (error) {
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading admin panel</p></div>`;
        }
    },

    // NEW: Create Tournament with Format Selection
    showCreateTournamentModal() {
        const content = `
            <div class="modal-header">
                <h3>Create New Tournament</h3>
                <button class="close-btn" onclick="UI.closeModal()">×</button>
            </div>
            <form id="createTournamentForm" style="padding: 1.5rem;">
                ${UI.createFormGroup('Tournament Name', 'text', 'name', 'eFootball Championship')}
                ${UI.createFormGroup('Description', 'text', 'description', 'Brief description')}
                
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Tournament Format</label>
                    <select id="formatSelect" name="format" onchange="Pages.updateFormatSettings()" style="width: 100%; padding: 0.75rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px; font-size: 1rem;">
                        <option value="single_elimination">⚔️ Single Elimination - Lose once = out</option>
                        <option value="double_elimination">🛡️ Double Elimination - Two lives</option>
                        <option value="round_robin">🔄 Round Robin - Everyone plays everyone</option>
                        <option value="swiss">🇨🇭 Swiss System - Chess style</option>
                        <option value="league">🏆 League - Season long</option>
                    </select>
                    <p id="formatDescription" style="color: var(--gray); font-size: 0.9rem; margin-top: 0.5rem;">
                        Fast tournament. Players eliminated after one loss.
                    </p>
                </div>

                <div id="dynamicSettings" style="margin: 1rem 0; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <!-- Dynamic settings loaded here -->
                </div>

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
        Pages.updateFormatSettings(); // Initialize settings

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
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Games per Match</label>
                        <select id="bestOf" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                            <option value="1">1 game (Bo1)</option>
                            <option value="3">3 games (Bo3)</option>
                            <option value="5">5 games (Bo5)</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0; display: flex; align-items: center; padding-top: 1.5rem;">
                        <label style="display: flex; align-items: center; cursor: pointer; font-size: 0.9rem;">
                            <input type="checkbox" id="bronzeMatch" style="margin-right: 0.5rem;">
                            3rd Place Match
                        </label>
                    </div>
                </div>
            `,
            double_elimination: `
                <div class="form-group" style="margin: 0;">
                    <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Games per Match</label>
                    <select id="bestOf" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                        <option value="1">1 game (Bo1)</option>
                        <option value="3">3 games (Bo3)</option>
                        <option value="5">5 games (Bo5)</option>
                    </select>
                </div>
            `,
            round_robin: `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Times Each Pair Plays</label>
                        <input type="number" id="rounds" min="1" max="4" value="1" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Points for Win</label>
                        <input type="number" id="pointsWin" value="3" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Points for Draw</label>
                        <input type="number" id="pointsDraw" value="1" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Points for Loss</label>
                        <input type="number" id="pointsLoss" value="0" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                    </div>
                </div>
            `,
            swiss: `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Number of Rounds</label>
                        <input type="number" id="swissRounds" min="3" max="12" value="5" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                        <small style="color: var(--gray); font-size: 0.8rem;">Recommended: log₂(players) + 1</small>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Points for Win</label>
                        <input type="number" id="pointsWin" value="3" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                    </div>
                </div>
            `,
            league: `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Times Each Pair Plays</label>
                        <input type="number" id="rounds" min="1" max="4" value="2" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                        <small style="color: var(--gray); font-size: 0.8rem;">Home & Away = 2</small>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Points for Win</label>
                        <input type="number" id="pointsWin" value="3" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
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
                <button class="close-btn" onclick="UI.closeModal()">×</button>
            </div>
            <form id="resolveForm" style="padding: 1.5rem;">
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label>${p1} Score</label>
                        <input type="number" name="score1" min="0" required style="text-align: center; font-size: 1.2rem;">
                    </div>
                    <span style="font-size: 1.5rem;">-</span>
                    <div class="form-group" style="margin: 0;">
                        <label>${p2} Score</label>
                        <input type="number" name="score2" min="0" required style="text-align: center; font-size: 1.2rem;">
                    </div>
                </div>
                
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Winner</label>
                    <select name="winner" required style="width: 100%;">
                        <option value="">Select Winner</option>
                        <option value="player1">${p1}</option>
                        <option value="player2">${p2}</option>
                    </select>
                </div>
                
                <div class="form-group" style="margin-bottom: 1.5rem;">
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

    async verifyPayment(paymentId, action) {
        try {
            UI.showLoading();
            await API.verifyPayment(paymentId, action);
            UI.showToast(`Payment ${action}d successfully`, 'success');
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

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.getElementById('navLinks').classList.toggle('active');
    });

    await Auth.init();
    const pageFromQuery = new URLSearchParams(window.location.search).get('page');
    if (pageFromQuery && Router.routes[pageFromQuery]) {
        Router.navigate(pageFromQuery);
    } else {
        Router.navigate('home');
    }
});