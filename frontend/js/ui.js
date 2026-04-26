const UI = {
    TOURNAMENT_FORMATS: {
        single_elimination: {
            name: 'Single Elimination',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
            description: 'Lose once and you\'re out. Fast and simple.',
            recommended: '8-64 players',
            settings: ['bestOf', 'bronzeMatch', 'maxPlayers']
        },
        double_elimination: {
            name: 'Double Elimination',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
            description: 'Two losses to eliminate. Fairer but longer.',
            recommended: '8-32 players',
            settings: ['bestOf', 'maxPlayers']
        },
        round_robin: {
            name: 'Round Robin',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/><path d="m19.07 4.93-14.14 14.14"/></svg>',
            description: 'Everyone plays everyone. Best for small groups.',
            recommended: '4-12 players',
            settings: ['rounds', 'pointsWin', 'pointsDraw', 'maxPlayers']
        },
        swiss: {
            name: 'Swiss System',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
            description: 'Play similar-skilled opponents. Chess/Esports standard.',
            recommended: '8-128 players',
            settings: ['swissRounds', 'pointsWin', 'pointsDraw', 'maxPlayers']
        },
        league: {
            name: 'League',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
            description: 'Season-long competition with home/away fixtures.',
            recommended: '4-20 players',
            settings: ['rounds', 'pointsWin', 'pointsDraw', 'maxPlayers']
        }
    },

    icons: {
        check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        cross: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        eye: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
        play: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
        users: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        phone: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
        trophy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
        wallet: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
        calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
        shield: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        sword: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/></svg>',
        refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
        swiss: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
        warning: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
        clock: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        search: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
        scale: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
        gamepad: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/></svg>',
        sun: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
        moon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
        arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
        menu: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>'
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    },

    showModal(content) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="modal">
                ${content}
            </div>
        `;
        document.body.appendChild(overlay);

        const modal = overlay.querySelector('.modal');
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElements.length) {
            focusableElements[0].focus();
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

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

    // NEW: Join free tournament method
    async joinFreeTournament(tournamentId) {
        try {
            UI.showLoading();
            const result = await API.registerForTournament(tournamentId);
            UI.showToast('Successfully joined tournament!', 'success');
            Router.navigate(`tournament/${tournamentId}`);
        } catch (error) {
            UI.showToast(error.message, 'error');
        } finally {
            UI.hideLoading();
        }
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
            const player = tournament.registeredPlayers?.find(p => {
                const playerUserId = p?.user?._id || p?.user;
                return playerUserId?.toString() === userId?.toString();
            });
            
            if (!player) {
                console.warn('Player marked as registered but not found in array', { tournamentId: tournament._id, userId });
                return `<span class="status-pending">${this.icons.clock} Verification Pending</span>`;
            }
            
            if (player.paid) {
                return `<button class="btn btn-success" onclick="Router.navigate('tournament/${tournament._id}')">View Details</button>`;
            } else {
                return `<span class="status-pending">${this.icons.clock} Payment Pending</span>`;
            }
        }

        if (tournament.status !== 'open') {
            return `<button class="btn btn-secondary" disabled>Registration Closed</button>`;
        }

        // NEW: Check if free tournament
        if (tournament.isFree || tournament.entryFee === 0) {
            return `<button class="btn btn-accent" onclick="UI.joinFreeTournament('${tournament._id}')">Join Free Tournament</button>`;
        }

        return `<button class="btn btn-accent" onclick="UI.showJoinModal('${tournament._id}', '${tournament.name?.replace(/'/g, "\\'") || 'Tournament'}', ${tournament.entryFee || 0}, '${tournament.adminPhone || ''}')">Join Tournament</button>`;
    },

    renderTournamentCard(tournament) {
        if (!tournament || typeof tournament !== 'object') {
            console.error('renderTournamentCard received null/invalid tournament', tournament);
            return `<div class="tournament-card error">Error loading tournament</div>`;
        }

        const currentUser = Auth.getUser();
        const isRegistered = tournament.registeredPlayers?.some(p => {
            const playerUserId = p?.user?._id || p?.user;
            return playerUserId?.toString() === currentUser?._id?.toString();
        }) || false;
        
        const playerCount = tournament.registeredPlayers?.length || 0;
        const maxPlayers = tournament.settings?.maxPlayers || tournament.maxPlayers || 32;
        const prizePool = tournament.prizePool || (maxPlayers * (tournament.entryFee || 0) * 0.9);
        
        const formatKey = tournament.format || 'single_elimination';
        const formatInfo = this.TOURNAMENT_FORMATS[formatKey] || this.TOURNAMENT_FORMATS.single_elimination;

        return `
            <div class="tournament-card fade-in">
                <div class="tournament-header">
                    <div>
                        <h3 class="tournament-title">${tournament.name || 'Unnamed Tournament'}</h3>
                        <div class="tournament-subheader">
                            <span class="format-badge">
                                ${formatInfo.icon}
                                <span>${formatInfo.name}</span>
                            </span>
                            ${tournament.isFree ? '<span class="status-paid">FREE</span>' : ''}
                        </div>
                        <div class="prize-pool">${this.icons.trophy} ${this.formatCurrency(prizePool)}</div>
                    </div>
                    <span class="tournament-status status-${tournament.status || 'unknown'}">${tournament.status || 'unknown'}</span>
                </div>
                <p class="tournament-description">${tournament.description || 'No description'}</p>
                <div class="tournament-meta">
                    <span>${this.icons.wallet} Entry: ${this.formatCurrency(tournament.entryFee)}</span>
                    <span>${this.icons.users} ${playerCount}/${maxPlayers}</span>
                    <span>${this.icons.calendar} ${this.formatDate(tournament.startDate)}</span>
                </div>
                ${tournament.whatsappLink ? `
                    <a href="${tournament.whatsappLink}" target="_blank" rel="noopener noreferrer" class="whatsapp-btn">
                        ${this.icons.phone} Join WhatsApp Group
                    </a>
                ` : ''}
                <div class="tournament-actions">
                    ${this.getTournamentActionButton(tournament, isRegistered)}
                </div>
                ${this.renderAdminButtons(tournament)}
            </div>
        `;
    },

    renderAdminButtons(tournament) {
        const currentUser = Auth.getUser();
        if (!currentUser || currentUser.role !== 'admin') return '';
        
        if (typeof Router !== 'undefined' && Router.currentPage !== 'admin') return '';
        
        if (!tournament) return '';
        
        if (tournament.status === 'open') {
            return `
                <div class="admin-actions">
                    <button class="btn btn-warning" onclick="UI.startTournament('${tournament._id}')">
                        ${this.icons.play} Start Tournament & Generate Bracket
                    </button>
                    <button class="btn btn-secondary" onclick="UI.regenerateRound('${tournament._id}', ${tournament.currentRound})">${this.icons.refresh} Generate Next Round</button>
                    <button class="btn btn-secondary" onclick="UI.syncBracket('${tournament._id}')">${this.icons.refresh} Sync Bracket</button>
                </div>
            `;
        }
        
        if (tournament.status === 'ongoing') {
            const isRoundBased = ['round_robin', 'league', 'swiss'].includes(tournament.format);
            return `
                <div class="admin-actions">
                    <button class="btn btn-primary" onclick="UI.showBracketModal('${tournament._id}', '${tournament.name?.replace(/'/g, "\\'") || 'Tournament'}')">
                        ${this.icons.eye} View ${isRoundBased ? 'Standings' : 'Bracket'}
                    </button>
                    ${isRoundBased ? `
                        <button class="btn btn-secondary" onclick="UI.regenerateRound('${tournament._id}', ${tournament.currentRound})">
                            ${this.icons.refresh} Generate Next Round
                        </button>
                    ` : ''}
                </div>
            `;
        }
        
        return '';
    },

    // NEW: Render winners display
    renderWinners(tournament) {
        if (!tournament.winners || tournament.winners.length === 0) {
            return '<div class="empty-state"><p>Winners will be announced when tournament ends.</p></div>';
        }
        
        const winnerIcons = {
            1: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15 9H22L16 14L19 21L12 17L5 21L8 14L2 9H9L12 2Z"/></svg>',
            2: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15 9H22L16 14L19 21L12 17L5 21L8 14L2 9H9L12 2Z"/></svg>',
            3: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15 9H22L16 14L19 21L12 17L5 21L8 14L2 9H9L12 2Z"/></svg>'
        };
        
        return `
            <div class="winners-container">
                <div class="winners-header">
                    ${this.icons.trophy}
                    <h3>Tournament Winners</h3>
                </div>
                <div class="winners-grid">
                    ${tournament.winners.map(winner => `
                        <div class="winner-card rank-${winner.rank}">
                            <div class="winner-rank-icon">${winnerIcons[winner.rank] || winnerIcons[3]}</div>
                            <div class="winner-rank">${winner.rank}${this.getOrdinal(winner.rank)} Place</div>
                            <div class="winner-avatar">
                                ${winner.player?.avatar ? 
                                    `<img src="${winner.player.avatar}" alt="${winner.player.username}">` : 
                                    `<div class="winner-initials">${this.getInitials(winner.player?.username)}</div>`
                                }
                            </div>
                            <div class="winner-name">${winner.player?.username || 'Unknown'}</div>
                            <div class="winner-prize">${this.formatCurrency(winner.prize)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // NEW: Get ordinal suffix
    getOrdinal(n) {
        if (n === 1) return 'st';
        if (n === 2) return 'nd';
        if (n === 3) return 'rd';
        return 'th';
    },

    // NEW: Get initials from name
    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    },

    async syncBracket(tournamentId) {
        try { 
            UI.showLoading(); 
            await API.syncBracket(tournamentId); 
            UI.showToast('Bracket synced', 'success'); 
        } catch (e) { 
            UI.showToast(e.message, 'error'); 
        } finally { 
            UI.hideLoading(); 
        }
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

    async regenerateRound(tournamentId, currentRound) {
        if (!confirm(`Generate pairings for the next round? Ensure all matches in Round ${currentRound} are verified.`)) return;
        
        try {
            UI.showLoading();
            const result = await API.regenerateRound(tournamentId, currentRound);
            UI.showToast(`Success! Generated ${result.newMatches || 0} matches for the next round.`, 'success');
            Router.navigate('admin');
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
                <button class="close-btn" onclick="UI.closeModal()" aria-label="Close modal">&times;</button>
            </div>
            <div class="payment-steps">
                <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Send M-Pesa Payment</h4>
                        <p>Entry Fee: <strong class="accent-text">${this.formatCurrency(entryFee)}</strong></p>
                        <div class="admin-phone">${adminPhone}</div>
                        <p class="step-hint">
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
        loader.className = 'global-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        loader.setAttribute('role', 'status');
        loader.setAttribute('aria-label', 'Loading...');
        document.body.appendChild(loader);
    },

    hideLoading() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.remove();
    },

    renderBracket(bracketData) {
        const rounds = bracketData?.rounds || (Array.isArray(bracketData) ? bracketData : null);
        
        if (!rounds || rounds.length === 0) {
            return '<div class="empty-state"><p>No bracket available</p></div>';
        }

        let html = '<div class="bracket">';
        
        rounds.forEach((round, idx) => {
            html += `
                <div class="round">
                    <h4 class="round-title">Round ${round.round || idx + 1}</h4>
            `;
            
            round.matches.forEach(match => {
                html += `
                    <div class="match ${match.status || ''}" data-match-id="${match._id}">
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
                `;
            });
            
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    },

    renderStandings(standingsData) {
        if (!standingsData || standingsData.length === 0) {
            return '<div class="empty-state"><p>Standings will appear once matches are played</p></div>';
        }

        const isFullStats = standingsData[0] && standingsData[0].played !== undefined;

        if (!isFullStats) {
            return `
                <div class="leaderboard-table">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${standingsData.map(s => `
                                <tr class="rank-${s.rank}">
                                    <td class="rank-cell">${s.rank}</td>
                                    <td><strong>${s.player?.username || 'TBD'}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
        }

        return `
            <div class="standings-container">
                <table class="standings-table">
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
                            <th class="points-col">PTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${standingsData.map((s, i) => `
                            <tr class="${i < 3 ? 'rank-' + (i + 1) : ''} ${s.player?._id === Auth.getUser()?._id ? 'highlight-user' : ''}">
                                <td class="rank-cell">${s.rank}</td>
                                <td>
                                    <strong>${s.player?.username || 'Unknown'}</strong>
                                    ${s.player?.teamName ? `<br><small>${s.player.teamName}</small>` : ''}
                                    ${s.player?._id === Auth.getUser()?._id ? '<span class="you-badge">(You)</span>' : ''}
                                </td>
                                <td class="num-cell">${s.played}</td>
                                <td class="num-cell wins">${s.wins}</td>
                                <td class="num-cell">${s.draws}</td>
                                <td class="num-cell losses">${s.losses}</td>
                                <td class="num-cell">${s.goalsFor}</td>
                                <td class="num-cell">${s.goalsAgainst}</td>
                                <td class="num-cell ${s.goalDifference > 0 ? 'positive' : s.goalDifference < 0 ? 'negative' : ''}">
                                    ${s.goalDifference > 0 ? '+' : ''}${s.goalDifference}
                                </td>
                                <td class="num-cell points">${s.points}</td>
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
                <h3>${this.icons.trophy} ${tournamentName}</h3>
                <button class="close-btn" onclick="UI.closeModal()" aria-label="Close modal">&times;</button>
            </div>
            <div id="bracketContent" class="bracket-loading">
                <div class="spinner"></div>
            </div>
        `;
        
        const modal = this.showModal(content);
        
        API.getTournamentBracket(tournamentId)
            .then(data => {
                const isRoundBased = ['round_robin', 'league', 'swiss'].includes(data.format);
                const content = isRoundBased && data.standings 
                    ? this.renderStandings(data.standings)
                    : this.renderBracket(data);
                document.getElementById('bracketContent').innerHTML = content;
            })
            .catch(error => {
                document.getElementById('bracketContent').innerHTML = 
                    `<div class="empty-state"><p>Error loading bracket: ${error.message}</p></div>`;
            });
        
        return modal;
    },

    showCreateTournamentModal() {
        const content = `
            <div class="modal-header">
                <h3>Create New Tournament</h3>
                <button class="close-btn" onclick="UI.closeModal()" aria-label="Close modal">&times;</button>
            </div>
            <form id="createTournamentForm" class="modal-form">
                ${this.createFormGroup('Tournament Name', 'text', 'name', 'eFootball Championship')}
                ${this.createFormGroup('Description', 'text', 'description', 'Brief description')}
                
                <div class="form-group">
                    <label>Tournament Format</label>
                    <select id="formatSelect" name="format" onchange="UI.updateFormatSettings()">
                        ${Object.entries(this.TOURNAMENT_FORMATS).map(([key, format]) => `
                            <option value="${key}">${format.name} - ${format.description}</option>
                        `).join('')}
                    </select>
                    <p id="formatDescription" class="format-description">
                        ${this.TOURNAMENT_FORMATS.single_elimination.description}
                    </p>
                    <p id="formatRecommended" class="format-recommended">
                        Recommended: ${this.TOURNAMENT_FORMATS.single_elimination.recommended}
                    </p>
                </div>

                <div id="dynamicSettings" class="dynamic-settings">
                </div>

                <div class="form-row">
                    ${this.createFormGroup('Entry Fee (KES)', 'number', 'entryFee', '100')}
                    ${this.createFormGroup('Max Players', 'number', 'maxPlayers', '32')}
                </div>
                
                ${this.createFormGroup('Start Date', 'datetime-local', 'startDate')}
                ${this.createFormGroup('Admin Phone (M-Pesa)', 'tel', 'adminPhone', '2547XXXXXXXX')}
                ${this.createFormGroup('WhatsApp Group Link', 'url', 'whatsappLink', 'https://chat.whatsapp.com/...', false)}
                
                <div class="form-row">
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="isFree" name="isFree">
                            Free Tournament (no entry fee, no payment verification)
                        </label>
                    </div>
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="autoStart" name="autoStart">
                            Auto-start when max players reached
                        </label>
                    </div>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Create Tournament</button>
            </form>
        `;

        const modal = this.showModal(content);
        this.updateFormatSettings();

        document.getElementById('createTournamentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const format = formData.get('format');
            const formatSettings = this.TOURNAMENT_FORMATS[format].settings;
            
            const settings = {
                maxPlayers: parseInt(formData.get('maxPlayers')),
                minPlayers: 2
            };

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
                    whatsappLink: formData.get('whatsappLink'),
                    isFree: formData.get('isFree') === 'on',
                    autoStart: formData.get('autoStart') === 'on'
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
                <div class="form-group">
                    <label>Games per Match</label>
                    <select id="bestOf">
                        <option value="1">1 game (Bo1)</option>
                        <option value="3">3 games (Bo3)</option>
                        <option value="5">5 games (Bo5)</option>
                    </select>
                </div>
            `,
            bronzeMatch: `
                <div class="form-group checkbox-group">
                    <label>
                        <input type="checkbox" id="bronzeMatch">
                        Include 3rd Place Match (Bronze)
                    </label>
                </div>
            `,
            rounds: `
                <div class="form-group">
                    <label>Times Each Pair Plays</label>
                    <input type="number" id="rounds" min="1" max="4" value="1">
                </div>
            `,
            swissRounds: `
                <div class="form-group">
                    <label>Number of Rounds</label>
                    <input type="number" id="swissRounds" min="3" max="12" value="5">
                    <small>Recommended: log&#8322;(players) + 1</small>
                </div>
            `,
            pointsWin: `
                <div class="points-grid">
                    <div class="form-group">
                        <label>Win</label>
                        <input type="number" id="pointsWin" value="3" min="0">
                    </div>
                    <div class="form-group">
                        <label>Draw</label>
                        <input type="number" id="pointsDraw" value="1" min="0">
                    </div>
                    <div class="form-group">
                        <label>Loss</label>
                        <input type="number" id="pointsLoss" value="0" min="0">
                    </div>
                </div>
            `,
            maxPlayers: ''
        };

        const formatSettings = formatInfo.settings;
        let html = '';
        
        if (formatSettings.includes('bestOf')) html += settingsHTML.bestOf;
        if (formatSettings.includes('bronzeMatch')) html += settingsHTML.bronzeMatch;
        if (formatSettings.includes('rounds')) html += settingsHTML.rounds;
        if (formatSettings.includes('swissRounds')) html += settingsHTML.swissRounds;
        if (formatSettings.includes('pointsWin')) html += settingsHTML.pointsWin;

        container.innerHTML = html || '<p class="no-settings">No additional settings for this format.</p>';
    },

    showSubmitResultModal(matchId, tournamentId, player1Name, player2Name) {
        const p1 = player1Name || 'You';
        const p2 = player2Name || 'Opponent';
        
        const content = `
            <div class="modal-header">
                <h3>Submit Match Result</h3>
                <button class="close-btn" onclick="UI.closeModal()" aria-label="Close modal">&times;</button>
            </div>
            <div class="result-modal-body">
                <div class="match-players-header">
                    <div class="player-name">${p1}</div>
                    <div class="vs-divider">VS</div>
                    <div class="player-name">${p2}</div>
                </div>
                
                <form id="resultForm">
                    <div class="score-inputs">
                        <div class="form-group">
                            <label>${p1} Score</label>
                            <input type="number" name="score1" min="0" max="10" required>
                        </div>
                        <span class="score-separator">-</span>
                        <div class="form-group">
                            <label>${p2} Score</label>
                            <input type="number" name="score2" min="0" max="10" required>
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
                        <label>Final Score Screenshot (Required)</label>
                        <input type="file" name="screenshot" accept="image/*">
                    </div>

                    <div class="form-group">
                        <label>Match History Screenshot (Required)</label>
                        <input type="file" name="historyScreenshot" accept="image/*" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Notes (Optional)</label>
                        <textarea name="notes" rows="2" placeholder="Any additional info..."></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Submit Result</button>
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

window.UI = UI; 