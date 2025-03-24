const mongoose = require('mongoose');

const assessmentResultSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  assessmentId: {
    type: String,
    required: true
  },
  level: {
    type: String,
    enum: ['subject', 'topic', 'subtopic', 'concept'],
    required: true
  },
  itemName: {
    type: String,
    required: true,
    index: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    required: true
  },
  timeTaken: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  detailedResults: [{
    questionId: String,
    status: {
      type: String,
      enum: ['correct', 'incorrect', 'partial', 'unanswered']
    },
    conceptsEvaluated: [String]
  }],
  parentSubject: { type: String },  // Store parent subject for topics/subtopics/concepts
  parentTopic: { type: String },    // Store parent topic for subtopics/concepts
  parentSubtopic: { type: String }  // Store parent subtopic for concepts
}, { timestamps: true });

// Create composite indexes for better query performance
assessmentResultSchema.index({ userId: 1, level: 1, itemName: 1 });
assessmentResultSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('AssessmentResult', assessmentResultSchema);