const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    teamName: { type: String, trim: true, default: '' },
    efootballId: { type: String, unique: true, sparse: true, trim: true },
    phoneNumber: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },
    country: { type: String, default: '' },
    role: { type: String, enum: ['player', 'admin'], default: 'player' },
    points: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    
    pushSubscription: {
        endpoint: { type: String },
        keys: {
            p256dh: { type: String },
            auth: { type: String }
        },
        createdAt: { type: Date }
    },
    
    notificationPrefs: {
        tournamentReminders: { type: Boolean, default: true },
        matchAlerts: { type: Boolean, default: true },
        chatMessages: { type: Boolean, default: true },
        prizeNotifications: { type: Boolean, default: true }
    },
    
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);