const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  subjectName: { type: String, required: true },
  startTime: { type: String, required: true }, // Store as string (e.g., "09:00")
  endTime: { type: String, required: true }, // Store as string (e.g., "10:00")
  isFinished: { type: Boolean, default: false }, // New field to track completion status
});

const timetableSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true }, // Day of the week (e.g., "Monday")
    subjects: [subjectSchema],
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('Timetable', timetableSchema);
  