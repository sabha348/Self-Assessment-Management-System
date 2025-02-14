const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    try {
        
        const token = req.header('Authorization').replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Access Denied: No Token Provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user details to request
        // console.log(req.user);
        // console.log("hello");
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid Token' });
    }
};

module.exports = authenticateToken;
