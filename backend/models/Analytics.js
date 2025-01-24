const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quizResults: [
      {
        quizDate: { type: Date },
        score: { type: Number },
        feedback: { type: String },
      },
    ],
    performanceTrends: {
      daily: { type: String },  // e.g., JSON for retention data
      weekly: { type: String },
      monthly: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('Analytics', analyticsSchema);
  