const ChatApp = {
    isOpen: false,
    currentRoom: 'global',
    unreadCount: 0,
    closingTimeout: null,

    init() {
        const updateVisibility = () => {
            const user = Auth.getUser();
            const btn = document.getElementById('chatToggleBtn');
            if (btn) {
                btn.style.display = user ? 'flex' : 'none';
            }
        };

        updateVisibility();

        window.addEventListener('storage', () => {
            updateVisibility();
        });
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open(roomId = 'global', title = 'Community Chat') {
        if (this.closingTimeout) {
            clearTimeout(this.closingTimeout);
            this.closingTimeout = null;
        }

        this.isOpen = true;
        this.currentRoom = roomId;

        let overlay = document.getElementById('chatAppOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'chatAppOverlay';
            overlay.className = 'chat-app-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = this.render();
        overlay.classList.add('active');

        document.body.style.overflow = 'hidden';

        if (typeof Chat !== 'undefined') {
            Chat.joinRoom(roomId, title);
            Chat.attachListeners(roomId);
        }

        const btn = document.getElementById('chatToggleBtn');
        if (btn) btn.classList.add('active');
    },

    close() {
        this.isOpen = false;

        const overlay = document.getElementById('chatAppOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            this.closingTimeout = setTimeout(() => overlay.remove(), 300);
        }

        document.body.style.overflow = '';

        const btn = document.getElementById('chatToggleBtn');
        if (btn) btn.classList.remove('active');
    },

    render() {
        const roomId = this.currentRoom;
        const chatTitle = roomId === 'global' ? 'Community Chat' : 'Match Chat';
        const initials = (typeof Chat !== 'undefined' && Chat.getInitials) ? Chat.getInitials(chatTitle) : 'C';

        return `
            <div class="chat-app-container">
                <!-- App Header -->
                <div class="chat-app-header">
                    <button class="chat-app-back" onclick="ChatApp.close()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>

                    <div class="chat-app-title">
                        <div class="chat-app-avatar">${initials}</div>
                        <div class="chat-app-info">
                            <h3>${chatTitle}</h3>
                            <span class="chat-app-subtitle" id="chat-app-status">connecting...</span>
                        </div>
                    </div>

                    <div class="chat-app-actions">
                        <button class="chat-app-action-btn" onclick="Chat.toggleUsersList('${roomId}')" title="Members">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </button>
                        <button class="chat-app-action-btn" onclick="ChatApp.showMenu()" title="More">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                    </div>
                </div>

                <!-- Users Panel -->
                <div class="chat-app-users-panel" id="app-users-panel-${roomId}" style="display:none;">
                    <div class="wa-users-header">
                        <span>Online Users</span>
                        <button class="wa-header-btn" onclick="Chat.toggleUsersList('${roomId}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div class="wa-users-list" id="app-users-list-${roomId}"></div>
                </div>

                <!-- Messages Area -->
                <div class="chat-app-messages" id="app-messages-${roomId}">
                    <div class="wa-loading-messages" id="app-loading-${roomId}">
                        <div class="wa-spinner-small"></div>
                        <span>Loading messages...</span>
                    </div>
                </div>

                <!-- Scroll to Bottom -->
                <button class="wa-scroll-bottom" id="app-scroll-btn-${roomId}" onclick="Chat.scrollToBottom('${roomId}')" style="display:none;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                </button>

                <!-- Typing Indicator -->
                <div class="wa-typing-indicator" id="app-typing-${roomId}" style="display:none;">
                    <div class="wa-typing-bubbles"><span></span><span></span><span></span></div>
                    <span class="wa-typing-text">someone is typing</span>
                </div>

                <!-- Reply Preview -->
                <div class="wa-reply-preview" id="app-reply-preview-${roomId}" style="display:none;">
                    <div class="wa-reply-content">
                        <div class="wa-reply-username" id="app-reply-username-${roomId}"></div>
                        <div class="wa-reply-text" id="app-reply-text-${roomId}"></div>
                    </div>
                    <button class="wa-reply-close" onclick="Chat.cancelReply('${roomId}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <!-- Input Area -->
                <div class="chat-app-input-area">
                    <button class="chat-app-input-btn" onclick="Chat.toggleEmojiPicker('${roomId}')" title="Emoji">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                    </button>

                    <div class="wa-emoji-picker" id="app-emoji-picker-${roomId}" style="display:none;">
                        ${(typeof Chat !== 'undefined' && Chat.reactions) ? Chat.reactions.map(emoji => `
                            <button class="wa-emoji-btn" onclick="Chat.insertEmoji('${roomId}', '${emoji}')">${emoji}</button>
                        `).join('') : ''}
                    </div>

                    <div class="chat-app-input-wrapper">
                        <input 
                            type="text" 
                            id="app-input-${roomId}" 
                            class="chat-app-message-input" 
                            placeholder="Type a message..." 
                            autocomplete="off"
                            onkeydown="Chat.handleInputKeydown(event, '${roomId}')"
                            oninput="Chat.handleInput('${roomId}')"
                        >
                    </div>

                    <button class="chat-app-send-btn" onclick="Chat.sendMessage('${roomId}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        `;
    },

    showMenu() {
        console.log('Menu clicked');
    },

    updateBadge(count) {
        this.unreadCount = count;
        const badge = document.getElementById('chatBadge');
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }
};

window.ChatApp = ChatApp;