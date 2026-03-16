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
        return `KES ${amount.toLocaleString()}`;
    },

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    renderTournamentCard(tournament) {
        const isRegistered = tournament.registeredPlayers?.some(
            p => p.user?._id === Auth.getUser()?._id
        );
        const playerCount = tournament.registeredPlayers?.length || 0;
        const maxPlayers = tournament.maxPlayers || 32;

        return `
            <div class="tournament-card fade-in">
                <div class="tournament-header">
                    <div>
                        <h3 class="tournament-title">${tournament.name}</h3>
                        <div class="prize-pool">🏆 ${this.formatCurrency((tournament.registeredPlayers?.length || 0) * tournament.entryFee * 0.8)}
                    </div>
                    <span class="tournament-status status-${tournament.status}">${tournament.status}</span>
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
            </div>
        `;
    },

    getTournamentActionButton(tournament, isRegistered) {
        if (!Auth.isAuthenticated()) {
            return `<button class="btn btn-primary" onclick="Router.navigate('login')">Login to Join</button>`;
        }

        if (isRegistered) {
            const player = tournament.registeredPlayers.find(p => p.user._id === Auth.getUser()._id);
            if (player.paid) {
                return `<button class="btn btn-success" onclick="Router.navigate('tournament/${tournament._id}')">View Details</button>`;
            } else {
                return `<span style="color: var(--warning);">⏳ Payment Pending</span>`;
            }
        }

        if (tournament.status !== 'open') {
            return `<button class="btn btn-secondary" disabled>Registration Closed</button>`;
        }

        return `<button class="btn btn-accent" onclick="UI.showJoinModal('${tournament._id}', '${tournament.name}', ${tournament.entryFee}, '${tournament.adminPhone}')">Join Tournament</button>`;
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
    }
};