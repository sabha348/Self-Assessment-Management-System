const express = require('express');
const router = express.Router();
const {authenticateToken} = require('../middleware/authenticate');
const BreakEvent = require('../models/BreakEvent');

// Record break notification events
router.post('/break-notification', authenticateToken, async (req, res) => {
  try {
    const { userId, eventType, timestamp } = req.body;
    
    // Validate input
    if (!userId || !eventType) {
      return res.status(400).json({ error: 'Missing required fields (userId or eventType)' });
    }
    
    if (!['notification_shown', 'break_taken', 'break_ignored'].includes(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }
    
    // Create a new break event record
    const breakEvent = new BreakEvent({
      userId,
      eventType,
      timestamp: timestamp || Date.now()
    });
    
    await breakEvent.save();
    
    res.status(201).json({ success: true, event: breakEvent });
  } catch (error) {
    console.error('Error storing break notification event:', error);
    res.status(500).json({ error: 'Failed to store break notification event' });
  }
});

// Get break notification statistics
router.get('/break-statistics', authenticateToken, async (req, res) => {
  try {
    // Get userId from token or query parameter
    const userId = req.user?._id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Count notifications shown
    const notificationsShown = await BreakEvent.countDocuments({ 
      userId, 
      eventType: 'notification_shown' 
    });
    
    // Count breaks taken
    const breaksTaken = await BreakEvent.countDocuments({ 
      userId, 
      eventType: 'break_taken' 
    });
    
    // Count breaks ignored
    const breaksIgnored = await BreakEvent.countDocuments({ 
      userId, 
      eventType: 'break_ignored' 
    });
    
    // Generate weekly trend data (last 4 weeks)
    const weeklyTrend = await generateWeeklyBreakTrend(userId);
    
    res.json({
      notificationsShown,
      breaksTaken,
      breaksIgnored,
      weeklyTrend
    });
  } catch (error) {
    console.error('Error fetching break statistics:', error);
    res.status(500).json({ error: 'Failed to fetch break statistics' });
  }
});

// Get detailed break events for a specific time period
router.get('/break-events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId;
    const { startDate, endDate, eventType } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Build query filter
    const filter = { userId };
    
    // Add date range if provided
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }
    
    // Add event type filter if provided
    if (eventType) {
      filter.eventType = eventType;
    }
    
    // Get events
    const events = await BreakEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(100); // Limit to prevent large responses
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching break events:', error);
    res.status(500).json({ error: 'Failed to fetch break events' });
  }
});

// Helper function to generate weekly break trend data
async function generateWeeklyBreakTrend(userId) {
  // Get current date and date 4 weeks ago
  const now = new Date();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  
  // Query all events in the last 4 weeks
  const events = await BreakEvent.find({
    userId,
    timestamp: { $gte: fourWeeksAgo, $lte: now }
  });
  
  // Group events by week
  const weeklyData = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (7 * (i + 1)));
    
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - (7 * i));
    
    // Filter events for this week
    const weekEvents = events.filter(event => 
      event.timestamp >= weekStart && event.timestamp < weekEnd
    );
    
    weeklyData.unshift({
      week: `Week ${4-i}`,
      notificationsShown: weekEvents.filter(e => e.eventType === 'notification_shown').length,
      breaksTaken: weekEvents.filter(e => e.eventType === 'break_taken').length,
      breaksIgnored: weekEvents.filter(e => e.eventType === 'break_ignored').length
    });
  }
  
  return weeklyData;
}

// Get break trend insights for a user
router.get('/break-insights', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get overall statistics
    const notificationsShown = await BreakEvent.countDocuments({ 
      userId, 
      eventType: 'notification_shown' 
    });
    
    const breaksTaken = await BreakEvent.countDocuments({ 
      userId, 
      eventType: 'break_taken' 
    });
    
    // Calculate acceptance rate
    const acceptanceRate = notificationsShown > 0 
      ? Math.round((breaksTaken / notificationsShown) * 100) 
      : 0;
    
    // Get assessment results before and after breaks to analyze impact
    // This requires coordination with the AssessmentResult model
    // For simplicity, we'll skip this part for now
    
    res.json({
      totalNotifications: notificationsShown,
      breaksTaken,
      acceptanceRate,
      insight: generateInsightMessage(acceptanceRate, notificationsShown)
    });
  } catch (error) {
    console.error('Error generating break insights:', error);
    res.status(500).json({ error: 'Failed to generate break insights' });
  }
});

// Helper function to generate insight message based on user behavior
function generateInsightMessage(acceptanceRate, totalNotifications) {
  if (totalNotifications === 0) {
    return "You haven't received any break notifications yet. This suggests you're maintaining good focus during study sessions.";
  }
  
  if (acceptanceRate >= 70) {
    return "You're effectively utilizing break recommendations, which helps prevent burnout and improve long-term retention.";
  } else if (acceptanceRate >= 30) {
    return "You're taking some recommended breaks, but consider taking more to optimize your learning efficiency.";
  } else {
    return "Consider taking more of the recommended breaks. Research shows regular breaks improve retention and prevent cognitive fatigue.";
  }
}

module.exports = router;