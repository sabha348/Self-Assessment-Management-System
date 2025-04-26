const express = require('express');
const router = express.Router();
const {authenticateToken} = require('../middleware/authenticate');
const AssessmentResult = require('../models/AssessmentResult');
const UserAnswer = require('../models/UserAnswer');

// Save assessment result
router.post('/save-assessment-result', authenticateToken, async (req, res) => {
  try {
    const { 
      userId, assessmentId, level, itemName, score, 
      totalQuestions, correctAnswers, timeTaken, date, detailedResults 
    } = req.body;
    
    if (!userId || !level || !itemName || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create a new assessment result record
    const assessmentResult = new AssessmentResult({
      userId,
      assessmentId,
      level,
      itemName,
      score,
      totalQuestions,
      correctAnswers,
      timeTaken,
      date: date || new Date(),
      detailedResults
    });
    
    await assessmentResult.save();
    
    res.json({ success: true, assessmentResult });
  } catch (error) {
    console.error('Error saving assessment result:', error);
    res.status(500).json({ error: 'Failed to save assessment result' });
  }
});

// Get user progress across all subjects
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    // Now req.user will be populated with the decoded token data
    const userId = req.user?._id || req.query.userId || '1';
    
    // Fetch assessments for the user
    const userAnswers = await UserAnswer.find({ userId })
      .populate({
        path: 'quizId',
        select: 'subject topic subtopic concept'
      });
    
    // Calculate subject scores
    const subjects = {};
    
    userAnswers.forEach(answer => {
      if (!answer.quizId?.subject) return;
      
      const subject = answer.quizId.subject;
      
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

// Get user progress for subjects (AssessmentResult model)
router.get('/progress/subjects', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    // const userId = req.user?._id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Aggregate results for subjects
    const subjectResults = await AssessmentResult.aggregate([
      { $match: { userId, level: 'subject' } },
      { $sort: { date: -1 } },
      { $group: {
          _id: '$itemName',
          latestScore: { $first: '$score' },
          avgScore: { $avg: '$score' },
          attempts: { $sum: 1 },
          latestDate: { $first: '$date' }
        }
      },
      { $project: {
          name: '$_id',
          score: '$latestScore',
          avgScore: 1,
          attempts: 1,
          lastAttempt: '$latestDate',
          _id: 0
        }
      }
    ]);
    
    res.json(subjectResults);
  } catch (error) {
    console.error('Error fetching subject progress:', error);
    res.status(500).json({ error: 'Failed to fetch subject progress data' });
  }
});

// Get topic progress for a specific subject (old implementation)
router.get('/topics/:subject', authenticateToken, async (req, res) => {
  try {
    const { subject } = req.params;
    const userId = req.user?._id || req.query.userId || '1';
    
    // Fetch assessments for the user with the given subject
    const userAnswers = await UserAnswer.find({ userId })
      .populate({
        path: 'quizId',
        select: 'subject topic subtopic concept',
        match: { subject }
      });
    
    // Calculate topic scores
    const topics = {};
    
    userAnswers.forEach(answer => {
      if (!answer.quizId?.topic) return;
      
      const topic = answer.quizId.topic;
      
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

// Get topic progress for a specific subject (AssessmentResult model)
router.get('/progress/topics/:subject', authenticateToken, async (req, res) => {
  try {
    const { subject, userId } = req.params;
    // const userId = req.user?._id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get all assessment results for topics within the given subject
    const topicResults = await AssessmentResult.aggregate([
      { 
        $match: { 
          userId, 
          level: 'topic',
          $or: [
            { itemName: { $regex: new RegExp(`^${subject}:`, 'i') } },
            { "detailedResults.conceptsEvaluated": subject }
          ]
        } 
      },
      { $sort: { date: -1 } },
      { $group: {
          _id: '$itemName',
          latestScore: { $first: '$score' },
          avgScore: { $avg: '$score' },
          attempts: { $sum: 1 }
        }
      },
      { $project: {
          name: '$_id',
          score: '$latestScore',
          avgScore: 1,
          attempts: 1,
          _id: 0
        }
      }
    ]);
    
    res.json(topicResults);
  } catch (error) {
    console.error('Error fetching topic progress:', error);
    res.status(500).json({ error: 'Failed to fetch topic progress data' });
  }
});

router.get('/progress/subtopics/:topic', authenticateToken, async (req, res) => {
  try {
    const topic = req.query.topic; // Use path parameter instead of query
    const userId = req.user?._id || req.query.userId;
    
    console.log(`Fetching subtopics for topic:${topic}, userId:${userId}`);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // First try to find assessment results for subtopics
    const subtopicResults = await AssessmentResult.aggregate([
      { 
        $match: { 
          userId: String(userId),
          level: 'subtopic'
          // Removed the $or condition that was too restrictive
        } 
      },
      { $sort: { date: -1 } },
      { $group: {
          _id: '$itemName',
          latestScore: { $first: '$score' },
          avgScore: { $avg: '$score' },
          attempts: { $sum: 1 }
        }
      },
      { $project: {
          name: '$_id',
          score: '$latestScore',
          avgScore: 1,
          attempts: 1,
          _id: 0
        }
      }
    ]);
    
    console.log(`Found ${subtopicResults.length} assessed subtopics`);
    
    // Then find Quiz records that connect subtopics to the requested topic
    const Quiz = require('../models/Quiz'); // Make sure this path is correct
    const matchingQuizzes = await Quiz.find({
      topic: topic
    }).distinct('subtopic');
    
    console.log(`Found ${matchingQuizzes.length} subtopics from quizzes for topic ${topic}`);
    
    // Filter subtopic results to only include those that match our topic
    const filteredResults = subtopicResults.filter(result => 
      matchingQuizzes.includes(result.name)
    );
    
    console.log(`Final matching subtopics: ${filteredResults.length}`);
    res.json(filteredResults);
  } catch (error) {
    console.error('Error fetching subtopic progress:', error);
    res.status(500).json({ error: 'Failed to fetch subtopic progress data' });
  }
});
// Get concept progress for a specific subtopic (AssessmentResult model)
// Get concept progress for a specific subtopic
router.get('/progress/concepts/:subtopic', authenticateToken, async (req, res) => {
  try {
    const subtopic = req.query.subtopic; // Use path parameter instead of query
    const userId = req.user?._id || req.query.userId;
    
    console.log(`Fetching concepts for subtopic:${subtopic}, userId:${userId}`);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // First get all concept assessment results for this user
    const conceptResults = await AssessmentResult.aggregate([
      { 
        $match: { 
          userId: String(userId),
          level: 'concept'
          // Removed restrictive filters
        } 
      },
      { $sort: { date: -1 } },
      { $group: {
          _id: '$itemName',
          latestScore: { $first: '$score' },
          avgScore: { $avg: '$score' },
          attempts: { $sum: 1 }
        }
      },
      { $project: {
          name: '$_id',
          score: '$latestScore',
          avgScore: 1,
          attempts: 1,
          _id: 0
        }
      }
    ]);
    
    console.log(`Found ${conceptResults.length} assessed concepts total`);
    
    // Then find Quiz records that connect concepts to the requested subtopic
    const Quiz = require('../models/Quiz');
    const matchingQuizzes = await Quiz.find({
      subtopic: subtopic
    }).distinct('concept');
    
    console.log(`Found ${matchingQuizzes.length} concepts from quizzes for subtopic ${subtopic}`);
    
    // Filter concept results to only include those that match our subtopic
    const filteredResults = conceptResults.filter(result => 
      matchingQuizzes.includes(result.name)
    );
    
    console.log(`Final matching concepts: ${filteredResults.length}`);
    res.json(filteredResults);
  } catch (error) {
    console.error('Error fetching concept progress:', error);
    res.status(500).json({ error: 'Failed to fetch concept progress data' });
  }
});

// Get performance trends
router.get('/performance-trends/:level/:item', authenticateToken, async (req, res) => {
  try {
    const { level, item } = req.params;
    const userId = req.user?._id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get chronological assessment results for trend analysis
    const results = await AssessmentResult.find({
      userId,
      level,
      itemName: item
    })
    .sort({ date: 1 })
    .select('score date timeTaken');
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching performance trends:', error);
    res.status(500).json({ error: 'Failed to fetch performance trend data' });
  }
});

// Get assessment results
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId || '1';
    const level = req.query.level; // Optional filter by level
    
    let query = { userId };
    if (level) {
      query.level = level;
    }
    
    const results = await AssessmentResult.find(query).sort({ date: -1 });
    res.json(results);
  } catch (error) {
    console.error('Error fetching assessment results:', error);
    res.status(500).json({ error: 'Failed to fetch assessment results' });
  }
});

module.exports = router;