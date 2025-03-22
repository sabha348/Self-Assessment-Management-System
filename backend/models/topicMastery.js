const mongoose = require('mongoose');

const topicMasterySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index to ensure uniqueness of userId + topic combinations
topicMasterySchema.index({ userId: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('TopicMastery', topicMasterySchema);