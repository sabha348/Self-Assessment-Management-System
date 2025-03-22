const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authenticate');
const authorizeRole = require('../middleware/authorize');
const UserAnswer = require('../models/UserAnswer'); // Make sure path matches your project structure
// Import the TopicMastery model
const TopicMastery = require('../models/topicMastery');

// Route to create a new user (Registration should be public)
router.post('/', userController.createUser);

// Route to get all users (Only admin should have access)
router.get('/', userController.getAllUsers);

// Fixed route order - PUT THESE BEFORE THE /:id ROUTES
// Get user progress across all subjects
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    // Now req.user will be populated with the decoded token data
    const userId = req.user?._id || req.query.userId || '1';
    
    // Fetch assessments for the user
    const userAnswers = await UserAnswer.find({ userId })
      .populate({
        path: 'quizId', // Changed from 'quizRef' to 'quizId'
        select: 'subject topic subtopic concept'
      });
    
    // Calculate subject scores
    const subjects = {};
    
    userAnswers.forEach(answer => {
      if (!answer.quizId?.subject) return; // Changed from quizRef to quizId
      
      const subject = answer.quizId.subject; // Changed from quizRef to quizId
      
      if (!subjects[subject]) {
        subjects[subject] = { correct: 0, total: 0 };
      }
      
      subjects[subject].total++;
      if (answer.isCorrect) {
        subjects[subject].correct++;
      }
    });
    
    // Format data for frontend
    const skillData = Object.entries(subjects).map(([subject, data]) => ({
      subject,
      score: Math.round((data.correct / data.total) * 100) || 0
    }));
    
    res.json({ skillData });
    
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress data' });
  }
});

// Get topic progress for a specific subject
router.get('/progress/topics/:subject', authenticateToken, async (req, res) => {
  try {
    const { subject } = req.params;
    const userId = req.user?._id || req.query.userId || '1';
    
    // Fetch assessments for the user with the given subject
    const userAnswers = await UserAnswer.find({ userId })
      .populate({
        path: 'quizId', // Changed from 'quizRef' to 'quizId'
        select: 'subject topic subtopic concept',
        match: { subject }
      });
    
    // Calculate topic scores
    const topics = {};
    
    userAnswers.forEach(answer => {
      if (!answer.quizId?.topic) return; // Changed from quizRef to quizId
      
      const topic = answer.quizId.topic; // Changed from quizRef to quizId
      
      if (!topics[topic]) {
        topics[topic] = { correct: 0, total: 0 };
      }
      
      topics[topic].total++;
      if (answer.isCorrect) {
        topics[topic].correct++;
      }
    });
    
    // Format data for frontend
    const topicData = Object.entries(topics).map(([name, data]) => ({
      name,
      score: Math.round((data.correct / data.total) * 100) || 0
    }));
    
    res.json(topicData);
    
  } catch (error) {
    console.error('Error fetching topic progress:', error);
    res.status(500).json({ error: 'Failed to fetch topic progress data' });
  }
});

// Get subtopic progress for a specific topic
router.get('/progress/subtopics/:topic', authenticateToken, async (req, res) => {
  try {
    const { topic } = req.params;
    const userId = req.user?._id || req.query.userId || '1';
    
    // Fetch assessments for the user with the given topic
    const userAnswers = await UserAnswer.find({ userId })
      .populate({
        path: 'quizId',
        select: 'subject topic subtopic concept',
        match: { topic }
      });
    
    // Calculate subtopic scores
    const subtopics = {};
    
    userAnswers.forEach(answer => {
      if (!answer.quizId?.subtopic) return;
      
      const subtopic = answer.quizId.subtopic;
      
      if (!subtopics[subtopic]) {
        subtopics[subtopic] = { correct: 0, total: 0 };
      }
      
      subtopics[subtopic].total++;
      if (answer.isCorrect) {
        subtopics[subtopic].correct++;
      }
    });
    
    // Format data for frontend
    const subtopicData = Object.entries(subtopics).map(([name, data]) => ({
      name,
      score: Math.round((data.correct / data.total) * 100) || 0
    }));
    
    res.json(subtopicData);
    
  } catch (error) {
    console.error('Error fetching subtopic progress:', error);
    res.status(500).json({ error: 'Failed to fetch subtopic progress data' });
  }
});

