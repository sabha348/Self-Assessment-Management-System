const mongoose = require('mongoose');

const assessmentResultSchema = new mongoose.Schema({
  //to identify user
  userId: {
    type: String,
    required: true,
    index: true
  },
  //to identify level which card belongs on which practice clicked
  level: {
    type: String,
    enum: ['subject', 'topic', 'subtopic', 'concept'],
    required: true
  },
  //to identify name of card on which practice clicked
  itemName: {
    type: String,
    required: true,
    index: true
  },
  //for skill analysis, asking questions
  score: {
    type: Number,
    required: true
  },
  //calculate score 
  totalQuestions: {
    type: Number,
    required: true
  },
  //to track speed
  timeTaken: {
    type: Number,
    default: 0
  },
  //for history and calculating score
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  questioninfo:[{
    questionId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['correct', 'incorrect', 'partial', 'unanswered'],
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    }
  }]
}, { timestamps: true });

// Create composite indexes for better query performance
assessmentResultSchema.index({ userId: 1, level: 1, itemName: 1 });
assessmentResultSchema.index({ userId: 1, date: -1 });
assessmentResultSchema.index({ userId: 1, 'questioninfo.questionId': 1 });

module.exports = mongoose.model('AssessmentResult', assessmentResultSchema);