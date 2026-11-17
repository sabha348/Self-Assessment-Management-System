const express = require("express");
const router = express.Router();
const Question = require("../models/Question"); // Corrected case sensitivity
const Quiz = require("../models/Quiz");
const UserAnswer = require("../models/UserAnswer");
const mongoose = require("mongoose");
const { authenticateToken } = require("../middleware/authenticate");
const { getGrader } = require("../services/grading");
const { getGroundedQuiz } = require("../services/groundedQuiz");

// Every quiz route acts on behalf of the logged-in user. The user id comes
// from the verified JWT, never from the request body or URL.
router.use(authenticateToken);

// Initiate assessment route
router.post("/", async (req, res) => {
  const userId = req.user.userId;
  try {
    // Questions come only from the user's indexed PDF, with page citations.
    const grounded = await getGroundedQuiz().tryGenerate({ userId, body: req.body });
    if (grounded.handled) return res.json(grounded.body);
    if (grounded.indexing) {
      // First use of a PDF (or still processing): indexing has been started.
      return res.status(409).json({
        error: "This PDF is being prepared for cited questions. Try again in a minute.",
        indexing: true,
      });
    }
    if (!req.body.documentId) {
      return res.status(400).json({ error: "Open a PDF to generate questions from it" });
    }
    return res.status(503).json({ error: "Question generation is not available on this server" });
  } catch (err) {
    if (err.status === 404 || err.status === 422) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Question generation failed:", err.message);
    return res.status(502).json({ error: "Question generation failed. Please try again." });
  }
});

// Submit assessment route
router.post("/:quizId/submit", async (req, res) => {
  console.log("Received request to submit answers");
  try {
    const { quizId } = req.params;
    const { answers, timeTaken } = req.body;
    const userId = req.user.userId;
    console.log("answers:", answers);

    if (!quizId || !answers || !userId) {
      return res
        .status(400)
        .json({ error: "Quiz ID, answers, and user ID are required" });
    }

    // Fetch quiz details
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Fetch questions for the quiz and sort by position
    const questions = await Question.find({
      quizeRef: quizId,
      userId: userId,
    }).sort({
      position: 1,
    }); // Sort by position in ascending order

    if (!questions || !questions.length) {
      return res
        .status(404)
        .json({ error: "Questions not found for the quiz" });
    }

    // Convert answers object to array format
    const answersArray = Object.values(answers);

    // Pair each answered question with its answer (by position, not by
    // question text, which breaks when two questions share the same wording).
    const items = [];
    questions.forEach((question, index) => {
      if (answersArray[index]) items.push({ question, userAnswer: answersArray[index] });
    });
    if (!items.length) {
      return res.status(400).json({ error: "No answers to grade" });
    }

    try {
      const evaluations = await getGrader().grade(userId, items);

      let totalScore = 0;
      await Promise.all(
        evaluations.map((evaluation, i) => {
          if (evaluation.is_correct) totalScore += 1;
          return new UserAnswer({
            userId,
            questionId: items[i].question.questionId,
            userAnswer: evaluation.user_answer,
            accuracy: evaluation.accuracy,
            quizId,
            missingPoint: evaluation.missing_points || [],
            isCorrect: evaluation.is_correct,
            verdict: evaluation.verdict,
            feedback: evaluation.feedback || undefined,
            graderVersion: evaluation.grader,
            timeTaken: timeTaken ? timeTaken / questions.length : null, // Approximate time per question
          }).save();
        })
      );

      if (timeTaken) {
        quiz.userTime = timeTaken;
        await quiz.save();
      }

      res.json({
        evaluations: evaluations.map((evaluation, i) => ({
          questionId: items[i].question.questionId,
          status: evaluation.is_correct ? "correct" : "wrong",
          verdict: evaluation.verdict,
          accuracy: evaluation.accuracy,
          user_answer: evaluation.user_answer,
          correct_answer: evaluation.correct_answer,
          question: items[i].question.question,
          missing_points: evaluation.missing_points || [],
          feedback: evaluation.feedback,
          citations: evaluation.citations || [],
          grounded: evaluation.grader === "rag-points-v1",
        })),
        totalScore,
      });
    } catch (error) {
      console.error("Error evaluating answers:", error);
      res.status(error.status === 503 ? 503 : 502).json({
        error: "Evaluation process failed",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
});

// Get quiz results route
router.get("/:quizId/results/:userId", async (req, res) => {
  try {
    const { quizId, userId } = req.params;
    if (userId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to view these results" });
    }

    // Verify quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Get all questions for this quiz in the correct order
    const questions = await Question.find({
      quizeRef: quizId,
      userId: userId,
    }).sort({
      position: 1,
    });

    // Get user answers for this quiz
    const userAnswers = await UserAnswer.find({
      quizId,
      userId,
    });

    if (!userAnswers.length) {
      return res
        .status(404)
        .json({ error: "No answers found for this user and quiz" });
    }

    // Calculate total score
    const totalScore =
      userAnswers.reduce((sum, answer) => sum + answer.accuracy, 0) /
      userAnswers.length;

    // Format detailed results
    const detailedResults = userAnswers.map((answer) => {
      const question = questions.find(
        (q) => q.questionId === answer.questionId
      );
      return {
        questionId: answer.questionId,
        question: question ? question.question : "Question not found",
        userAnswer: answer.userAnswer,
        correctAnswer: question ? question.correctAnswer : "Answer not found",
        accuracy: answer.accuracy,
        isCorrect: answer.isCorrect,
        missingPoints: answer.missingPoint || [],
      };
    });

    res.json({
      quizId,
      userId,
      totalScore,
      timeTaken: quiz.userTime,
      questionCount: questions.length,
      answeredCount: userAnswers.length,
      results: detailedResults,
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({
      error: "Failed to fetch quiz results",
      details: error.message,
    });
  }
});

module.exports = router;
