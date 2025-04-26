const User = require('../models/Users');
const Subscription = require('../models/Subscription');
const Assessment = require('../models/AssessmentResult');
const Settings = require('../models/Settings');
const AdminLog = require('../models/AdminLogs');
const bcrypt = require('bcrypt');
const Payment = require('../models/Payment');

// User Management
exports.getAllUsers = async (req, res) => {
  try {
    const { search, role, sortBy, order, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) {
      filter.role = role;
    }
    
    // Build sort object
    const sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by creation date
    }
    
    const users = await User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get additional user data
    const assessmentsCount = await Assessment.countDocuments({ userId: user._id });
    
    // Look up existing subscription or create one from user data if premium
    let subscription = await Subscription.findOne({ userId: user._id });
    
    // If no subscription record but user is premium, create a temporary obj for display
    if (!subscription && user.membership === 'premium') {
      subscription = {
        plan: user.membership,
        status: user.membershipExpiry > new Date() ? 'active' : 'active',
        startDate: user.createdAt,
        endDate: user.membershipExpiry
      };
    }
    
    res.status(200).json({
      user,
      stats: {
        assessmentsCount,
        subscription
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    
    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { name, email, role } },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Log admin action
    await AdminLog.create({
      adminId: req.user._id,
      action: 'UPDATE_USER',
      details: `Updated user ${user.email}`,
      targetId: user._id
    });
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    console.log("Delete function called with ID:", req.params.id);
    console.log("Current user:", req.user ? req.user._id : "undefined");
    
    // First, get the user
    const user = await User.findById(req.params.id);
    console.log("User found?", user ? "Yes" : "No");
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if req.user exists and then check if admin is trying to delete themselves
    if (req.user && req.user._id && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    
    // Delete user
    console.log("About to delete user");
    await User.findByIdAndDelete(req.params.id);
    console.log("this is userdelete");
    
    // Clean up related data
    await Assessment.deleteMany({ userId: req.params.id });
    await Subscription.deleteMany({ userId: req.params.id });
    
    // // Log admin action
    // await AdminLog.create({
    //   adminId: req.user._id,
    //   action: 'DELETE_USER',
    //   details: `Deleted user ${user.email}`,
    //   targetId: user._id
    // });
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    user.password = hashedPassword;
    user.passwordResetRequired = true;
    await user.save();
    
    // Log admin action
    await AdminLog.create({
      adminId: req.user._id,
      action: 'RESET_PASSWORD',
      details: `Reset password for user ${user.email}`,
      targetId: user._id
    });
    
    // In a real application, you would send this via email
    res.status(200).json({ 
      message: 'Password reset successfully',
      temporaryPassword: tempPassword 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

// Implement other controller methods for user management...

// Analytics
exports.getAnalytics = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const assessmentCount = await Assessment.countDocuments();
    // Add more analytics as needed
    
    res.status(200).json({
      userCount,
      assessmentCount,
      // Add other metrics
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

// Implement other controller methods for analytics, subscriptions, and settings...

exports.getUserActivity = async (req, res) => {
  try {
    // Implement user activity analytics
    res.status(200).json({ message: 'User activity data will be implemented here' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user activity', error: error.message });
  }
};

// Subscription Controllers
exports.getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find();
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subscriptions', error: error.message });
  }
};

exports.createSubscription = async (req, res) => {
  try {
    const newSubscription = new Subscription(req.body);
    await newSubscription.save();
    res.status(201).json(newSubscription);
  } catch (error) {
    res.status(500).json({ message: 'Error creating subscription', error: error.message });
  }
};

exports.updateSubscription = async (req, res) => {
  try {
    const updatedSubscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    
    if (!updatedSubscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    
    res.status(200).json(updatedSubscription);
  } catch (error) {
    res.status(500).json({ message: 'Error updating subscription', error: error.message });
  }
};

exports.deleteSubscription = async (req, res) => {
  try {
    const deletedSubscription = await Subscription.findByIdAndDelete(req.params.id);
    
    if (!deletedSubscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    
    res.status(200).json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting subscription', error: error.message });
  }
};

// Settings Controllers
exports.getSettings = async (req, res) => {
  try {
    // Get settings or create default if none exist
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    // Find settings document or create if not exists
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    // Update with new values
    Object.assign(settings, req.body);
    
    // Add metadata (safely check for req.user existence)
    settings.lastUpdated = new Date();
    if (req.user && req.user._id) {
      settings.updatedBy = req.user._id;
    }
    
    await settings.save();
    
    // Only create log if user info is available
    if (req.user && req.user._id) {
      await AdminLog.create({
        adminId: req.user._id,
        action: 'UPDATE_SETTINGS',
        details: `Updated system settings`
      });
    }
    
    res.status(200).json(settings);
  } catch (error) {
    console.error("Settings update error:", error); // Add this for better debugging
    res.status(500).json({ message: 'Error updating settings', error: error.message });
  }
};

// Add to adminController.js
exports.getBalance = async (req, res) => {
  try {
    console.log("this is",req.query);
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    // Get all payments in date range
    const payments = await Payment.find({
      status: 'succeeded',
      date: { $gte: startDate, $lte: endDate }
    });
    
    // Calculate total revenue
    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Get active subscriptions count
    const activeSubscriptions = await Subscription.countDocuments({
      status: 'active',
      endDate: { $gte: new Date() }
    });
    
    // Get recent transactions
    const recentTransactions = await Payment.find({ status: 'succeeded' })
      .sort({ date: -1 })
      .limit(10)
      .populate('userId', 'name email')
      .lean();
    
    const transactions = recentTransactions.map(payment => ({
      id: payment._id,
      userName: payment.userId ? payment.userId.name : 'Unknown',
      userEmail: payment.userId ? payment.userId.email : 'Unknown',
      amount: payment.amount,
      date: payment.date
    }));
    
    res.status(200).json({
      totalRevenue,
      transactions,
      metrics: {
        activeSubscriptions,
        totalPayments: payments.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching balance data', error: error.message });
  }
};