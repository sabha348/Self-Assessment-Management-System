const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, isAdmin } = require('../middleware/authenticate');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const AdminLog = require('../models/AdminLogs');

// Configure multer for file uploads - add this after your imports
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadPath = 'public/assets';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function(req, file, cb) {
    cb(null, 'favicon' + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 } // Limit to 1MB
});

// Apply authentication and admin check middleware to all routes
router.use(authenticateToken, isAdmin);

router.get('/balance', adminController.getBalance);
router.get('/users/search', adminController.getAllUsers);
// User management routes
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

router.post('/users/:id/reset-password', adminController.resetUserPassword);

// Analytics routes
router.get('/analytics', adminController.getAnalytics);
router.get('/analytics/activity', adminController.getUserActivity);

// Subscription routes
router.get('/subscriptions', adminController.getAllSubscriptions);
router.post('/subscriptions', adminController.createSubscription);
router.put('/subscriptions/:id', adminController.updateSubscription);
router.delete('/subscriptions/:id', adminController.deleteSubscription);

// Settings routes
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

router.post('/settings/favicon', upload.single('favicon'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Get settings
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    // Update favicon path
    const faviconPath = `assets/${req.file.filename}`;
    settings.faviconPath = faviconPath;
    await settings.save();
    
    // Log the action if user info is available
    if (req.user && req.user._id) {
      await AdminLog.create({
        adminId: req.user._id,
        action: 'UPDATE_FAVICON',
        details: `Updated website favicon`
      });
    }
    
    res.status(200).json({ 
      message: 'Favicon uploaded successfully',
      faviconPath
    });
  } catch (error) {
    console.error("Favicon upload error:", error);
    res.status(500).json({ message: 'Error uploading favicon', error: error.message });
  }
});

// Notification routes
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { $set: { isRead: true } },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

router.delete('/notifications/clear-read', async (req, res) => {
  try {
    const result = await Notification.deleteMany({ isRead: true });
    
    res.status(200).json({
      success: true,
      message: `Cleared ${result.deletedCount} read notifications`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear read notifications',
      error: error.message
    });
  }
});

module.exports = router;