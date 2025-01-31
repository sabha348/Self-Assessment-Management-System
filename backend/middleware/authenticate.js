// middleware/authenticate.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    // Extract token from Authorization header (format: "Bearer <token>")
    const token = req.header('Authorization').replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Access Denied: No Token Provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Store user info (userId, role) in req.user for use in other routes

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    res.status(400).json({ message: 'Invalid Token' });
  }
};

module.exports = authenticateToken;
