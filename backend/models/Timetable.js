const mongoose = require('mongoose');


const timetableSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    schedule: [
      {
        subject: { type: String },
        startTime: { type: Date },
        endTime: { type: Date },
      },
    ],
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('Timetable', timetableSchema);
  