const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not defined. Please set it before starting the server.');
    }
    return secret;
};

const auth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, getJwtSecret());
        
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