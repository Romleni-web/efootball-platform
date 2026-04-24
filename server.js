const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();

// Security middleware FIRST
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'])
        : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"],
            "script-src-attr": ["'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": ["'self'", "data:", "res.cloudinary.com", "*.cloudinary.com"],
            "connect-src": ["'self'", "https://efootball-platform.onrender.com", "https://fonts.googleapis.com"]
        },
    },
}));

const originalPost = express.Router.prototype.post;
express.Router.prototype.post = function(path, ...handlers) {
    handlers.forEach((handler, i) => {
        if (typeof handler !== 'function') {
            console.error(`Invalid handler at position ${i} for POST ${path}`);
            console.error('   Type:', typeof handler);
            console.error('   Value:', handler);
        }
    });
    return originalPost.call(this, path, ...handlers);
};

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        dbState: mongoose.connection.readyState 
    });
});

const routes = [
    { path: '/api/auth', module: './routes/auth' },
    { path: '/api/users', module: './routes/users' },
    { path: '/api/tournaments', module: './routes/tournaments' },
    { path: '/api/payments', module: './routes/payments' },
    { path: '/api/matches', module: './routes/matches' },
    { path: '/api/admin', module: './routes/admin' },
    { path: '/api/chat', module: './routes/chat' },
    { path: '/api/notifications', module: './routes/notifications' }
];

for (const route of routes) {
    try {
        app.use(route.path, require(route.module));
        console.log(`Loaded route: ${route.path}`);
    } catch (err) {
        console.error(`Failed to load ${route.path}:`, err.message);
        process.exit(1);
    }
}

app.use(express.static(path.join(__dirname, 'frontend')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({ 
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message 
    });
});

const PORT = process.env.PORT || 10000;

const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
    console.error('Missing required env vars:', missing.join(', '));
    process.exit(1);
}

const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

// ============================================
// SOCKET.IO CHAT HANDLERS - WHATSAPP STYLE
// ============================================

const Message = require('./models/Message');

const roomUsers = new Map();
const typingUsers = new Map();

function getOnlineUsers(roomId) {
    if (!roomUsers.has(roomId)) return [];
    const users = roomUsers.get(roomId);
    const uniqueUsers = new Map();
    users.forEach((data, socketId) => {
        if (!uniqueUsers.has(data.userId)) {
            uniqueUsers.set(data.userId, { username: data.username, avatar: data.avatar, socketIds: [] });
        }
        uniqueUsers.get(data.userId).socketIds.push(socketId);
    });
    return Array.from(uniqueUsers.entries()).map(([userId, data]) => ({
        userId,
        username: data.username,
        avatar: data.avatar,
        socketCount: data.socketIds.length
    }));
}

function getOnlineCount(roomId) {
    return getOnlineUsers(roomId).length;
}

