const Router = {
    currentPage: 'home',

    routes: {
        home: () => Pages.home(),
        login: () => Pages.login(),
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
    home() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <section class="hero">
                <h1>COMPETE. WIN. EARN.</h1>
                <p>Join the ultimate eFootball tournament platform. Compete against the best players in Kenya, win cash prizes, and climb the leaderboard.</p>
                <div class="cta-buttons">
                    <button class="btn btn-primary" onclick="Router.navigate('tournaments')">Browse Tournaments</button>
                    ${!Auth.isAuthenticated() ? `<button class="btn btn-secondary" onclick="Router.navigate('register')">Create Account</button>` : ''}
                </div>
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

    async tournamentDetail(id) {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = '<div class="spinner"></div>';

        try {
            const tournament = await API.getTournament(id);
            const isRegistered = tournament.registeredPlayers?.some(
                p => p.user?._id === Auth.getUser()?._id
            );

            mainContent.innerHTML = `
                <div class="tournament-detail-header">
                    <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h1 style="font-family: Orbitron; color: var(--primary);">${tournament.name}</h1>
                            <p style="color: var(--gray); margin-top: 0.5rem;">${tournament.description || ''}</p>
                        </div>
                        <span class="tournament-status status-${tournament.status}">${tournament.status}</span>
                    </div>
                    
                    <div class="stats-grid" style="margin-top: 1.5rem;">
                        <div class="stat-card">
                            <div class="stat-value">${UI.formatCurrency(tournament.prizePool || tournament.entryFee * 0.8)}</div>
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
                    <button class="tab-btn active" onclick="Pages.switchTab('bracket')">Bracket</button>
                    <button class="tab-btn" onclick="Pages.switchTab('players')">Players</button>
                    <button class="tab-btn" onclick="Pages.switchTab('matches')">Matches</button>
                </div>

                <div id="tab-bracket" class="tab-content active">
                    ${await this.renderBracket(id)}
                </div>
                <div id="tab-players" class="tab-content">
                    ${this.renderPlayersList(tournament.registeredPlayers)}
                </div>
                <div id="tab-matches" class="tab-content">
                    ${await this.renderMatches(id)}
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

    async renderBracket(tournamentId) {
        if (!Auth.isAuthenticated()) {
            return '<div class="empty-state"><p>Login to view bracket</p></div>';
        }

        try {
            const bracket = await API.getTournamentBracket(tournamentId);
            if (!bracket || bracket.length === 0) {
                return '<div class="empty-state"><p>Bracket not generated yet</p></div>';
            }

            return `
                <div class="bracket">
                    ${bracket.map((round, idx) => `
                        <div class="round">
                            <h4 class="round-title">Round ${idx + 1}</h4>
                            ${round.matches.map(match => `
                                <div class="match">
                                    <div class="player ${match.winner?._id === match.player1?._id ? 'winner' : ''}">
                                        <span class="player-name">${match.player1?.username || 'TBD'}</span>
                                        <span class="player-score">${match.score1 ?? '-'}</span>
                                    </div>
                                    <div class="player ${match.winner?._id === match.player2?._id ? 'winner' : ''}">
                                        <span class="player-name">${match.player2?.username || 'TBD'}</span>
                                        <span class="player-score">${match.score2 ?? '-'}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            return '<div class="empty-state"><p>Unable to load bracket</p></div>';
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
                                <td>${p.user.username}</td>
                                <td>${p.user.teamName || '-'}</td>
                                <td>${p.paid ? '✅ Paid' : '⏳ Pending'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async renderMatches(tournamentId) {
        return '<div class="empty-state"><p>Matches will appear here once the tournament starts</p></div>';
    },

    async dashboard() {
        const mainContent = document.getElementById('mainContent');
        
        try {
            const [stats, tournaments, upcoming] = await Promise.all([
                API.getUserStats(),
                API.getUserTournaments(),
                API.getUpcomingMatches()
            ]);

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
                                <div class="stat-value">${stats.points || 0}</div>
                                <div class="stat-label">Points</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats.wins || 0}</div>
                                <div class="stat-label">Wins</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats.losses || 0}</div>
                                <div class="stat-label">Losses</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${((stats.wins || 0) + (stats.losses || 0)) > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%</div>
                                <div class="stat-label">Win Rate</div>
                            </div>
                        </div>

                        <h3 style="font-family: Orbitron; color: var(--primary); margin: 2rem 0 1rem;">My Tournaments</h3>
                        ${tournaments.length ? `
                            <div class="card-grid">
                                ${tournaments.map(t => UI.renderTournamentCard(t)).join('')}
                            </div>
                        ` : '<p style="color: var(--gray);">You haven\'t joined any tournaments yet.</p>'}

                        <h3 style="font-family: Orbitron; color: var(--primary); margin: 2rem 0 1rem;">Upcoming Matches</h3>
                        ${upcoming.length ? upcoming.map(m => `
                            <div class="tournament-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <h4>vs ${m.opponent.username}</h4>
                                        <p style="color: var(--gray);">${m.tournament.name}</p>
                                    </div>
                                    <button class="btn btn-primary" onclick="UI.showSubmitResultModal('${m._id}', '${m.player?.username || 'You'}', '${m.opponent?.username || 'Opponent'}')">Submit Result</button>
                                </div>
                                <div style="margin-top: 1rem; padding: 1rem; background: var(--dark); border-radius: 10px;">
                                    <p style="margin-bottom: 0.5rem;"><strong>Opponent eFootball ID:</strong></p>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <code style="background: var(--glass); padding: 0.5rem 1rem; border-radius: 5px; font-family: Orbitron;">${m.opponent.efootballId}</code>
                                        <button class="copy-btn" onclick="navigator.clipboard.writeText('${m.opponent.efootballId}')">Copy</button>
                                    </div>
                                </div>
                            </div>
                        `).join('') : '<p style="color: var(--gray);">No upcoming matches.</p>'}
                    </div>
                </div>
            `;
        } catch (error) {  
            console.error('❌ Dashboard error details:', error);
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading dashboard</p></div>`;
        }
    },

    async leaderboard() {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = '<div class="spinner"></div>';

        try {
            const players = await API.getLeaderboard();
            mainContent.innerHTML = `
                <h2 style="font-family: Orbitron; color: var(--primary); margin-bottom: 2rem;">Global Leaderboard</h2>
                <div class="leaderboard-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Team</th>
                                <th>Points</th>
                                <th>Wins</th>
                                <th>Losses</th>
                                <th>Win Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${players.map((p, idx) => `
                                <tr>
                                    <td class="rank rank-${idx < 3 ? idx + 1 : ''}">#${idx + 1}</td>
                                    <td>
                                        <strong>${p.username}</strong>
                                        ${p.efootballId ? `<br><small style="color: var(--gray);">ID: ${p.efootballId}</small>` : ''}
                                    </td>
                                    <td>${p.teamName || '-'}</td>
                                    <td style="color: var(--accent); font-weight: bold;">${p.points || 0}</td>
                                    <td style="color: var(--success);">${p.wins || 0}</td>
                                    <td style="color: var(--danger);">${p.losses || 0}</td>
                                    <td>${p.wins + p.losses > 0 ? Math.round((p.wins / (p.wins + p.losses)) * 100) : 0}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            mainContent.innerHTML = `<div class="empty-state"><p>Error loading leaderboard</p></div>`;
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
                                            <div style="padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; ${r.player1.submitted ? 'border: 1px solid var(--success)' : 'opacity: 0.6'};">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                    <strong>${r.player1.user?.username || 'Player 1'}</strong>
                                                    ${r.player1.submitted ? '<span style="color: var(--success);">✓</span>' : '<span style="color: var(--gray);">⏳</span>'}
                                                </div>
                                                ${r.player1.submitted ? `
                                                    <div style="font-family: Orbitron; font-size: 1.1rem;">
                                                        ${r.player1.submission.score1} - ${r.player1.submission.score2}
                                                    </div>
                                                    <div style="color: var(--gray); font-size: 0.8rem; margin-top: 0.25rem;">
                                                        Winner: ${r.player1.submission.winner === 'player1' ? r.player1.user?.username : r.player2.user?.username}
                                                    </div>
                                                ` : '<span style="color: var(--gray);">Not submitted</span>'}
                                            </div>

                                            <div style="padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; ${r.player2.submitted ? 'border: 1px solid var(--success)' : 'opacity: 0.6'};">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                    <strong>${r.player2.user?.username || 'Player 2'}</strong>
                                                    ${r.player2.submitted ? '<span style="color: var(--success);">✓</span>' : '<span style="color: var(--gray);">⏳</span>'}
                                                </div>
                                                ${r.player2.submitted ? `
                                                    <div style="font-family: Orbitron; font-size: 1.1rem;">
                                                        ${r.player2.submission.score1} - ${r.player2.submission.score2}
                                                    </div>
                                                    <div style="color: var(--gray); font-size: 0.8rem; margin-top: 0.25rem;">
                                                        Winner: ${r.player2.submission.winner === 'player1' ? r.player1.user?.username : r.player2.user?.username}
                                                    </div>
                                                ` : '<span style="color: var(--gray);">Not submitted</span>'}
                                            </div>
                                        </div>

                                        ${r.status === 'disputed' ? `
                                            <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,0,0,0.1); border-radius: 8px;">
                                                <p style="color: var(--danger); margin-bottom: 0.75rem; font-weight: bold;">⚠️ Results do not match!</p>
                                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                                    <button class="btn btn-success" onclick="Pages.resolveMatch('${r.matchId}', 'player1_correct')">
                                                        ✓ ${r.player1.user?.username} Correct
                                                    </button>
                                                    <button class="btn btn-success" onclick="Pages.resolveMatch('${r.matchId}', 'player2_correct')">
                                                        ✓ ${r.player2.user?.username} Correct
                                                    </button>
                                                    <button class="btn btn-warning" onclick="Pages.showCustomResolveModal('${r.matchId}', '${r.player1.user?.username}', '${r.player2.user?.username}')">
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

    showCreateTournamentModal() {
        const content = `
            <div class="modal-header">
                <h3>Create New Tournament</h3>
                <button class="close-btn" onclick="UI.closeModal()">×</button>
            </div>
            <form id="createTournamentForm">
                ${UI.createFormGroup('Tournament Name', 'text', 'name', 'eFootball Championship')}
                ${UI.createFormGroup('Description', 'text', 'description', 'Brief description')}
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

        document.getElementById('createTournamentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                UI.showLoading();
                await API.createTournament({
                    name: formData.get('name'),
                    description: formData.get('description'),
                    entryFee: parseInt(formData.get('entryFee')),
                    maxPlayers: parseInt(formData.get('maxPlayers')),
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
            const efootballId = formData.get('efootballId');
            const phoneNumber = formData.get('phoneNumber');
            
            try {
                UI.showLoading();
                await API.updateProfile({ efootballId, phoneNumber });
                
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
    Router.navigate('home');
});