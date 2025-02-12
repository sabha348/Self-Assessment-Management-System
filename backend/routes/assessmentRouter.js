const express = require('express');
const router = express.Router();
const { runPythonProcess } = require('../utils/pythonRunner');
const Question = require('../models/question');

let correct_answers = [];
let questionsArray = [];

// Function to save questions to the database
async function saveQuestions(Formatted_questions, prefix = 'Q') {
  try {
    for (let index = 0; index < Formatted_questions.length; index++) {
      const q = Formatted_questions[index];
      const newQuestion = new Question({
        qid: `${prefix}${index + 1}`,
        type: 'General',
        topic: 'Fruit',
        question: q
      });
      await newQuestion.save();
    }
  } catch (err) {
    console.log(err);
    throw new Error(`Failed to save generated questions: ${err.message}`);
  }
}

// Initiate assessment route
router.post("/", async (req, res) => {
  try {
    const { text, numQuestions = 5 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: "Valid text input is required" });
    }

    const sessionId = Date.now().toString();

    try {
      // Clean text and generate questions
      const cleanText = text.replace(/\r?\n/g, ' ').trim();
      const questions = await runPythonProcess("./python_scripts/questions.py", [
        cleanText,
        numQuestions.toString()
      ]);

      if (!Array.isArray(questions)) {
        throw new Error("Invalid questions format received");
      }

      // Clean questions array
      questionsArray = questions.map(q => q.replace(/\r?\n/g, ' ').trim());

      // Generate correct answers with cleaned data
      const correctAnswers = await runPythonProcess("./python_scripts/correct_answers.py", [
        cleanText,
        JSON.stringify(questionsArray)
      ]);

      if (!Array.isArray(correctAnswers)) {
        throw new Error("Invalid correct answers format received");
      }

      correct_answers = correctAnswers;
      res.json({ sessionId, questions: questionsArray });

    } catch (error) {
      console.error('Processing error:', error);
      res.status(500).json({
        error: "Failed to process text",
        details: error.message
      });
    }
  } catch (error) {
    console.error('Router error:', error);
    res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

// Submit assessment route
router.post("/:sessionId/submit", async (req, res) => {
  console.log("Received request to submit answers");
  try {
    const { answers } = req.body;
    
    // Convert answers object to array format
    const answersArray = Object.values(answers);
    
    // Prepare evaluation data
    const evalData = {
      answers: answersArray,
      correct_answers: correct_answers
    };

    try {
      const results = await runPythonProcess("./python_scripts/evaluate_answers.py", [
        JSON.stringify(evalData)
      ]);

      // Results should already be parsed JSON from pythonRunner
      const formattedResults = results.evaluations.map((evaluation, index) => ({
        status: evaluation.is_correct ? "correct" : "wrong",
        accuracy: evaluation.accuracy,
        user_answer: evaluation.user_answer,
        correct_answer: evaluation.correct_answer,
        ...(evaluation.is_correct ? {} : {
          question: questionsArray[index],
          missing_points: evaluation.missing_points,
        })
      }));

      res.json({
        evaluations: formattedResults,
        totalScore: results.totalScore
      });
    } catch (error) {
      console.error("Error evaluating answers:", error);
      res.status(500).json({
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

module.exports = router;