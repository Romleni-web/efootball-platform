const Chat = {
    // SVG Icons
    icons: {
        send: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
        smile: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>',
        check: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        checkDouble: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline><polyline points="20 6 9 17 4 12" transform="translate(4,0)"></polyline></svg>',
        reply: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>',
        more: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>',
        close: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        online: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="#10b981" stroke="none"><circle cx="12" cy="12" r="10"></circle></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        users: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        arrowDown: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>'
    },

    reactions: ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'],

    rooms: new Map(),
    currentRoom: null,
    currentUser: null,
    socket: null,
    replyTo: null,
    initialized: false,
    messageQueue: [],

    init() {
        if (this.initialized) {
            console.log('Chat already initialized');
            return;
        }
        
        console.log('Initializing Chat module...');
        this.initialized = true;
        this.currentUser = Auth.getUser();
        
        // Ensure socket is initialized via API
        if (!API.socket) {
            console.log('Socket not found, initializing via API...');
            API.initSocket();
        }
        
        this.socket = API.socket;
        
        if (this.socket) {
            console.log('Socket found, setting up listeners');
            this.setupSocketListeners();
        } else {
            console.log('Socket not ready, will retry...');
            // Retry after socket connects - check more frequently
            let retryCount = 0;
            const checkSocket = setInterval(() => {
                retryCount++;
                if (API.socket) {
                    console.log('Socket now available after', retryCount, 'retries');
                    this.socket = API.socket;
                    this.setupSocketListeners();
                    clearInterval(checkSocket);
                } else if (retryCount > 40) {
                    console.error('Socket failed to initialize after timeout');
                    clearInterval(checkSocket);
                }
            }, 250);
        }
    },

    setupSocketListeners() {
        if (!this.socket) {
            console.error('Cannot setup listeners: no socket');
            return;
        }

        console.log('Setting up socket listeners');

        this.socket.on('connect', () => {
            console.log('Chat: socket connected');
            this.updateConnectionStatus(this.currentRoom, true);
            this.flushMessageQueue();
            // Re-join current room if we have one
            if (this.currentRoom) {
                this.joinRoom(this.currentRoom);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Chat: socket disconnected:', reason);
            this.updateConnectionStatus(this.currentRoom, false);
        });

        this.socket.on('connect_error', (err) => {
            console.error('Chat: socket error:', err.message);
        });

        this.socket.off('new-message').on('new-message', (data) => {
            console.log('Received new message:', data);
            this.handleNewMessage(data);
        });

        this.socket.on('message-history', (data) => {
            console.log('Received message history:', data.messages?.length, 'messages');
            this.handleMessageHistory(data);
        });

        this.socket.on('user-typing', (data) => {
            this.handleTyping(data);
        });

        this.socket.on('user-joined', (data) => {
            this.updateOnlineCount(data.roomId, data.onlineCount);
            this.showSystemMessage(data.roomId, `${data.username} joined`);
        });

        this.socket.on('user-left', (data) => {
            this.updateOnlineCount(data.roomId, data.onlineCount);
        });

        this.socket.on('room-users', (data) => {
            this.updateOnlineUsers(data.roomId, data.users);
        });

        this.socket.on('message-reaction', (data) => {
            this.handleReactionUpdate(data);
        });

        this.socket.on('messages-read', (data) => {
            this.handleReadReceipts(data);
        });

        this.socket.on('message-deleted', (data) => {
            this.handleMessageDeleted(data);
        });
    },

    ensureSocket() {
        if (!this.socket) {
            console.log('ensureSocket: no socket, trying to init...');
            API.initSocket();
            this.socket = API.socket;
            if (this.socket && !this.initialized) {
                this.setupSocketListeners();
                this.initialized = true;
            }
        }
        
        if (!this.socket) {
            console.warn('ensureSocket: socket still not available');
        }
        
        return this.socket;
    },

    joinRoom(roomId, title) {
        console.log('joinRoom called:', roomId);
        
        if (!this.initialized) {
            this.init();
        }
        
        if (!this.ensureSocket()) {
            console.warn('Socket not available, will join when connected');
            // Queue room join
            this.pendingRoomJoin = roomId;
            return;
        }

        this.currentRoom = roomId;
        
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                messages: [],
                typingUsers: new Set(),
                onlineUsers: [],
                unreadCount: 0,
                isAtBottom: true
            });
        }

        const user = this.currentUser || { username: 'Guest', userId: null, avatar: '' };
        
        console.log('Emitting join-room for:', roomId);
        this.socket.emit('join-room', {
            roomId,
            user: {
                username: user.username,
                userId: user._id,
                avatar: user.avatar || ''
            }
        });

        setTimeout(() => this.markAllRead(roomId), 500);
    },

    render(roomId, title) {
        const containerId = `chat-${roomId}`;
        
        return `
            <div class="wa-chat-container" id="${containerId}" data-room="${roomId}">
                <div class="wa-connection-status" id="conn-status-${roomId}" style="display:none;">
                    <span class="wa-conn-dot"></span>
                    <span>Disconnected - reconnecting...</span>
                </div>
                
                <div class="wa-chat-header">
                    <div class="wa-chat-header-info">
                        <div class="wa-chat-avatar">
                            ${this.getInitials(title)}
                        </div>
                        <div class="wa-chat-title-group">
                            <div class="wa-chat-title">${this.escapeHtml(title)}</div>
                            <div class="wa-chat-status" id="status-${roomId}">
                                <span class="wa-online-dot"></span>
                                <span class="wa-status-text">connecting...</span>
                            </div>
                        </div>
                    </div>
                    <div class="wa-chat-header-actions">
                        <button class="wa-header-btn" onclick="Chat.toggleUsersList('${roomId}')" title="Online users">
                            ${this.icons.users}
                        </button>
                        <button class="wa-header-btn" onclick="Chat.toggleChatMenu('${roomId}')" title="Menu">
                            ${this.icons.more}
                        </button>
                    </div>
                </div>

                <div class="wa-users-panel" id="users-panel-${roomId}" style="display:none;">
                    <div class="wa-users-header">
                        <span>Online Users</span>
                        <button class="wa-header-btn" onclick="Chat.toggleUsersList('${roomId}')">${this.icons.close}</button>
                    </div>
                    <div class="wa-users-list" id="users-list-${roomId}"></div>
                </div>

                <div class="wa-messages" id="messages-${roomId}">
                    <div class="wa-loading-messages" id="loading-${roomId}">
                        <div class="wa-spinner-small"></div>
                        <span>Loading messages...</span>
                    </div>
                </div>

                <button class="wa-scroll-bottom" id="scroll-btn-${roomId}" onclick="Chat.scrollToBottom('${roomId}')" style="display:none;">
                    ${this.icons.arrowDown}
                </button>

                <div class="wa-typing-indicator" id="typing-${roomId}" style="display:none;">
                    <div class="wa-typing-bubbles">
                        <span></span><span></span><span></span>
                    </div>
                    <span class="wa-typing-text">someone is typing</span>
                </div>

                <div class="wa-reply-preview" id="reply-preview-${roomId}" style="display:none;">
                    <div class="wa-reply-content">
                        <div class="wa-reply-username" id="reply-username-${roomId}"></div>
                        <div class="wa-reply-text" id="reply-text-${roomId}"></div>
                    </div>
                    <button class="wa-reply-close" onclick="Chat.cancelReply('${roomId}')">${this.icons.close}</button>
                </div>

                <div class="wa-input-area">
                    <button class="wa-input-btn" onclick="Chat.toggleEmojiPicker('${roomId}')" title="Emoji">
                        ${this.icons.smile}
                    </button>
                    
                    <div class="wa-emoji-picker" id="emoji-picker-${roomId}" style="display:none;">
                        ${this.reactions.map(emoji => `
                            <button class="wa-emoji-btn" onclick="Chat.insertEmoji('${roomId}', '${emoji}')">${emoji}</button>
                        `).join('')}
                    </div>

                    <div class="wa-input-wrapper">
                        <input 
                            type="text" 
                            id="input-${roomId}" 
                            class="wa-message-input" 
                            placeholder="Type a message..." 
                            autocomplete="off"
                            onkeydown="Chat.handleInputKeydown(event, '${roomId}')"
                            oninput="Chat.handleInput('${roomId}')"
                        >
                    </div>
                    
                    <button class="wa-send-btn" id="send-btn-${roomId}" onclick="Chat.sendMessage('${roomId}')">
                        ${this.icons.send}
                    </button>
                </div>
            </div>
        `;
    },

    attachListeners(roomId) {
        console.log('Attaching listeners for room:', roomId);
        
        const containers = document.querySelectorAll(`#messages-${roomId}, #app-messages-${roomId}`);
        
        containers.forEach(messagesContainer => {
            messagesContainer.addEventListener('scroll', () => {
                const room = this.rooms.get(roomId);
                if (!room) return;
                
                const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
                room.isAtBottom = isAtBottom;
                
                const prefix = messagesContainer.id.startsWith('app-') ? 'app-' : '';
                const scrollBtn = document.getElementById(`${prefix}scroll-btn-${roomId}`);
                if (scrollBtn) {
                    scrollBtn.style.display = isAtBottom ? 'none' : 'flex';
                }
            });
        });

        if (!window._chatGlobalClickAttached) {
            document.addEventListener('click', (e) => {
                const pickers = document.querySelectorAll('.wa-emoji-picker');
                pickers.forEach(picker => {
                    const btn = e.target.closest('.wa-input-btn, .chat-app-input-btn');
                    if (picker.style.display !== 'none' && !picker.contains(e.target) && !btn) {
                        picker.style.display = 'none';
                    }
                });
            });
            window._chatGlobalClickAttached = true;
        }

        const input = document.getElementById(`input-${roomId}`) || document.getElementById(`app-input-${roomId}`);
        if (input) setTimeout(() => input.focus(), 100);
    },

    updateConnectionStatus(roomId, isConnected) {
        const elements = document.querySelectorAll(`#conn-status-${roomId}, #app-conn-status-${roomId}`);
        elements.forEach(el => el.style.display = isConnected ? 'none' : 'flex');
        
        const headerStatus = document.getElementById(`status-${roomId}`);
        if (headerStatus && isConnected) {
            headerStatus.querySelector('.wa-status-text').textContent = 'connected';
        }
    },

    handleNewMessage(data) {
        console.log('handleNewMessage:', data);
        const roomId = data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) {
            console.warn('Room not found:', roomId);
            return;
        }

        room.messages.push(data);
        this.renderMessage(data, roomId);
        
        const containers = document.querySelectorAll(`#messages-${roomId}, #app-messages-${roomId}`);
        containers.forEach(container => {
            if (room.isAtBottom) {
                container.scrollTop = container.scrollHeight;
            }
        });

        if (this.currentRoom === roomId && room.isAtBottom) {
            this.markAsRead([data._id], roomId);
        }
    },

    handleMessageHistory(data) {
        console.log('handleMessageHistory:', data.messages?.length, 'messages');
        const roomId = data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.messages = data.messages || [];
        
        // Handle both regular chat and app chat containers
        const containers = document.querySelectorAll(`#messages-${roomId}, #app-messages-${roomId}`);
        containers.forEach(container => {
            const loadingEl = container.querySelector(`#loading-${roomId}, #app-loading-${roomId}`);
            if (loadingEl) loadingEl.remove();
        });

        data.messages.forEach(msg => this.renderMessage(msg, roomId, true));

        containers.forEach(container => {
            container.scrollTop = container.scrollHeight;
        });

        const unreadIds = data.messages
            .filter(m => !m.readBy?.some(r => r.userId === this.currentUser?._id))
            .map(m => m._id);
        
        if (unreadIds.length > 0) {
            this.markAsRead(unreadIds, roomId);
        }
    },

    renderMessage(data, roomId, isHistory) {
        // Get both possible container types
        const containers = document.querySelectorAll(`#messages-${roomId}, #app-messages-${roomId}`);
        if (!containers || containers.length === 0) {
            console.warn('No container found for room:', roomId);
            return;
        }

        const isMe = data.sender?.userId === this.currentUser?._id;
        const messageId = `msg-${data._id}`;
        
        // Check if message already rendered
        if (document.getElementById(messageId)) return;

        const time = this.formatTime(data.createdAt);
        const readStatus = this.getReadStatus(data, isMe);
        const replyHtml = data.replyTo ? this.renderReplyPreview(data.replyTo) : '';
        const reactionsHtml = this.renderReactions(data.reactions, data._id, roomId);
        const avatar = this.getInitials(data.sender?.username || 'U');

        const messageHtml = `
            <div class="wa-message ${isMe ? 'wa-message-me' : 'wa-message-other'}" id="${messageId}" data-message-id="${data._id}">
                ${!isMe ? `<div class="wa-message-avatar">${avatar}</div>` : ''}
                <div class="wa-message-content">
                    ${!isMe ? `<div class="wa-message-sender">${this.escapeHtml(data.sender?.username || 'Unknown')}</div>` : ''}
                    ${replyHtml}
                    <div class="wa-message-text">${this.escapeHtml(data.content)}</div>
                    <div class="wa-message-meta">
                        <span class="wa-message-time">${time}</span>
                        ${isMe ? `<span class="wa-message-status">${readStatus}</span>` : ''}
                    </div>
                    ${reactionsHtml}
                </div>
                <div class="wa-message-actions">
                    <button class="wa-msg-action" onclick="Chat.showMessageMenu(event, '${data._id}', '${roomId}')" title="More">
                        ${this.icons.more}
                    </button>
                </div>
                
                <div class="wa-msg-menu" id="menu-${data._id}" style="display:none;">
                    <button onclick="Chat.setReply('${data._id}', '${roomId}')">
                        ${this.icons.reply} Reply
                    </button>
                    ${isMe ? `<button onclick="Chat.deleteMessage('${data._id}', '${roomId}')">${this.icons.trash} Delete</button>` : ''}
                </div>
            </div>
        `;

        containers.forEach(container => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = messageHtml;
            container.appendChild(tempDiv.firstElementChild);

            if (!isHistory) {
                container.scrollTop = container.scrollHeight;
            }
        });
    },

    renderReplyPreview(replyTo) {
        if (!replyTo) return '';
        return `
            <div class="wa-reply-bubble">
                <div class="wa-reply-bubble-name">${this.escapeHtml(replyTo.username || 'Unknown')}</div>
                <div class="wa-reply-bubble-text">${this.escapeHtml(replyTo.content || '')}</div>
            </div>
        `;
    },

    renderMessage(data, roomId, isHistory) {
    const container = document.getElementById(`messages-${roomId}`);
    const appContainer = document.getElementById(`app-messages-${roomId}`);
    const containers = [container, appContainer].filter(c => c);
    
    if (containers.length === 0) return;

    const isMe = data.sender?.userId === this.currentUser?._id;
    const messageId = `msg-${data._id}`;
    
    if (document.getElementById(messageId)) return;

    const time = this.formatTime(data.createdAt);
    const readStatus = this.getReadStatus(data, isMe);
    const replyHtml = data.replyTo ? this.renderReplyPreview(data.replyTo) : '';
    const reactionsHtml = this.renderReactions(data.reactions, data._id, roomId);
    const avatar = this.getInitials(data.sender?.username || 'U');

    const messageHtml = `
        <div class="wa-message ${isMe ? 'wa-message-me' : 'wa-message-other'}" id="${messageId}" data-message-id="${data._id}">
            ${!isMe ? `<div class="wa-message-avatar">${avatar}</div>` : ''}
            <div class="wa-message-content">
                ${!isMe ? `<div class="wa-message-sender">${this.escapeHtml(data.sender?.username || 'Unknown')}</div>` : ''}
                ${replyHtml}
                <div class="wa-message-text">${this.escapeHtml(data.content)}</div>
                <div class="wa-message-meta">
                    <span class="wa-message-time">${time}</span>
                    ${isMe ? `<span class="wa-message-status">${readStatus}</span>` : ''}
                </div>
                ${reactionsHtml}
            </div>
            <div class="wa-message-actions">
                <button class="wa-msg-action" onclick="Chat.showMessageMenu(event, '${data._id}', '${roomId}')" title="More">
                    ${this.icons.more}
                </button>
            </div>
            <div class="wa-msg-menu" id="menu-${data._id}" style="display:none;">
                <button onclick="Chat.setReply('${data._id}', '${roomId}')">
                    ${this.icons.reply} Reply
                </button>
                ${isMe ? `<button onclick="Chat.deleteMessage('${data._id}', '${roomId}')">${this.icons.trash} Delete</button>` : ''}
            </div>
        </div>
    `;

    containers.forEach(container => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = messageHtml;
        container.appendChild(tempDiv.firstElementChild);

        if (!isHistory) {
            container.scrollTop = container.scrollHeight;
        }
    });
},

    renderReactions(reactions, messageId, roomId) {
        if (!reactions || reactions.length === 0) return '';
        
        const grouped = {};
        reactions.forEach(r => {
            if (!grouped[r.emoji]) grouped[r.emoji] = [];
            grouped[r.emoji].push(r);
        });

        return `
            <div class="wa-reactions">
                ${Object.entries(grouped).map(([emoji, users]) => `
                    <button class="wa-reaction ${users.some(u => u.userId === this.currentUser?._id) ? 'wa-reaction-active' : ''}" 
                            onclick="Chat.toggleReaction('${messageId}', '${emoji}', '${roomId}')">
                        <span class="wa-reaction-emoji">${emoji}</span>
                        <span class="wa-reaction-count">${users.length}</span>
                    </button>
                `).join('')}
            </div>
        `;
    },

    sendMessage(roomId) {
        console.log('sendMessage called for room:', roomId);
        const input = document.getElementById(`input-${roomId}`) || document.getElementById(`app-input-${roomId}`);
        if (!input) return;

        const content = input.value.trim();
        if (!content) {
            console.log('Empty message, ignoring');
            return;
        }

        // Ensure socket is ready
        if (!this.ensureSocket()) {
            console.warn('Socket not ready, queuing message');
            this.queueMessage(roomId, content);
            UI.showToast('Connecting to chat...', 'info');
            return;
        }

        if (!this.socket.connected) {
            console.warn('Socket not connected, queuing message');
            this.queueMessage(roomId, content);
            UI.showToast('Reconnecting... message queued', 'info');
            return;
        }

        const user = this.currentUser || { username: 'Guest', _id: null, avatar: '' };

        const messageData = {
            roomId,
            type: roomId === 'global' ? 'global' : 'match',
            content,
            user: {
                username: user.username,
                userId: user._id,
                avatar: user.avatar || ''
            },
            replyTo: this.replyTo
        };

        console.log('Emitting send-message:', messageData);
        
        // Clear input immediately for better UX
        input.value = '';
        this.cancelReply(roomId);

        this.socket.emit('send-message', messageData, (response) => {
            console.log('Send message callback:', response);
            if (!response || !response.success) {
                console.error('Message send failed:', response);
                input.value = content;
                UI.showToast('Failed to send. Retrying...', 'error');
            }
        });
    },

    queueMessage(roomId, content) {
        this.messageQueue.push({ roomId, content, replyTo: this.replyTo, timestamp: Date.now() });
    },

    flushMessageQueue() {
        console.log('Flushing message queue, items:', this.messageQueue.length);
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (Date.now() - msg.timestamp < 30000) {
                const user = this.currentUser || { username: 'Guest', _id: null, avatar: '' };
                this.socket.emit('send-message', {
                    roomId: msg.roomId,
                    type: msg.roomId === 'global' ? 'global' : 'match',
                    content: msg.content,
                    user: {
                        username: user.username,
                        userId: user._id,
                        avatar: user.avatar || ''
                    },
                    replyTo: msg.replyTo
                });
            }
        }
    },

    handleInputKeydown(event, roomId) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage(roomId);
        }
    },

    handleInput(roomId) {
        const user = this.currentUser;
        if (!user || !this.ensureSocket()) return;

        this.socket.emit('typing', {
            roomId,
            userId: user._id,
            username: user.username
        });
    },

    handleTyping(data) {
        const roomId = data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;

        const indicators = document.querySelectorAll(`#typing-${roomId}, #app-typing-${roomId}`);

        indicators.forEach(typingEl => {
            if (data.isTyping) {
                room.typingUsers.add(data.userId);
                typingEl.style.display = 'flex';
                typingEl.querySelector('.wa-typing-text').textContent = 
                    room.typingUsers.size === 1 ? `${data.username} is typing...` : `${room.typingUsers.size} people are typing...`;
            } else {
                room.typingUsers.delete(data.userId);
                if (room.typingUsers.size === 0) {
                    typingEl.style.display = 'none';
                } else {
                    typingEl.querySelector('.wa-typing-text').textContent = 
                        `${room.typingUsers.size} people are typing...`;
                }
            }
        });
    },

    setReply(messageId, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const message = room.messages.find(m => m._id === messageId);
        if (!message) return;

        this.replyTo = {
            messageId: message._id,
            content: message.content.substring(0, 100),
            username: message.sender?.username
        };

        const previews = document.querySelectorAll(`#reply-preview-${roomId}, #app-reply-preview-${roomId}`);
        previews.forEach(p => {
            const prefix = p.id.startsWith('app-') ? 'app-' : '';
            const uEl = document.getElementById(`${prefix}reply-username-${roomId}`);
            const tEl = document.getElementById(`${prefix}reply-text-${roomId}`);
            if (uEl) uEl.textContent = message.sender?.username || 'Unknown';
            if (tEl) tEl.textContent = message.content.substring(0, 100);
            p.style.display = 'flex';
        });

        this.hideMessageMenu(messageId);
        (document.getElementById(`input-${roomId}`) || document.getElementById(`app-input-${roomId}`))?.focus();
    },

    cancelReply(roomId) {
        this.replyTo = null;
        const previews = document.querySelectorAll(`#reply-preview-${roomId}, #app-reply-preview-${roomId}`);
        previews.forEach(p => p.style.display = 'none');
    },

    toggleReaction(messageId, emoji, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const message = room.messages.find(m => m._id === messageId);
        if (!message) return;

        if (!this.ensureSocket()) {
            UI.showToast('Not connected', 'error');
            return;
        }

        const hasReacted = message.reactions?.some(r => 
            r.userId === this.currentUser?._id && r.emoji === emoji
        );

        if (hasReacted) {
            this.socket.emit('remove-reaction', {
                messageId,
                userId: this.currentUser._id,
                roomId
            });
        } else {
            this.socket.emit('add-reaction', {
                messageId,
                emoji,
                userId: this.currentUser._id,
                username: this.currentUser.username,
                roomId
            });
        }
    },

    handleReactionUpdate(data) {
        const roomId = data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;

        const message = room.messages.find(m => m._id === data.messageId);
        if (message) {
            message.reactions = data.reactions;
        }

        const msgEl = document.getElementById(`msg-${data.messageId}`);
        if (!msgEl) return;

        const contentEl = msgEl.querySelector('.wa-message-content');
        const existingReactions = contentEl.querySelector('.wa-reactions');
        if (existingReactions) existingReactions.remove();

        if (data.reactions && data.reactions.length > 0) {
            const reactionsHtml = this.renderReactions(data.reactions, data.messageId, roomId);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = reactionsHtml;
            contentEl.appendChild(tempDiv.firstElementChild);
        }
    },

    markAsRead(messageIds, roomId) {
        if (!this.currentUser || !this.ensureSocket()) return;
        
        this.socket.emit('mark-read', {
            roomId,
            messageIds,
            userId: this.currentUser._id,
            username: this.currentUser.username
        });
    },

    markAllRead(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const unreadIds = room.messages
            .filter(m => !m.readBy?.some(r => r.userId === this.currentUser?._id))
            .map(m => m._id);

        if (unreadIds.length > 0) {
            this.markAsRead(unreadIds, roomId);
        }
    },

    handleReadReceipts(data) {
        const roomId = data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;

        data.messageIds.forEach(msgId => {
            const message = room.messages.find(m => m._id === msgId);
            if (message) {
                if (!message.readBy) message.readBy = [];
                if (!message.readBy.some(r => r.userId === data.userId)) {
                    message.readBy.push({ userId: data.userId, username: data.username, readAt: new Date() });
                }
            }

            const msgEl = document.getElementById(`msg-${msgId}`);
            if (msgEl && msgEl.classList.contains('wa-message-me')) {
                const statusEl = msgEl.querySelector('.wa-message-status');
                if (statusEl) {
                    statusEl.innerHTML = this.icons.checkDouble;
                    statusEl.classList.add('wa-read');
                }
            }
        });
    },

    deleteMessage(messageId, roomId) {
        if (!confirm('Delete this message?')) return;
        
        if (!this.ensureSocket()) {
            UI.showToast('Not connected', 'error');
            return;
        }
        
        this.socket.emit('delete-message', {
            messageId,
            roomId,
            userId: this.currentUser?._id
        });
        this.hideMessageMenu(messageId);
    },

    handleMessageDeleted(data) {
        const msgEl = document.getElementById(`msg-${data.messageId}`);
        if (msgEl) {
            msgEl.classList.add('wa-message-deleted');
            const contentEl = msgEl.querySelector('.wa-message-text');
            if (contentEl) {
                contentEl.textContent = 'This message was deleted';
                contentEl.classList.add('wa-deleted-text');
            }
        }
    },

    showMessageMenu(event, messageId, roomId) {
        event.stopPropagation();
        
        document.querySelectorAll('.wa-msg-menu').forEach(m => m.style.display = 'none');
        
        const menu = document.getElementById(`menu-${messageId}`);
        if (menu) {
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        }

        const closeMenu = (e) => {
            if (!e.target.closest('.wa-msg-menu') && !e.target.closest('.wa-msg-action')) {
                this.hideMessageMenu(messageId);
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    },

    hideMessageMenu(messageId) {
        const menu = document.getElementById(`menu-${messageId}`);
        if (menu) menu.style.display = 'none';
    },

    toggleEmojiPicker(roomId) {
        const pickers = document.querySelectorAll(`#emoji-picker-${roomId}, #app-emoji-picker-${roomId}`);
        pickers.forEach(p => {
            p.style.display = p.style.display === 'none' ? 'grid' : 'none';
        });
    },

    insertEmoji(roomId, emoji) {
        const input = document.getElementById(`input-${roomId}`) || document.getElementById(`app-input-${roomId}`);
        if (input) {
            input.value += emoji;
            input.focus();
        }
        // Don't auto-close if user might want multiple emojis
    },

    toggleUsersList(roomId) {
        const panel = document.getElementById(`users-panel-${roomId}`);
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    },

    toggleChatMenu(roomId) {
        console.log('Chat menu toggled for', roomId);
    },

    updateOnlineCount(roomId, count) {
        const statusEl = document.getElementById(`status-${roomId}`);
        if (statusEl) {
            const textEl = statusEl.querySelector('.wa-status-text');
            if (textEl) textEl.textContent = `${count} online`;
        }
    },

    updateOnlineUsers(roomId, users) {
        const lists = document.querySelectorAll(`#users-list-${roomId}, #app-users-list-${roomId}`);
        const html = users.map(u => `
            <div class="wa-user-item">
                <div class="wa-user-avatar">${this.getInitials(u.username)}</div>
                <span class="wa-user-name">${this.escapeHtml(u.username)}</span>
                <span class="wa-user-status">${this.icons.online}</span>
            </div>
        `).join('');
    },

    showSystemMessage(roomId, text) {
        const containers = document.querySelectorAll(`#messages-${roomId}, #app-messages-${roomId}`);
        containers.forEach(container => {
            const div = document.createElement('div');
            div.className = 'wa-system-message';
            div.textContent = text;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        });
    },

    scrollToBottom(roomId) {
        const containers = document.querySelectorAll(`#messages-${roomId}, #app-messages-${roomId}`);
        containers.forEach(container => {
            container.scrollTop = container.scrollHeight;
        });
        const room = this.rooms.get(roomId);
        if (room) room.isAtBottom = true;
    },

    getReadStatus(message, isMe) {
        if (!isMe) return '';
        if (!message.readBy || message.readBy.length === 0) {
            return this.icons.check;
        }
        const readByOthers = message.readBy.filter(r => r.userId !== message.sender?.userId);
        if (readByOthers.length > 0) {
            return `<span class="wa-read">${this.icons.checkDouble}</span>`;
        }
        return this.icons.check;
    },

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    },

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.Chat = Chat;