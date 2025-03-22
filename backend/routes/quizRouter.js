const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Add this line
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const authenticateToken = require('../middleware/authenticate');

// Add this endpoint to your quizRouter.js file

// Get all unique subjects from quizzes
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await Quiz.distinct('subject');
    
    // Filter out null, undefined, or empty subjects
    const validSubjects = subjects.filter(subject => 
      subject && subject !== 'Unknown' && subject.trim() !== ''
    );
    
    res.json({ subjects: validSubjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Get topics by subject
router.get('/topics/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    console.log(`Looking for topics under subject: "${subject}"`);
    
    // Check with case-sensitivity first
    const exactSubject = await Quiz.findOne({ subject: subject });
    console.log(`Exact match for subject "${subject}": ${!!exactSubject}`);
    
    // Use case-insensitive regex
    const topics = await Quiz.distinct('topic', { 
      subject: { $regex: new RegExp(subject, 'i') }
    });
    
    console.log(`Found ${topics.length} topics for subject "${subject}"`);
    
    // Filter out null, undefined, or empty topics
    const validTopics = topics.filter(topic => 
      topic && topic !== 'Unknown' && topic.trim() !== ''
    );
    
    res.json({ topics: validTopics });
  } catch (error) {
    console.error(`Error fetching topics for subject ${req.params.subject}:`, error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// Get topics by subject
router.get('/subtopics/:topic', async (req, res) => {
  try {
    const { topic } = req.params;
    const subtopics = await Quiz.distinct('subtopic', { 
      topic: { $regex: new RegExp(topic, 'i') }
    });
    
    // Filter out null, undefined, or empty subtopics
    const validSubtopics = subtopics.filter(subtopic => 
      subtopic && subtopic !== 'Unknown' && subtopic.trim() !== ''  // FIXED!
    );
    
    res.json({ subtopics: validSubtopics });
  } catch (error) {
    console.error(`Error fetching subtopics for topic ${req.params.topic}:`, error);
    res.status(500).json({ error: 'Failed to fetch subtopics' });
  }
});

// Get concepts by subtopic
router.get('/concepts/:subtopic', async (req, res) => {
  try {
    const { subtopic } = req.params;
    const concepts = await Quiz.distinct('concept', { 
      subtopic: { $regex: new RegExp(subtopic, 'i') }
    });
    
    // Filter out null, undefined, or empty concepts
    const validConcepts = concepts.filter(concept => 
      concept && concept !== 'Unknown' && concept.trim() !== ''
    );
    
    res.json({ concepts: validConcepts });
  } catch (error) {
    console.error(`Error fetching concepts for subtopic ${req.params.subtopic}:`, error);
    res.status(500).json({ error: 'Failed to fetch concepts' });
  }
});

// Get questions by concept
router.get('/questions/concept/:concept', async (req, res) => {
  try {
    const { concept } = req.params;
    const { numQuestions, difficulty, questionTypes, includeSubItems } = req.query;
    
    console.log('Looking for concept:', concept, 'with params:', req.query);
    
    // Build the query
    let questionQuery = {};
    
    if (includeSubItems === 'true') {
      // Fetch the concept's details to get subtopic and topic
      const conceptInfo = await Quiz.findOne({ 
        concept: { $regex: new RegExp(concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      });
      
      if (conceptInfo) {
        // Query will match questions with same topic and subtopic
        questionQuery = {
          $or: [
            // Exact concept match
            { concept: { $regex: new RegExp(concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
            // Same subtopic
            { subtopic: conceptInfo.subtopic }
          ]
        };
      } else {
        questionQuery = {
          concept: { $regex: new RegExp(concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        };
      }
    } else {
      // Just match the exact concept
      questionQuery = {
        concept: { $regex: new RegExp(concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      };
    }
    
    // Add difficulty filter if provided
    if (difficulty && difficulty !== 'mixed') {
      questionQuery.difficulty = difficulty;
    }
    
    // Add question type filter if provided
    if (questionTypes && questionTypes.split(',').length > 0) {
      const types = questionTypes.split(',');
      questionQuery.type = { $in: types };
    }
    
    // Find questions directly with proper pagination
    const questions = await Question.find(questionQuery)
      .select('question options correctAnswer questionId quizeRef type')
      .limit(numQuestions ? parseInt(numQuestions) : 10)
      .exec();
    
    console.log(`Found ${questions.length} questions for concept "${concept}"`);
    
    res.json({ 
      count: questions.length,
      concept,
      questions: questions 
    });
    
  } catch (error) {
    console.error(`Error fetching questions for concept "${req.params.concept}":`, error);
    res.status(500).json({ 
      error: `Failed to fetch questions: ${error.message}`,
      concept: req.params.concept
    });
  }
});

// Get questions by subject
router.get('/questions/subject/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    const { numQuestions, difficulty, questionTypes } = req.query;
    
    // Direct query using the subject field
    const questionQuery = {
      subject: { $regex: new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
    };
    
    // Add filters
    if (difficulty && difficulty !== 'mixed') {
      questionQuery.difficulty = difficulty;
    }
    
    if (questionTypes && questionTypes.split(',').length > 0) {
      const types = questionTypes.split(',');
      questionQuery.type = { $in: types };
    }
    
    // Find questions directly
    const questions = await Question.find(questionQuery)
      .select('question options correctAnswer questionId quizeRef')
      .limit(numQuestions ? parseInt(numQuestions) : 10)
      .exec();
    
    res.json({ 
      count: questions.length,
      subject,
      questions: questions 
    });
  } catch (error) {
    console.error(`Error fetching questions for subject "${req.params.subject}":`, error);
    res.status(500).json({ 
      error: `Failed to fetch questions: ${error.message}`,
      subject: req.params.subject
    });
  }
});

// Get questions by topic
router.get('/questions/topic/:topic', async (req, res) => {
  try {
    const { topic } = req.params;
    const { numQuestions, difficulty, questionTypes } = req.query;
    
    // Direct query using the topic field
    const questionQuery = {
      topic: { $regex: new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
    };
    
    // Add filters
    if (difficulty && difficulty !== 'mixed') {
      questionQuery.difficulty = difficulty;
    }
    
    if (questionTypes && questionTypes.split(',').length > 0) {
      const types = questionTypes.split(',');
      questionQuery.type = { $in: types };
    }
    
    // Find questions directly
    const questions = await Question.find(questionQuery)
      .select('question options correctAnswer questionId quizeRef')
      .limit(numQuestions ? parseInt(numQuestions) : 10)
      .exec();
    
    res.json({ 
      count: questions.length,
      topic,
      questions: questions 
    });
  } catch (error) {
    console.error(`Error fetching questions for topic "${req.params.topic}":`, error);
    res.status(500).json({ 
      error: `Failed to fetch questions: ${error.message}`,
      topic: req.params.topic
    });
  }
});

// Get questions by subtopic
router.get('/questions/subtopic/:subtopic', async (req, res) => {
  try {
    const { subtopic } = req.params;
    const { numQuestions, difficulty, questionTypes } = req.query;
    
    // Direct query using the subtopic field
    const questionQuery = {
      subtopic: { $regex: new RegExp(subtopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
    };
    
    // Add filters
    if (difficulty && difficulty !== 'mixed') {
      questionQuery.difficulty = difficulty;
    }
    
    if (questionTypes && questionTypes.split(',').length > 0) {
      const types = questionTypes.split(',');
      questionQuery.type = { $in: types };
    }
    
    // Find questions directly
    const questions = await Question.find(questionQuery)
      .select('question options correctAnswer questionId quizeRef')
      .limit(numQuestions ? parseInt(numQuestions) : 10)
      .exec();
    
    res.json({ 
      count: questions.length,
      subtopic,
      questions: questions 
    });
  } catch (error) {
    console.error(`Error fetching questions for subtopic "${req.params.subtopic}":`, error);
    res.status(500).json({ 
      error: `Failed to fetch questions: ${error.message}`,
      subtopic: req.params.subtopic
    });
  }
});

// Add these endpoints after your existing routes


// Unified category rename function with transaction support
router.put('/rename/:categoryType', authenticateToken, async (req, res) => {
  // Start session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { categoryType } = req.params;
    const { oldName, newName, parentCategory, parentValue } = req.body;
    
    // Validate inputs
    if (!oldName || !newName) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        error: 'Both oldName and newName are required parameters' 
      });
    }
    
    // Validate category type
    const validCategories = ['subject', 'topic', 'subtopic', 'concept'];
    if (!validCategories.includes(categoryType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        error: `Invalid category type. Must be one of: ${validCategories.join(', ')}` 
      });
    }
    
    console.log(`Renaming ${categoryType} from '${oldName}' to '${newName}'`);

    // Build initial query with exact match
    const query = { [categoryType]: oldName };
    
    // Add parent category constraint if provided
    if (parentCategory && parentValue) {
      query[parentCategory] = parentValue;
    }
    
    console.log('Exact match query:', JSON.stringify(query));
    
    // Update with exact match first
    const quizResult = await Quiz.updateMany(
      query,
      { $set: { [categoryType]: newName } },
      { session }
    );
    
    const questionResult = await Question.updateMany(
      query,
      { $set: { [categoryType]: newName } },
      { session }
    );
    
    console.log('Exact match results:', {
      quizMatch: quizResult.matchedCount,
      quizModified: quizResult.modifiedCount,
      questionMatch: questionResult.matchedCount,
      questionModified: questionResult.modifiedCount
    });
    
    // If exact match didn't find anything, try case-insensitive match
    if (quizResult.matchedCount === 0 && questionResult.matchedCount === 0) {
      // Create properly escaped regex patterns
      const regexQuery = { [categoryType]: new RegExp(oldName, 'i') };
      
      // Add parent constraint to regex query if provided
      if (parentCategory && parentValue) {
        regexQuery[parentCategory] = new RegExp(parentValue, 'i');
      }
      
      console.log('Regex query:', JSON.stringify(regexQuery, (key, value) => 
        value instanceof RegExp ? value.toString() : value
      ));
      
      const quizRegexResult = await Quiz.updateMany(
        regexQuery,
        { $set: { [categoryType]: newName } },
        { session }
      );
      
      const questionRegexResult = await Question.updateMany(
        regexQuery,
        { $set: { [categoryType]: newName } },
        { session }
      );
      
      console.log('Regex results:', {
        quizMatch: quizRegexResult.matchedCount,
        quizModified: quizRegexResult.modifiedCount,
        questionMatch: questionRegexResult.matchedCount,
        questionModified: questionRegexResult.modifiedCount
      });
      
      // Update our results with regex results
      if (quizRegexResult.matchedCount > 0 || questionRegexResult.matchedCount > 0) {
        quizResult.matchedCount = quizRegexResult.matchedCount;
        quizResult.modifiedCount = quizRegexResult.modifiedCount;
        questionResult.matchedCount = questionRegexResult.matchedCount;
        questionResult.modifiedCount = questionRegexResult.modifiedCount;
      }
    }
    
    // Try to update TopicMastery if applicable
    let topicMasteryResult = { matchedCount: 0, modifiedCount: 0 };
    if (categoryType === 'subject' || categoryType === 'topic') {
      try {
        const TopicMastery = mongoose.model('TopicMastery');
        topicMasteryResult = await TopicMastery.updateMany(
          { [categoryType]: oldName },
          { $set: { [categoryType]: newName } },
          { session }
        );
      } catch (err) {
        console.log(`TopicMastery update skipped: ${err.message}`);
      }
    }
    
    // Check if any documents were found and updated
    if (quizResult.matchedCount === 0 && questionResult.matchedCount === 0 && 
        topicMasteryResult.matchedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        error: `No documents found with ${categoryType} '${oldName}'`,
        suggestion: `Try using the /verify-data/${categoryType}/${encodeURIComponent(oldName)} endpoint to check data existence`
      });
    }
    
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    
    res.json({ 
      success: true, 
      message: `${categoryType.charAt(0).toUpperCase() + categoryType.slice(1)} '${oldName}' renamed to '${newName}'`,
      newName,
      stats: {
        quizDocumentsMatched: quizResult.matchedCount,
        quizDocumentsModified: quizResult.modifiedCount,
        questionDocumentsMatched: questionResult.matchedCount,
        questionDocumentsModified: questionResult.modifiedCount,
        topicMasteryDocumentsModified: topicMasteryResult.modifiedCount || 0
      }
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error(`Error renaming ${req.params.categoryType}:`, error);
    res.status(500).json({ 
      error: `Failed to rename ${req.params.categoryType}: ${error.message}` 
    });
  }
});

// Add this endpoint after your existing routes

// Unified category delete function with transaction support
router.delete('/delete/:categoryType/:name', authenticateToken, async (req, res) => {
  // Start session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { categoryType, name } = req.params;
    const { parentCategory, parentValue } = req.query;
    
    // Validate category type
    const validCategories = ['subject', 'topic', 'subtopic', 'concept'];
    if (!validCategories.includes(categoryType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        error: `Invalid category type. Must be one of: ${validCategories.join(', ')}` 
      });
    }
    
    console.log(`Deleting ${categoryType}: '${name}'`);

    // Build query with exact match
    const query = { [categoryType]: name };
    
    // Add parent category constraint if provided
    if (parentCategory && parentValue) {
      query[parentCategory] = parentValue;
    }
    
    // Find questions to delete
    const questionsToDelete = await Question.find(query).select('_id');
    const questionIds = questionsToDelete.map(q => q._id);
    
    // Delete questions
    const questionResult = await Question.deleteMany(query, { session });
    
    // Delete quizzes with no remaining questions
    // This will only delete quizzes that exactly match the deleted category
    const quizResult = await Quiz.deleteMany(query, { session });
    
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    
    res.json({ 
      success: true, 
      message: `Successfully deleted ${categoryType}: '${name}'`,
      stats: {
        questionsDeleted: questionResult.deletedCount,
        quizzesDeleted: quizResult.deletedCount,
        questionIds: questionIds
      }
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error(`Error deleting ${req.params.categoryType}:`, error);
    res.status(500).json({ 
      error: `Failed to delete ${req.params.categoryType}: ${error.message}` 
    });
  }
});

module.exports = router;