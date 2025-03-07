const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true }, // Day of the week (e.g., "Monday")
    subjectName: { type: String, required: true },
    startTime: { type: String, required: true }, // Store as string (e.g., "09:00")
    endTime: { type: String, required: true }, // Store as string (e.g., "10:00")
    isFinished: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

// Compound index to ensure unique combination of user, day, and time slots
timetableSchema.index({ user: 1, day: 1, startTime: 1, endTime: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);