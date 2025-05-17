const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
const {authenticateToken} = require('../middleware/authenticate');

// Apply authentication to all quiz routes
// Get all unique subjects from quizzes
router.get('/subjects', authenticateToken, assessmentController.getSubjects);

// Get topics by subject
router.get('/topics/:subject', authenticateToken, assessmentController.getTopicsBySubject);

// Get subtopics by topic
router.get('/subtopics/:topic', authenticateToken, assessmentController.getSubtopicsByTopic);

// Get concepts by subtopic
router.get('/concepts/:subtopic', authenticateToken, assessmentController.getConceptsBySubtopic);

// Get questions by concept
router.get('/questions/concept/:concept', authenticateToken, assessmentController.getQuestionsByConcept);

// Get questions by subject
router.get('/questions/subject/:subject', authenticateToken, assessmentController.getQuestionsBySubject);

// Get questions by topic
router.get('/questions/topic/:topic', authenticateToken, assessmentController.getQuestionsByTopic);

// Get questions by subtopic
router.get('/questions/subtopic/:subtopic', authenticateToken, assessmentController.getQuestionsBySubtopic);

// Submit assessment without quiz ID - using question IDs instead
router.post('/submit', authenticateToken, assessmentController.submitAssessment);

// Category management endpoints
router.put('/rename/:categoryType', authenticateToken, assessmentController.renameCategory);
router.delete('/delete/:categoryType/:name', authenticateToken, assessmentController.deleteCategory);

// Question management routes
router.delete('/questions/:questionId', authenticateToken, assessmentController.deleteQuestion);
router.put('/questions/:questionId', authenticateToken, assessmentController.updateQuestion);

module.exports = router;