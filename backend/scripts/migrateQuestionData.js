const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const connectDB = require('../config/db');

async function migrateQuestionData() {
  await connectDB();
  console.log('Connected to database');
  
  const questions = await Question.find({
    $or: [
      { subject: { $exists: false } },
      { topic: { $exists: false } },
      { subtopic: { $exists: false } },
      { concept: { $exists: false } }
    ]
  });
  
  console.log(`Found ${questions.length} questions to update`);
  
  let updated = 0;
  for (const question of questions) {
    try {
      const quiz = await Quiz.findById(question.quizeRef);
      if (quiz) {
        question.subject = quiz.subject || question.subject;
        question.topic = quiz.topic || question.topic;
        question.subtopic = quiz.subtopic || question.subtopic;
        question.concept = quiz.concept || question.concept;
        question.difficulty = quiz.difficulty || question.difficulty;
        await question.save();
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`Updated ${updated} questions`);
        }
      }
    } catch (error) {
      console.error(`Error updating question ${question._id}:`, error);
    }
  }
  
  console.log(`Successfully updated ${updated} out of ${questions.length} questions`);
  process.exit(0);
}

migrateQuestionData();