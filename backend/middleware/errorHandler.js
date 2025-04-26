const Notification = require('../models/Notification');

const errorHandler = async (err, req, res, next) => {
  console.error('Server Error:', err);
  
  // Create notification for admin
  try {
    await Notification.create({
      type: 'system_error',
      message: `Backend Error: ${err.message || 'Unknown error'}`,
      userName: 'System',
      userEmail: 'system@example.com',
      errorDetails: {
        stack: err.stack,
        path: req.originalUrl,
        timestamp: new Date()
      }
    });
  } catch (notificationError) {
    console.error('Failed to create error notification:', notificationError);
  }
  
  // Send error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
};

module.exports = errorHandler;