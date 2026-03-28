const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'efootball_secret_key');
        
        const userId = decoded.id || decoded._id || decoded.userId;
        
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ message: 'Token is not valid - user not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        res.status(401).json({ message: 'Token is not valid: ' + error.message });
    }
};

// CRITICAL: Export as object with auth property
module.exports = { auth };