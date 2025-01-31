// middleware/authorize.js
const authorizeRole = (role) => {
    return (req, res, next) => {
      if (req.user.role !== role) {
        return res.status(403).json({ message: 'Access Denied: Insufficient Permissions' });
      }
      next(); // Proceed to the next middleware or route handler
    };
  };
  
  module.exports = authorizeRole;
  