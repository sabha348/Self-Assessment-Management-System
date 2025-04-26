const express = require('express');
const router = express.Router();
const HelpRequest = require('../models/HelpRequest');
const Notification = require('../models/Notification');
const { authenticateToken, isAdmin } = require('../middleware/authenticate');
const nodemailer = require('nodemailer');

// Create a help request (for users)
router.post('/help-request', authenticateToken, async (req, res) => {
  try {
    const { message, userName, userEmail, userId } = req.body;
    
    // Create help request
    const helpRequest = await HelpRequest.create({
      userId,
      userName,
      userEmail,
      message
    });
    
    // // Create notification for admin
    // await Notification.create({
    //   type: 'help_request',
    //   message: `New help request from ${userName}`,
    //   userName,
    //   userEmail,
    //   userId,
    // });
    
    res.status(201).json({
      success: true,
      message: 'Help request submitted successfully',
      helpRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to submit help request',
      error: error.message
    });
  }
});

// Get all help requests (admin only)
router.get('/help-requests', authenticateToken, isAdmin, async (req, res) => {
  try {
    const helpRequests = await HelpRequest.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: helpRequests.length,
      helpRequests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch help requests',
      error: error.message
    });
  }
});

// Respond to help request (admin only)
router.post('/help-request/:id/respond', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { response } = req.body;
    const helpRequest = await HelpRequest.findById(req.params.id);
    
    if (!helpRequest) {
      return res.status(404).json({
        success: false,
        message: 'Help request not found'
      });
    }
    
    // Update help request
    helpRequest.status = 'resolved';
    helpRequest.adminResponse = response;
    helpRequest.respondedAt = Date.now();
    await helpRequest.save();
    
    console.log("Help request updated:", helpRequest);
    // Send email to user
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",  
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    console.log("Sending email to:", helpRequest.userEmail);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: helpRequest.userEmail,
      subject: 'Response to Your Help Request',
      html: `
        <h2>Response to Your Help Request</h2>
        <p><strong>Your message:</strong> ${helpRequest.message}</p>
        <p><strong>Our response:</strong> ${response}</p>
        <p>Thank you for reaching out to us!</p>
      `
    // }).catch(err => {
    //   console.error("Email sending error details:", err);
    });

    console.log("Email sent successfully to:", helpRequest.userEmail);
    
    res.status(200).json({
      success: true,
      message: 'Response sent successfully',
      helpRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to respond to help request',
      error: error.message
    });
  }
});

// Clear resolved help requests (admin only)
router.delete('/help-requests/clear-resolved', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await HelpRequest.deleteMany({ status: 'resolved' });
    
    res.status(200).json({
      success: true,
      message: `Cleared ${result.deletedCount} resolved help requests`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear resolved help requests',
      error: error.message
    });
  }
});

module.exports = router;