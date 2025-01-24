const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    content: { type: String, required: true },
    type: { type: String, enum: ['multiple-choice', 'fill-in-the-blank', 'open-ended'], required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    options: [{ type: String }], // Only for multiple-choice questions
    correctAnswer: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('Question', questionSchema);
  