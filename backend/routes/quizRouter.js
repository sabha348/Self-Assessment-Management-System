const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const {authenticateToken} = require('../middleware/authenticate');

// Apply authentication to all quiz routes
// Get all unique subjects from quizzes
router.get('/subjects', authenticateToken, quizController.getSubjects);

// Get topics by subject
router.get('/topics/:subject', authenticateToken, quizController.getTopicsBySubject);

// Get subtopics by topic
router.get('/subtopics/:topic', authenticateToken, quizController.getSubtopicsByTopic);

// Get concepts by subtopic
router.get('/concepts/:subtopic', authenticateToken, quizController.getConceptsBySubtopic);

// Get questions by concept
router.get('/questions/concept/:concept', authenticateToken, quizController.getQuestionsByConcept);

// Get questions by subject
router.get('/questions/subject/:subject', authenticateToken, quizController.getQuestionsBySubject);

// Get questions by topic
router.get('/questions/topic/:topic', authenticateToken, quizController.getQuestionsByTopic);

// Get questions by subtopic
router.get('/questions/subtopic/:subtopic', authenticateToken, quizController.getQuestionsBySubtopic);

// Category management endpoints
router.put('/rename/:categoryType', authenticateToken, quizController.renameCategory);
router.delete('/delete/:categoryType/:name', authenticateToken, quizController.deleteCategory);

module.exports = router;