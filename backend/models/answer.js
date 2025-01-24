const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    answer: { type: String, required: true },
    feedback: { type: String },
    grade: { type: Number },
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('Answer', answerSchema);
  
  