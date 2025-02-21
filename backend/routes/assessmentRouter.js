const express = require('express');
const router = express.Router();
const { runPythonProcess } = require('../utils/pythonRunner');
const Question = require('../models/question'); // Corrected case sensitivity
const Quiz = require('../models/Quiz');
const UserAnswer = require('../models/UserAnswer');
const mongoose = require('mongoose');

// let correct_answers = [];
// let questionsArray = [];

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
    const { text, numQuestions = 5, userId } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: "Valid text input is required" });
    }

    try {
      // First create a Quiz
      const quiz = new Quiz({
        numberOfQuestions: numQuestions,
        createdBy: userId,
        difficulty: 'medium',
        type: 'open-ended',
        topic: 'General',
        content: text.substring(0, 1000), // Store a preview of the content
        subject: 'Knowledge',
        quizTime: 30, // Default time limit in minutes
      });

      const savedQuiz = await quiz.save();
      const quizId = savedQuiz._id; // Get the quiz ID

      // Clean text and generate questions
      const cleanText = text.replace(/\r?\n/g, ' ').trim();
      try {
        const questions = await runPythonProcess("./python_scripts/questions.py", [
          cleanText,
          numQuestions.toString()
        ]);

        if (!Array.isArray(questions)) {
          throw new Error("Invalid questions format received");
        }

        // Clean questions array and ensure proper formatting
        const questionsArray = questions.map(q => {
          // Remove any leading/trailing quotes, dashes, and whitespace
          return q.replace(/^["\s-]+|["\s]+$/g, '').trim();
        });

        // Generate correct answers with cleaned data
        const correctAnswers = await runPythonProcess("./python_scripts/correct_answers.py", [
          cleanText,
          JSON.stringify(questionsArray) // Send cleaned questions array
        ]);

        if (!Array.isArray(correctAnswers)) {
          throw new Error("Invalid correct answers format received");
        }

        // Clean correct answers array
        const cleanedCorrectAnswers = correctAnswers.map(a => 
          typeof a === 'string' ? a.trim() : String(a)
        );

        // Save questions with quiz reference
        for (let i = 0; i < questionsArray.length; i++) {
          const newQuestion = new Question({
            questionId: `Q${Date.now()}${i}`,
            quizeRef: quizId, // Add the quiz reference here
            question: questionsArray[i],
            correctAnswer: cleanedCorrectAnswers[i],
            userId: userId,
            type: 'open-ended'
          });
          await newQuestion.save();
        }

        res.json({ 
          quizId,
          questions: questionsArray 
        });

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
  } catch (error) {
    console.error('Router error:', error);
    res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

// Submit assessment route
router.post("/:quizId/submit", async (req, res) => {
  console.log("Received request to submit answers");
  try {
    const { quizId } = req.params;
    const { answers, userId, timeTaken } = req.body;

    if (!quizId || !answers || !userId) {
      return res.status(400).json({ error: "Quiz ID, answers, and user ID are required" });
    }

    console.log(answers);
    
    // Convert answers object to array format
    const answersArray = Object.values(answers);

    // Fetch quiz details
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    // Fetch questions for the quiz
    const questions = await Question.find({ quizRef: quiz.quizId });
    if (!questions || !questions.length) {
      return res.status(404).json({ error: "Questions not found for the quiz" });
    }
     // Format data for evaluation
     let questionsData = [];
     let userAnswersData = [];
     let correctAnswersData = [];

    questions.forEach((question, index) => {
      // const questionId = q.questionId;
      if (answersArray[index]) {
        questionsData.push(question.question);
        userAnswersData.push(answersArray[index]);
        correctAnswersData.push(question.correctAnswer);
      }
    });        

    console.log(questionsData);
    
    // Prepare evaluation data
    const evalData = {
      answers: userAnswersData,
      correct_answers: correctAnswersData
    };

    try {
      const results = await runPythonProcess("./python_scripts/evaluate_answers.py", [
        JSON.stringify(evalData)
      ]);

     // Store user answers and evaluation results
     const userAnswerPromises = [];
     let totalScore = 0;

     for (let i = 0; i < results.evaluations.length; i++) {
       const evaluation = results.evaluations[i];
       const question = questions.find(q => q.question === questionsData[i]);
       
       if (question) {
         const userAnswer = new UserAnswer({
           userId,
           questionId: question.questionId,
           userAnswer: evaluation.user_answer,
           accuracy: evaluation.accuracy,
           quizId,
           missingPoint: evaluation.missing_points || [],
           isCorrect: evaluation.is_correct,
           timeTaken: timeTaken ? (timeTaken / questions.length) : null // Approximate time per question
         });
         
         userAnswerPromises.push(userAnswer.save());
         if(evaluation.is_correct){
          totalScore += 1;
         }
       }
     }

     // Update quiz with user completion time
     if (timeTaken) {
       quiz.userTime = timeTaken;
       await quiz.save();
     }

     // Wait for all user answers to be saved
     await Promise.all(userAnswerPromises);


      // Results should already be parsed JSON from pythonRunner
      const formattedResults = results.evaluations.map((evaluation, index) => ({
        questionId: questions.find(q => q.question === questionsData[index])?.questionId,
        status: evaluation.is_correct ? "correct" : "wrong",
        accuracy: evaluation.accuracy,
        user_answer: evaluation.user_answer,
        correct_answer: evaluation.correct_answer,
        ...(evaluation.is_correct ? {} : {
          question: questionsData[index],
          missing_points: evaluation.missing_points || [],
        })
      }));

      res.json({
        evaluations: formattedResults,
        totalScore: results.totalScore || (totalScore / questionsData.length)
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


// Get quiz results route
router.get("/:quizId/results/:userId", async (req, res) => {
  try {
    const { quizId, userId } = req.params;
    
    // Verify quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    
    // Get all questions for this quiz
    const questions = await Question.find({ quizRef: quizId });
    
    // Get user answers for this quiz
    const userAnswers = await UserAnswer.find({ 
      quizId, 
      userId
    });
    
    if (!userAnswers.length) {
      return res.status(404).json({ error: "No answers found for this user and quiz" });
    }
    
    // Calculate total score
    const totalScore = userAnswers.reduce((sum, answer) => sum + answer.accuracy, 0) / userAnswers.length;
    
    // Format detailed results
    const detailedResults = userAnswers.map(answer => {
      const question = questions.find(q => q.questionId === answer.questionId);
      return {
        questionId: answer.questionId,
        question: question ? question.question : "Question not found",
        userAnswer: answer.userAnswer,
        correctAnswer: question ? question.correctAnswer : "Answer not found",
        accuracy: answer.accuracy,
        isCorrect: answer.isCorrect,
        missingPoints: answer.missingPoint || []
      };
    });
    
    res.json({
      quizId,
      userId,
      totalScore,
      timeTaken: quiz.userTime,
      questionCount: questions.length,
      answeredCount: userAnswers.length,
      results: detailedResults
    });
    
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({
      error: "Failed to fetch quiz results",
      details: error.message
    });
  }
});

module.exports = router;