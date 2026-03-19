const auth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        console.log('Auth header received:', authHeader ? 'Present' : 'Missing');
        
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
            console.log('No token found in header');
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        console.log('Token extracted:', token.substring(0, 20) + '...');
        console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'efootball_secret_key');
        console.log('Token decoded successfully:', decoded);
        
        // Handle both `id` and `_id` in token payload
        const userId = decoded.id || decoded._id || decoded.userId;
        console.log('Looking up user with ID:', userId);
        
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            console.log('User not found for ID:', userId);
            console.log('Decoded payload was:', decoded);
            return res.status(401).json({ message: 'Token is not valid - user not found' });
        }

        console.log('User found:', user.email || user._id);
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        res.status(401).json({ message: 'Token is not valid: ' + error.message });
    }
};