// Get concept progress for a specific subtopic
router.get('/progress/concepts/:subtopic', authenticateToken, async (req, res) => {
  try {
    const { subtopic } = req.params;
    const userId = req.user?._id || req.query.userId || '1';
    
    // Fetch assessments for the user with the given subtopic
    const userAnswers = await UserAnswer.find({ userId })
      .populate({
        path: 'quizId',
        select: 'subject topic subtopic concept',
        match: { subtopic }
      });
    
    // Calculate concept scores
    const concepts = {};
    
    userAnswers.forEach(answer => {
      if (!answer.quizId?.concept) return;
      
      const concept = answer.quizId.concept;
      
      if (!concepts[concept]) {
        concepts[concept] = { correct: 0, total: 0 };
      }
      
      concepts[concept].total++;
      if (answer.isCorrect) {
        concepts[concept].correct++;
      }
    });
    
    // Format data for frontend
    const conceptData = Object.entries(concepts).map(([name, data]) => ({
      name,
      score: Math.round((data.correct / data.total) * 100) || 0
    }));
    
    res.json(conceptData);
    
  } catch (error) {
    console.error('Error fetching concept progress:', error);
    res.status(500).json({ error: 'Failed to fetch concept progress data' });
  }
});

// Add this endpoint right before the update-mastery endpoint

// Get topic mastery for all topics
router.get('/topic-mastery', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Fetch all topic mastery records for this user
    const masteryRecords = await TopicMastery.find({ userId });
    
    // Transform to the format expected by the frontend
    const masteryMap = {};
    masteryRecords.forEach(record => {
      masteryMap[record.topic] = record.score;
    });
    
    res.json(masteryMap);
  } catch (error) {
    console.error('Error fetching topic mastery:', error);
    res.status(500).json({ error: 'Failed to fetch topic mastery data' });
  }
});

// Add this endpoint
router.post('/update-mastery', async (req, res) => {
  try {
    const { userId, topic, score } = req.body;
    
    if (!userId || !topic || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create a new mastery record or update an existing one
    const mastery = await TopicMastery.findOneAndUpdate(
      { userId, topic },
      { $set: { score } },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, mastery });
  } catch (error) {
    console.error('Error updating topic mastery:', error);
    res.status(500).json({ error: 'Failed to update mastery data' });
  }
});

// Add this route to your existing userRouter.js

// Save user preferences
router.post("/preferences", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { questionConfig } = req.body;
    
    if (!questionConfig) {
      return res.status(400).json({ message: "No configuration provided" });
    }
    
    // Update user document with new preferences
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          "preferences.questionConfig": questionConfig 
        } 
      },
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({ message: "Preferences saved successfully" });
    
  } catch (error) {
    console.error("Error saving preferences:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get user preferences
router.get("/preferences", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Return preferences or default values if not set
    const preferences = user.preferences || { 
      questionConfig: {
        numQuestions: 5,
        difficulty: 'medium',
        questionTypes: ['open-ended'],
        timeLimit: 0
      }
    };
    
    res.json(preferences);
    
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Route to get a user by ID (Users can only see their own profile unless admin)
router.get('/:id', authenticateToken, userController.getUserById);

// Route to update a user by ID (Users can update their own profile, admin can update any)
router.put('/:id', authenticateToken, userController.updateUser);

// Route to delete a user by ID (Only admins should be able to delete any user)
router.delete('/:id', authenticateToken, authorizeRole('admin'), userController.deleteUserById);

// Route to delete all users (Highly restricted - Admin only)
router.delete('/', authenticateToken, authorizeRole('admin'), userController.deleteAllUsers);

module.exports = router;
