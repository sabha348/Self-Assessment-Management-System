const mongoose = require('mongoose');

const breakEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: ['notification_shown', 'break_taken', 'break_ignored'],
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Create composite indexes for better query performance
breakEventSchema.index({ userId: 1, eventType: 1 });
breakEventSchema.index({ userId: 1, timestamp: -1 });

const BreakEvent = mongoose.model('BreakEvent', breakEventSchema);
module.exports = BreakEvent;