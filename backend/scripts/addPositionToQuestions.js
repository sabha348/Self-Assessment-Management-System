const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const connectDB = require('../config/db');

async function addPositionToQuestions() {
  await connectDB();
  console.log('Connected to database');
  
  // Get all quizzes
  const quizzes = await Quiz.find({});
  console.log(`Found ${quizzes.length} quizzes to process`);
  
  let updated = 0;
  
  for (const quiz of quizzes) {
    // Get all questions for this quiz
    const questions = await Question.find({ quizeRef: quiz._id });
    
    // Sort questions by their creation time (using ObjectId creation time)
    questions.sort((a, b) => {
      return a._id.getTimestamp() - b._id.getTimestamp();
    });
    
    // Update the position field
    for (let i = 0; i < questions.length; i++) {
      questions[i].position = i;
      await questions[i].save();
      updated++;
    }
    
    console.log(`Updated position for ${questions.length} questions in quiz ${quiz._id}`);
  }
  
  console.log(`Successfully updated ${updated} questions with position values`);
  process.exit(0);
}

addPositionToQuestions().catch(err => {
  console.error('Error in migration script:', err);
  process.exit(1);
});