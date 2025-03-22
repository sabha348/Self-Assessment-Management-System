const express = require('express');
const router = express.Router();
const { runPythonProcess } = require('../utils/pythonRunner');
const Question = require('../models/Question'); // Corrected case sensitivity
const Quiz = require('../models/Quiz');
const UserAnswer = require('../models/UserAnswer');
const mongoose = require('mongoose');
// Import the text categorizer
const { categorizeText } = require('../utils/TextCategory');

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
    const { 
      text, 
      numQuestions = 5, 
      userId,
      difficulty = 'medium',
      type = 'open-ended',
      timeLimit = 0,
      topic = 'General',
      subject = 'Knowledge'
    } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: "Valid text input is required" });
    }

    // First create a Quiz with the provided values
    let quizId, questionsArray;
    try {
      const quiz = new Quiz({
        numberOfQuestions: numQuestions,
        createdBy: userId,
        difficulty: difficulty,
        type: type,
        topic: topic,
        content: text.substring(0, 1000), // Store a preview of the content
        subject: subject,
        quizTime: timeLimit || 30, // Use provided timeLimit or default
      });

      const savedQuiz = await quiz.save();
      quizId = savedQuiz._id;

      // Pass these parameters to the Python script for better question generation
      const extraParams = [];
      if (difficulty && difficulty !== 'medium') {
        extraParams.push('--difficulty', difficulty);
      }
      if (type && type !== 'open-ended') {
        extraParams.push('--type', type);
      }

      // Clean text and generate questions
      const cleanText = text.replace(/\r?\n/g, ' ').trim();
      
      const questions = await runPythonProcess("./python_scripts/questions.py", [
        cleanText,
        numQuestions.toString(),
        ...extraParams
      ]);

      if (!Array.isArray(questions)) {
        throw new Error("Invalid questions format received");
      }

      // Clean questions array and ensure proper formatting
      questionsArray = questions.map(q => {
        // Remove any leading/trailing quotes, dashes, and whitespace
        return q.replace(/^["\s-]+|["\s]+$/g, '').trim();
      });

      // Categorize the text content
      console.log("Categorizing text content...");
      const categories = await categorizeText(cleanText);
      
      // Update the quiz with category information
      await Quiz.findByIdAndUpdate(quizId, {
        subject: categories.Subject,
        topic: categories.Topic,
        subtopic: categories.Subtopic,
        concept: categories.Concept
      });

      console.log('questionsinitial:',questionsArray);
      
      // Include categories in the response
      res.json({ 
        quizId,
        questions: questionsArray,
        categories: categories
      });

      // After sending response, continue with background processing
      console.log("Generating correct answers in the background...");
      
      // Background processing wrapped in its own try/catch
      try {
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

        // Save questions with quiz reference and updated categories
        const savePromises = [];
        for (let i = 0; i < questionsArray.length; i++) {
          const newQuestion = new Question({
            questionId: `Q${Date.now()}${i}`,
            quizeRef: quizId,
            question: questionsArray[i],
            correctAnswer: cleanedCorrectAnswers[i],
            userId: userId,
            type: quiz.type,
            // These will be automatically populated by our middleware if missing
            subject: quiz.subject,
            topic: quiz.topic,
            subtopic: quiz.subtopic,
            concept: quiz.concept,
            difficulty: quiz.difficulty
          });
          savePromises.push(newQuestion.save());
        }

        await Promise.all(savePromises);
        console.log("Background processing completed successfully");
      } catch (bgError) {
        // Just log errors in background processing, don't crash
        console.error('Background processing error:', bgError);
        
        // If needed, update quiz status to indicate an error
        await Quiz.findByIdAndUpdate(quizId, { status: 'error' });
      }

    } catch (error) {
      console.error('Processing error:', error);
      // Only send error response if we haven't already sent a response
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to process text",
          details: error.message
        });
      }
    }
  } catch (error) {
    console.error('Router error:', error);
    // Only send error response if we haven't already sent a response
    if (!res.headersSent) {
      res.status(500).json({
        error: "Server error",
        details: error.message
      });
    }
  }
});

// Submit assessment route
router.post("/:quizId/submit", async (req, res) => {
  console.log("Received request to submit answers");
  try {
    const { quizId } = req.params;
    const { answers, userId, timeTaken } = req.body;
    console.log('answers:', answers);

    if (!quizId || !answers || !userId) {
      return res.status(400).json({ error: "Quiz ID, answers, and user ID are required" });
    }
    
    // Convert answers object to array format
    const answersArray = Object.values(answers);

    // Fetch quiz details
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    // Fetch questions for the quiz
    const questions = await Question.find({ quizeRef: quizId });
    if (!questions || !questions.length) {
      return res.status(404).json({ error: "Questions not found for the quiz" });
    }

    console.log('questions:',questions);
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

    
    // Prepare evaluation data
    const evalData = {
      answers: userAnswersData,
      correct_answers: correctAnswersData
    };
    console.log('evaldata:',evalData);

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