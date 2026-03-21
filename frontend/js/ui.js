const UI = {
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

    renderTournamentCard(tournament) {
        // Guard clause for null tournament
        if (!tournament || typeof tournament !== 'object') {
            console.error('renderTournamentCard received null/invalid tournament', tournament);
            return `<div class="tournament-card error">Error loading tournament</div>`;
        }

        const currentUser = Auth.getUser();
        const isRegistered = tournament.registeredPlayers?.some(
            p => p?.user?._id === currentUser?._id
        ) || false;
        
        const playerCount = tournament.registeredPlayers?.length || 0;
        const maxPlayers = tournament.maxPlayers || 32;
        const prizePool = maxPlayers * (tournament.entryFee || 0) * 0.8;

        return `
            <div class="tournament-card fade-in">
                <div class="tournament-header">
                    <div>
                        <h3 class="tournament-title">${tournament.name || 'Unnamed Tournament'}</h3>
                        <div class="prize-pool">🏆 ${this.formatCurrency(prizePool)}</div>
                    </div>
                    <span class="tournament-status status-${tournament.status || 'unknown'}">${tournament.status || 'unknown'}</span>
                </div>
                <p style="color: var(--gray); margin-bottom: 1rem;">${tournament.description || 'No description'}</p>
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

        // Guard clause for null tournament
        if (!tournament) {
            console.error('getTournamentActionButton received null tournament');
            return `<button class="btn btn-secondary" disabled>Error</button>`;
        }

        if (isRegistered) {
            const userId = Auth.getUser()?._id;
            const player = tournament.registeredPlayers?.find(p => p?.user?._id === userId);
            
            // Guard against undefined player (data mismatch)
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
        // Only show for admin
        if (Auth.getUser()?.role !== 'admin') return '';
        
        // Guard clause for null tournament
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
            return `
                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button class="btn btn-primary" onclick="UI.showBracketModal('${tournament._id}', '${tournament.name?.replace(/'/g, "\\'") || 'Tournament'}')">
                        👁️ View Bracket
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
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/tournaments/${tournamentId}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.message);
            
            UI.showToast(`Tournament started! ${data.tournament?.totalMatches || 0} matches generated.`, 'success');
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

    showBracketModal(tournamentId, tournamentName) {
        const content = `
            <div class="modal-header">
                <h3>🏆 ${tournamentName} - Bracket</h3>
                <button class="close-btn" onclick="UI.closeModal()">×</button>
            </div>
            <div id="bracketContent" style="padding: 1rem; min-height: 200px;">
                <div class="spinner"></div>
            </div>
        `;
        
        const modal = this.showModal(content);
        
        // Fetch bracket data
        API.getBracket(tournamentId)
            .then(bracket => {
                document.getElementById('bracketContent').innerHTML = this.renderBracket(bracket);
            })
            .catch(error => {
                document.getElementById('bracketContent').innerHTML = 
                    `<div style="color: var(--danger);">Error loading bracket: ${error.message}</div>`;
            });
        
        return modal;
    },

    // NEW FUNCTION: Submit Match Result Modal
    showSubmitResultModal(matchId, player1Name, player2Name) {
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
        
        // Validation
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
            const result = await API.submitMatchResult(matchId, {
                score1,
                score2,
                winner,
                notes,
                screenshot: screenshot.size > 0 ? screenshot : null
            });
            
            UI.closeModal();
            
            if (result.autoApproved) {
                UI.showToast('Match completed! Both submissions matched.', 'success');
            } else if (result.disputed) {
                UI.showToast('Result submitted but differs from opponent - admin will review', 'warning');
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