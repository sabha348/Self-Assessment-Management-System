const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  mobileno: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  membership: { 
    type: String, 
    enum: ['free', 'premium'], 
    default: 'free' 
  },
  createdAt: { type: Date, default: Date.now },
  preferences: {
    questionConfig: {
      numQuestions: { type: Number, default: 5 },
      difficulty: { type: String, default: 'medium' },
      questionTypes: [{ type: String }],
      timeLimit: { type: Number, default: 0 }
    }
  }
});

module.exports = mongoose.model('User', userSchema);
