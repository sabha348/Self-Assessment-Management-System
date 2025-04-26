const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// Report error from frontend - removed authentication middleware
router.post('/report', async (req, res) => {
  try {
    // Log the full request body for debugging
    console.log("Error report request body:", req.body);
    
    const { message, stack, component, url, userName, userEmail } = req.body;
    
    // Create notification for admin with guaranteed values
    await Notification.create({
      type: 'system_error',
      message: `Frontend Error: ${message || 'Unknown error'}`,
      userName: userName || 'Anonymous User', // Use provided or default
      userEmail: userEmail || 'unknown@example.com', // Use provided or default
      errorDetails: {
        stack: stack || '',
        component: component || 'Unknown',
        path: url || 'Unknown URL',
        timestamp: new Date()
      }
    });
    
    res.status(201).json({ success: true, message: 'Error reported successfully' });
  } catch (error) {
    console.error('Error reporting error:', error);
    res.status(500).json({ success: false, message: 'Failed to report error' });
  }
});

module.exports = router;