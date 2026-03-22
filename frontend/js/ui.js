const UI = {
    // Tournament Format Configuration
    TOURNAMENT_FORMATS: {
        single_elimination: {
            name: 'Single Elimination',
            icon: '⚔️',
            description: 'Lose once and you\'re out. Fast and simple.',
            recommended: '8-64 players',
            settings: ['bestOf', 'bronzeMatch', 'maxPlayers']
        },
        double_elimination: {
            name: 'Double Elimination',
            icon: '🛡️',
            description: 'Two losses to eliminate. Fairer but longer.',
            recommended: '8-32 players',
            settings: ['bestOf', 'maxPlayers']
        },
        round_robin: {
            name: 'Round Robin',
            icon: '🔄',
            description: 'Everyone plays everyone. Best for small groups.',
            recommended: '4-12 players',
            settings: ['rounds', 'pointsWin', 'pointsDraw', 'maxPlayers']
        },
        swiss: {
            name: 'Swiss System',
            icon: '🇨🇭',
            description: 'Play similar-skilled opponents. Chess/Esports standard.',
            recommended: '8-128 players',
            settings: ['swissRounds', 'pointsWin', 'pointsDraw', 'maxPlayers']
        },
        league: {
            name: 'League',
            icon: '🏆',
            description: 'Season-long competition with home/away fixtures.',
            recommended: '4-20 players',
            settings: ['rounds', 'pointsWin', 'pointsDraw', 'maxPlayers']
        }
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showModal(content) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal">
                ${content}
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        return overlay;
    },

    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    },

    createFormGroup(label, type, name, placeholder = '', required = true) {
        return `
            <div class="form-group">
                <label for="${name}">${label}</label>
                <input type="${type}" id="${name}" name="${name}" placeholder="${placeholder}" ${required ? 'required' : ''}>
            </div>
        `;
    },

    formatCurrency(amount) {
        if (amount === undefined || amount === null) return 'KES 0';
        return `KES ${amount.toLocaleString()}`;
    },

    formatDate(dateString) {
        if (!dateString) return 'TBD';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // UPDATED: Render Tournament Card with Format Support
    renderTournamentCard(tournament) {
        if (!tournament || typeof tournament !== 'object') {
            console.error('renderTournamentCard received null/invalid tournament', tournament);
            return `<div class="tournament-card error">Error loading tournament</div>`;
        }

        const currentUser = Auth.getUser();
        const isRegistered = tournament.registeredPlayers?.some(
            p => p?.user?._id === currentUser?._id
        ) || false;
        
        const playerCount = tournament.registeredPlayers?.length || 0;
        const maxPlayers = tournament.settings?.maxPlayers || tournament.maxPlayers || 32;
        const prizePool = tournament.prizePool || (maxPlayers * (tournament.entryFee || 0) * 0.8);
        
        // Get format info
        const formatKey = tournament.format || 'single_elimination';
        const formatInfo = this.TOURNAMENT_FORMATS[formatKey] || this.TOURNAMENT_FORMATS.single_elimination;

        return `
            <div class="tournament-card fade-in">
                <div class="tournament-header">
                    <div>
                        <h3 class="tournament-title">${tournament.name || 'Unnamed Tournament'}</h3>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                            <span class="format-badge" style="background: var(--glass); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                                <span>${formatInfo.icon}</span>
                                <span>${formatInfo.name}</span>
                            </span>
                            <div class="prize-pool">🏆 ${this.formatCurrency(prizePool)}</div>
                        </div>
                    </div>
                    <span class="tournament-status status-${tournament.status || 'unknown'}">${tournament.status || 'unknown'}</span>
                </div>
                <p style="color: var(--gray); margin-bottom: 1rem; font-size: 0.9rem;">${tournament.description || 'No description'}</p>
                <div class="tournament-meta">
                    <span>💰 Entry: ${this.formatCurrency(tournament.entryFee)}</span>
                    <span>👥 ${playerCount}/${maxPlayers}</span>
                    <span>📅 ${this.formatDate(tournament.startDate)}</span>
                </div>
                ${tournament.whatsappLink ? `
                    <a href="${tournament.whatsappLink}" target="_blank" class="whatsapp-btn" style="margin-bottom: 1rem; display: inline-block;">
                        📱 Join WhatsApp Group
                    </a>
                ` : ''}
                <div style="margin-top: 1rem;">
                    ${this.getTournamentActionButton(tournament, isRegistered)}
                </div>
                ${this.renderAdminButtons(tournament)}
            </div>
        `;
    },

    getTournamentActionButton(tournament, isRegistered) {
        if (!Auth.isAuthenticated()) {
            return `<button class="btn btn-primary" onclick="Router.navigate('login')">Login to Join</button>`;
        }

        if (!tournament) {
            console.error('getTournamentActionButton received null tournament');
            return `<button class="btn btn-secondary" disabled>Error</button>`;
        }

        if (isRegistered) {
            const userId = Auth.getUser()?._id;
            const player = tournament.registeredPlayers?.find(p => p?.user?._id === userId);
            
            if (!player) {
                console.warn('Player marked as registered but not found in array', { tournamentId: tournament._id, userId });
                return `<span style="color: var(--warning);">⏳ Verification Pending</span>`;
            }
            
            if (player.paid) {
                return `<button class="btn btn-success" onclick="Router.navigate('tournament/${tournament._id}')">View Details</button>`;
            } else {
                return `<span style="color: var(--warning);">⏳ Payment Pending</span>`;
            }
        }

        if (tournament.status !== 'open') {
            return `<button class="btn btn-secondary" disabled>Registration Closed</button>`;
        }

        return `<button class="btn btn-accent" onclick="UI.showJoinModal('${tournament._id}', '${tournament.name?.replace(/'/g, "\\'") || 'Tournament'}', ${tournament.entryFee || 0}, '${tournament.adminPhone || ''}')">Join Tournament</button>`;
    },

    // ADMIN BUTTONS - Start Tournament
    renderAdminButtons(tournament) {
        if (Auth.getUser()?.role !== 'admin') return '';
        
        if (!tournament) return '';
        
        // Show start button only for open tournaments
        if (tournament.status === 'open') {
            return `
                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button class="btn btn-warning" onclick="UI.startTournament('${tournament._id}')">
                        ▶️ Start Tournament & Generate Bracket
                    </button>
                </div>
            `;
        }
        
        // Show bracket view for ongoing tournaments
        if (tournament.status === 'ongoing') {
            const isRoundBased = ['round_robin', 'league', 'swiss'].includes(tournament.format);
            return `
                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button class="btn btn-primary" onclick="UI.showBracketModal('${tournament._id}', '${tournament.name?.replace(/'/g, "\\'") || 'Tournament'}')">
                        👁️ View ${isRoundBased ? 'Standings' : 'Bracket'}
                    </button>
                </div>
            `;
        }
        
        return '';
    },

    async startTournament(tournamentId) {
        if (!confirm('Start this tournament and generate bracket? This cannot be undone!')) return;
        
        try {
            UI.showLoading();
            const result = await API.startTournament(tournamentId);
            UI.showToast(`Tournament started! ${result.tournament?.matchesGenerated || 0} matches generated.`, 'success');
            Router.navigate('dashboard');
        } catch (error) {
            UI.showToast(error.message, 'error');
        } finally {
            UI.hideLoading();
        }
    },

    showJoinModal(tournamentId, name, entryFee, adminPhone) {
        const content = `
            <div class="modal-header">
                <h3>Join Tournament: ${name}</h3>
                <button class="close-btn" onclick="UI.closeModal()">×</button>
            </div>
            <div class="payment-steps">
                <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Send M-Pesa Payment</h4>
                        <p>Entry Fee: <strong style="color: var(--accent);">${this.formatCurrency(entryFee)}</strong></p>
                        <div class="admin-phone">${adminPhone}</div>
                        <p style="font-size: 0.9rem; color: var(--gray);">
                            Go to M-Pesa → Send Money → Enter number above
                        </p>
                    </div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Upload Proof</h4>
                        <form id="paymentForm" enctype="multipart/form-data">
                            <input type="hidden" name="tournamentId" value="${tournamentId}">
                            <div class="form-group">
                                <label>Your M-Pesa Number</label>
                                <input type="tel" name="mpesaNumber" placeholder="2547XXXXXXXX" required pattern="2547[0-9]{8}">
                            </div>
                            <div class="form-group">
                                <label>Transaction Code</label>
                                <input type="text" name="transactionCode" placeholder="QJ7G9XYZ" required>
                            </div>
                            <div class="form-group">
                                <label>Screenshot of M-Pesa SMS</label>
                                <input type="file" name="screenshot" accept="image/*" required>
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%;">
                                Submit Payment Proof
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        const modal = this.showModal(content);

        document.getElementById('paymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                UI.showLoading();
                await API.joinTournament(tournamentId, {
                    mpesaNumber: formData.get('mpesaNumber'),
                    transactionCode: formData.get('transactionCode'),
                    screenshot: formData.get('screenshot')
                });
                UI.closeModal();
                UI.showToast('Payment submitted! Waiting for admin verification.', 'success');
                Router.navigate('dashboard');
            } catch (error) {
                UI.showToast(error.message, 'error');
            } finally {
                UI.hideLoading();
            }
        });
    },

    showLoading() {
        const loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.innerHTML = '<div class="spinner"></div>';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        document.body.appendChild(loader);
    },

    hideLoading() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.remove();
    },

    // BRACKET RENDERING FUNCTIONS
    renderBracket(bracketData) {
        if (!bracketData || bracketData.length === 0) {
            return '<div class="no-bracket">No bracket available yet</div>';
        }

        let html = '<div class="bracket-container">';
        
        bracketData.forEach(round => {
            html += `
                <div class="bracket-round">
                    <div class="round-title">Round ${round.round || '?'}</div>
                    <div class="round-matches">
            `;
            
            round.matches?.forEach(match => {
                const player1Name = match?.player1?.username || 'TBD';
                const player2Name = match?.player2?.username || 'TBD';
                const winner = match?.winner;
                
                const p1Class = winner && winner._id === match?.player1?._id ? 'winner' : '';
                const p2Class = winner && winner._id === match?.player2?._id ? 'winner' : '';
                
                html += `
                    <div class="bracket-match">
                        <div class="match-players">
                            <div class="player ${p1Class}">${player1Name}</div>
                            <div class="vs">VS</div>
                            <div class="player ${p2Class}">${player2Name}</div>
                        </div>
                        ${match?.status === 'completed' ? `
                            <div class="match-result">
                                ${match.score1 !== null ? match.score1 : '-'} - ${match.score2 !== null ? match.score2 : '-'}
                            </div>
                        ` : `<div class="match-status">${match?.status || 'pending'}</div>`}
                    </div>
                `;
            });
            
            html += '</div></div>';
        });
        
        html += '</div>';
        return html;
    },

    // NEW: Render Standings for Round-Based Formats
    renderStandings(standingsData) {
        if (!standingsData || standingsData.length === 0) {
            return '<div class="no-bracket">Standings will appear once matches are played</div>';
        }

        return `
            <div class="standings-container" style="background: var(--glass); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                <table class="standings-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05);">
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">#</th>
                            <th style="padding: 1rem; text-align: left; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">Player</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">P</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">W</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">D</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">L</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">GF</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">GA</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--gray);">GD</th>
                            <th style="padding: 1rem; text-align: center; font-family: Orbitron; font-size: 0.85rem; color: var(--accent);">PTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${standingsData.map((s, i) => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${i < 3 ? `background: ${i === 0 ? 'rgba(255,215,0,0.1)' : i === 1 ? 'rgba(192,192,192,0.1)' : 'rgba(205,127,50,0.1)'};` : ''} ${s.player?._id === Auth.getUser()?._id ? 'background: rgba(76,175,80,0.15) !important; border-left: 3px solid var(--primary);' : ''}">
                                <td style="padding: 0.75rem; text-align: center; font-weight: bold; font-family: Orbitron; color: ${i < 3 ? 'var(--accent)' : 'var(--light)'};">${s.rank}</td>
                                <td style="padding: 0.75rem;">
                                    <strong style="color: var(--light);">${s.player?.username || 'Unknown'}</strong>
                                    ${s.player?.teamName ? `<br><small style="color: var(--gray);">${s.player.teamName}</small>` : ''}
                                    ${s.player?._id === Auth.getUser()?._id ? '<span style="color: var(--primary); font-size: 0.8rem; margin-left: 0.5rem;">(You)</span>' : ''}
                                </td>
                                <td style="padding: 0.75rem; text-align: center; color: var(--light);">${s.played}</td>
                                <td style="padding: 0.75rem; text-align: center; color: var(--success); font-weight: 500;">${s.wins}</td>
                                <td style="padding: 0.75rem; text-align: center; color: var(--light);">${s.draws}</td>
                                <td style="padding: 0.75rem; text-align: center; color: var(--danger);">${s.losses}</td>
                                <td style="padding: 0.75rem; text-align: center; color: var(--light);">${s.goalsFor}</td>
                                <td style="padding: 0.75rem; text-align: center; color: var(--light);">${s.goalsAgainst}</td>
                                <td style="padding: 0.75rem; text-align: center; ${s.goalDifference > 0 ? 'color: var(--success);' : s.goalDifference < 0 ? 'color: var(--danger);' : 'color: var(--light);'}; font-weight: 500;">
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

    showBracketModal(tournamentId, tournamentName) {
        const content = `
            <div class="modal-header">
                <h3>🏆 ${tournamentName}</h3>
                <button class="close-btn" onclick="UI.closeModal()">×</button>
            </div>
            <div id="bracketContent" style="padding: 1rem; min-height: 200px;">
                <div class="spinner"></div>
            </div>
        `;
        
        const modal = this.showModal(content);
        
        // Fetch bracket data
        API.getTournamentBracket(tournamentId)
            .then(data => {
                const isRoundBased = ['round_robin', 'league', 'swiss'].includes(data.format);
                const content = isRoundBased && data.standings 
                    ? this.renderStandings(data.standings)
                    : this.renderBracket(data.rounds);
                document.getElementById('bracketContent').innerHTML = content;
            })
            .catch(error => {
                document.getElementById('bracketContent').innerHTML = 
                    `<div style="color: var(--danger); padding: 1rem;">Error loading bracket: ${error.message}</div>`;
            });
        
        return modal;
    },

    // NEW: Create Tournament Modal with Format Selection
    showCreateTournamentModal() {
        const content = `
            <div class="modal-header">
                <h3>Create New Tournament</h3>
                <button class="close-btn" onclick="UI.closeModal()">×</button>
            </div>
            <form id="createTournamentForm" style="padding: 1.5rem;">
                ${this.createFormGroup('Tournament Name', 'text', 'name', 'eFootball Championship')}
                ${this.createFormGroup('Description', 'text', 'description', 'Brief description')}
                
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Tournament Format</label>
                    <select id="formatSelect" name="format" onchange="UI.updateFormatSettings()" style="width: 100%; padding: 0.75rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px; font-size: 1rem;">
                        ${Object.entries(this.TOURNAMENT_FORMATS).map(([key, format]) => `
                            <option value="${key}">${format.icon} ${format.name} - ${format.description}</option>
                        `).join('')}
                    </select>
                    <p id="formatDescription" style="color: var(--gray); font-size: 0.9rem; margin-top: 0.5rem;">
                        ${this.TOURNAMENT_FORMATS.single_elimination.description}
                    </p>
                    <p id="formatRecommended" style="color: var(--primary); font-size: 0.8rem; margin-top: 0.25rem;">
                        Recommended: ${this.TOURNAMENT_FORMATS.single_elimination.recommended}
                    </p>
                </div>

                <div id="dynamicSettings" style="margin: 1rem 0; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <!-- Dynamic settings loaded here -->
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    ${this.createFormGroup('Entry Fee (KES)', 'number', 'entryFee', '100')}
                    ${this.createFormGroup('Max Players', 'number', 'maxPlayers', '32')}
                </div>
                
                ${this.createFormGroup('Start Date', 'datetime-local', 'startDate')}
                ${this.createFormGroup('Admin Phone (M-Pesa)', 'tel', 'adminPhone', '2547XXXXXXXX')}
                ${this.createFormGroup('WhatsApp Group Link', 'url', 'whatsappLink', 'https://chat.whatsapp.com/...', false)}
                
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Create Tournament</button>
            </form>
        `;

        const modal = this.showModal(content);
        this.updateFormatSettings(); // Initialize settings

        document.getElementById('createTournamentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const format = formData.get('format');
            const formatSettings = this.TOURNAMENT_FORMATS[format].settings;
            
            const settings = {
                maxPlayers: parseInt(formData.get('maxPlayers')),
                minPlayers: 2
            };

            // Add format-specific settings
            if (formatSettings.includes('bestOf')) {
                settings.bestOf = parseInt(document.getElementById('bestOf')?.value) || 1;
            }
            if (formatSettings.includes('bronzeMatch')) {
                settings.bronzeMatch = document.getElementById('bronzeMatch')?.checked || false;
            }
            if (formatSettings.includes('rounds')) {
                settings.rounds = parseInt(document.getElementById('rounds')?.value) || 1;
            }
            if (formatSettings.includes('swissRounds')) {
                settings.swissRounds = parseInt(document.getElementById('swissRounds')?.value) || 5;
            }
            if (formatSettings.includes('pointsWin')) {
                settings.pointsWin = parseInt(document.getElementById('pointsWin')?.value) || 3;
                settings.pointsDraw = parseInt(document.getElementById('pointsDraw')?.value) || 1;
                settings.pointsLoss = parseInt(document.getElementById('pointsLoss')?.value) || 0;
            }

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
        const recommended = document.getElementById('formatRecommended');
        const formatInfo = this.TOURNAMENT_FORMATS[format];

        description.textContent = formatInfo.description;
        recommended.textContent = `Recommended: ${formatInfo.recommended}`;

        const settingsHTML = {
            bestOf: `
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Games per Match</label>
                    <select id="bestOf" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                        <option value="1">1 game (Bo1)</option>
                        <option value="3">3 games (Bo3)</option>
                        <option value="5">5 games (Bo5)</option>
                    </select>
                </div>
            `,
            bronzeMatch: `
                <div class="form-group" style="margin-bottom: 0.75rem; display: flex; align-items: center;">
                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 0.9rem; color: var(--light);">
                        <input type="checkbox" id="bronzeMatch" style="margin-right: 0.5rem;">
                        Include 3rd Place Match (Bronze)
                    </label>
                </div>
            `,
            rounds: `
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Times Each Pair Plays</label>
                    <input type="number" id="rounds" min="1" max="4" value="1" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                </div>
            `,
            swissRounds: `
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.9rem;">Number of Rounds</label>
                    <input type="number" id="swissRounds" min="3" max="12" value="5" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px;">
                    <small style="color: var(--gray); font-size: 0.8rem;">Recommended: log₂(players) + 1</small>
                </div>
            `,
            pointsWin: `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.85rem;">Win</label>
                        <input type="number" id="pointsWin" value="3" min="0" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px; text-align: center;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.85rem;">Draw</label>
                        <input type="number" id="pointsDraw" value="1" min="0" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px; text-align: center;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; margin-bottom: 0.25rem; color: var(--gray); font-size: 0.85rem;">Loss</label>
                        <input type="number" id="pointsLoss" value="0" min="0" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); color: var(--light); border-radius: 5px; text-align: center;">
                    </div>
                </div>
            `,
            maxPlayers: ''
        };

        // Build settings HTML based on format settings array
        const formatSettings = formatInfo.settings;
        let html = '';
        
        if (formatSettings.includes('bestOf')) html += settingsHTML.bestOf;
        if (formatSettings.includes('bronzeMatch')) html += settingsHTML.bronzeMatch;
        if (formatSettings.includes('rounds')) html += settingsHTML.rounds;
        if (formatSettings.includes('swissRounds')) html += settingsHTML.swissRounds;
        if (formatSettings.includes('pointsWin')) html += settingsHTML.pointsWin;

        container.innerHTML = html || '<p style="color: var(--gray); font-size: 0.9rem; margin: 0;">No additional settings for this format.</p>';
    },

    // FIXED: Submit Match Result Modal - now accepts tournamentId
    showSubmitResultModal(matchId, tournamentId, player1Name, player2Name) {
        const p1 = player1Name || 'You';
        const p2 = player2Name || 'Opponent';
        
        const content = `
            <div class="modal-header">
                <h3>Submit Match Result</h3>
                <button class="close-btn" onclick="UI.closeModal()">×</button>
            </div>
            <div style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="text-align: center; flex: 1;">
                        <div style="font-weight: 600; color: var(--accent); font-size: 1.1rem;">${p1}</div>
                    </div>
                    <div style="padding: 0 1rem; color: var(--gray); font-size: 1.2rem;">VS</div>
                    <div style="text-align: center; flex: 1;">
                        <div style="font-weight: 600; color: var(--accent); font-size: 1.1rem;">${p2}</div>
                    </div>
                </div>
                
                <form id="resultForm">
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group" style="margin: 0;">
                            <label style="display: block; margin-bottom: 0.5rem; color: var(--gray);">${p1} Score</label>
                            <input type="number" name="score1" min="0" max="10" required style="width: 100%; padding: 0.75rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: var(--light); text-align: center; font-size: 1.2rem;">
                        </div>
                        <span style="font-size: 1.5rem; font-weight: bold; align-self: flex-end; padding-bottom: 1rem; color: var(--gray);">-</span>
                        <div class="form-group" style="margin: 0;">
                            <label style="display: block; margin-bottom: 0.5rem; color: var(--gray);">${p2} Score</label>
                            <input type="number" name="score2" min="0" max="10" required style="width: 100%; padding: 0.75rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: var(--light); text-align: center; font-size: 1.2rem;">
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; color: var(--gray);">Winner</label>
                        <select name="winner" required style="width: 100%; padding: 0.75rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: var(--light);">
                            <option value="">Select Winner</option>
                            <option value="player1">${p1}</option>
                            <option value="player2">${p2}</option>
                        </select>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; color: var(--gray);">Upload Match Screenshot (Optional)</label>
                        <input type="file" name="screenshot" accept="image/*" style="width: 100%; padding: 0.5rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: var(--light);">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; color: var(--gray);">Notes (Optional)</label>
                        <textarea name="notes" rows="2" placeholder="Any additional info..." style="width: 100%; padding: 0.75rem; background: var(--dark); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: var(--light); resize: vertical;"></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.875rem;">Submit Result</button>
                </form>
            </div>
        `;

        const modal = this.showModal(content);

        document.getElementById('resultForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const score1 = parseInt(formData.get('score1'));
            const score2 = parseInt(formData.get('score2'));
            const winner = formData.get('winner');
            const screenshot = formData.get('screenshot');
            const notes = formData.get('notes');
            
            if (isNaN(score1) || isNaN(score2)) {
                UI.showToast('Please enter valid scores', 'error');
                return;
            }
            
            if (score1 === score2) {
                UI.showToast('Scores cannot be tied - play until there is a winner', 'error');
                return;
            }
            
            if (!winner) {
                UI.showToast('Please select a winner', 'error');
                return;
            }
            
            const expectedWinner = score1 > score2 ? 'player1' : 'player2';
            if (winner !== expectedWinner) {
                UI.showToast('Winner selection does not match scores', 'error');
                return;
            }

            try {
                UI.showLoading();
                // ✅ FIXED: Pass tournamentId and matchId to API
                const result = await API.submitMatchResult(tournamentId, matchId, {
                    score1,
                    score2,
                    winner,
                    notes,
                    screenshot: screenshot.size > 0 ? screenshot : null
                });
                
                UI.closeModal();
                
                if (result.match?.status === 'completed') {
                    UI.showToast('Match completed! Both submissions matched.', 'success');
                } else if (result.match?.status === 'disputed') {
                    UI.showToast('Result disputed - admin will review', 'warning');
                } else {
                    UI.showToast('Result submitted! Waiting for opponent.', 'success');
                }
                
                Router.navigate('dashboard');
            } catch (error) {
                console.error('Submit error:', error);
                UI.showToast(error.message || 'Failed to submit result', 'error');
            } finally {
                UI.hideLoading();
            }
        });

        return modal;
    }
};