function broadcastToRoom(roomId, event, data, excludeSocket = null) {
    if (excludeSocket) {
        excludeSocket.to(roomId).emit(event, data);
    } else {
        io.to(roomId).emit(event, data);
    }
}

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('join-room', async (data) => {
        try {
            const roomId = data.roomId || 'global';
            const user = data.user || { username: 'Anonymous', userId: null, avatar: '' };
            
            socket.join(roomId);
            
            if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
            roomUsers.get(roomId).set(socket.id, {
                username: user.username,
                userId: user.userId,
                avatar: user.avatar
            });

            const onlineUsers = getOnlineUsers(roomId);
            socket.emit('room-users', { roomId, users: onlineUsers, count: onlineUsers.length });

            broadcastToRoom(roomId, 'user-joined', {
                roomId,
                username: user.username,
                userId: user.userId,
                avatar: user.avatar,
                onlineCount: onlineUsers.length
            }, socket);

            const recentMessages = await Message.find({ roomId, isDeleted: false })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();
            
            socket.emit('message-history', {
                roomId,
                messages: recentMessages.reverse()
            });

        } catch (error) {
            console.error('Join room error:', error);
        }
    });

    socket.on('send-message', async (data, callback) => {
        try {
            const roomId = data.roomId || 'global';
            const user = data.user || { username: 'Anonymous', userId: null, avatar: '' };
            
            const message = new Message({
                roomId,
                type: data.type || 'global',
                content: data.content,
                sender: {
                    userId: user.userId,
                    username: user.username,
                    avatar: user.avatar
                },
                replyTo: data.replyTo || null
            });
            
            await message.save();
            
            const broadcastData = {
                _id: message._id.toString(),
                roomId,
                type: message.type,
                content: message.content,
                sender: message.sender,
                replyTo: message.replyTo,
                reactions: [],
                readBy: [],
                createdAt: message.createdAt.toISOString()
            };

            io.to(roomId).emit('new-message', broadcastData);
            
            if (typeof callback === 'function') {
                callback({ success: true, messageId: message._id.toString() });
            }
        } catch (error) {
            console.error('Send message error:', error);
            if (typeof callback === 'function') {
                callback({ success: false, error: 'Failed to send message' });
            }
        }
    });

    socket.on('typing', (data) => {
        const roomId = data.roomId;
        const userId = data.userId;
        const username = data.username;

        if (typingUsers.has(roomId)) {
            const roomTyping = typingUsers.get(roomId);
            if (roomTyping.has(userId)) {
                clearTimeout(roomTyping.get(userId));
            }
        } else {
            typingUsers.set(roomId, new Map());
        }

        broadcastToRoom(roomId, 'user-typing', {
            roomId,
            userId,
            username,
            isTyping: true
        }, socket);

        const timeoutId = setTimeout(() => {
            if (typingUsers.has(roomId)) {
                typingUsers.get(roomId).delete(userId);
            }
            broadcastToRoom(roomId, 'user-typing', {
                roomId,
                userId,
                username,
                isTyping: false
            });
        }, 3000);

        typingUsers.get(roomId).set(userId, timeoutId);
    });

    socket.on('stop-typing', (data) => {
        const roomId = data.roomId;
        const userId = data.userId;
        
        if (typingUsers.has(roomId)) {
            const roomTyping = typingUsers.get(roomId);
            if (roomTyping.has(userId)) {
                clearTimeout(roomTyping.get(userId));
                roomTyping.delete(userId);
            }
        }
        
        broadcastToRoom(roomId, 'user-typing', {
            roomId,
            userId,
            username: data.username,
            isTyping: false
        }, socket);
    });

    socket.on('add-reaction', async (data) => {
        try {
            const { messageId, emoji, userId, username, roomId } = data;
            
            const message = await Message.findById(messageId);
            if (!message) return;

            message.reactions = message.reactions.filter(r => r.userId.toString() !== userId);
            message.reactions.push({ emoji, userId, username });
            await message.save();

            io.to(roomId).emit('message-reaction', {
                roomId,
                messageId,
                reactions: message.reactions,
                userId,
                emoji
            });
        } catch (error) {
            console.error('Add reaction error:', error);
        }
    });

    socket.on('remove-reaction', async (data) => {
        try {
            const { messageId, userId, roomId } = data;
            
            const message = await Message.findById(messageId);
            if (!message) return;

            message.reactions = message.reactions.filter(r => r.userId.toString() !== userId);
            await message.save();

            io.to(roomId).emit('message-reaction', {
                roomId,
                messageId,
                reactions: message.reactions,
                userId,
                removed: true
            });
        } catch (error) {
            console.error('Remove reaction error:', error);
        }
    });

    socket.on('mark-read', async (data) => {
        try {
            const { roomId, messageIds, userId, username } = data;
            
            await Message.updateMany(
                {
                    _id: { $in: messageIds },
                    'readBy.userId': { $ne: userId }
                },
                {
                    $push: {
                        readBy: { userId, username, readAt: new Date() }
                    }
                }
            );

            broadcastToRoom(roomId, 'messages-read', {
                roomId,
                messageIds,
                userId,
                username
            }, socket);
        } catch (error) {
            console.error('Mark read error:', error);
        }
    });

    socket.on('delete-message', async (data) => {
        try {
            const { messageId, roomId, userId } = data;
            
            const message = await Message.findOne({ _id: messageId, 'sender.userId': userId });
            if (!message) return;

            message.isDeleted = true;
            message.deletedAt = new Date();
            await message.save();

            io.to(roomId).emit('message-deleted', {
                roomId,
                messageId
            });
        } catch (error) {
            console.error('Delete message error:', error);
        }
    });

    socket.on('disconnect', () => {
        roomUsers.forEach((users, roomId) => {
            if (users.has(socket.id)) {
                const user = users.get(socket.id);
                users.delete(socket.id);
                
                const onlineUsers = getOnlineUsers(roomId);
                broadcastToRoom(roomId, 'user-left', {
                    roomId,
                    username: user.username,
                    userId: user.userId,
                    onlineCount: onlineUsers.length
                });
                
                if (users.size === 0) roomUsers.delete(roomId);
            }
        });
    });
});

mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(async () => {
    console.log('MongoDB Connected');
    
    try {
        await mongoose.connection.collection('users').dropIndex('efootballId_1');
        console.log('Dropped old efootballId index');
    } catch (err) {
        if (err.code === 27) {
            console.log('efootballId_1 index already clean or does not exist');
        } else {
            console.error('Index drop error:', err.message);
        }
    }
    
    mongoose.connection.on('error', (err) => {
        console.error('MongoDB error:', err);
    });
    mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
    });
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
})
.catch(err => {
    console.error('MongoDB Connection Failed:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});