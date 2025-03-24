const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Quiz = require('./Quiz'); // Import Quiz model

const questionSchema = new Schema({
  questionId: { type: String, required: true },
  quizeRef: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
  question: { type: String, required: true },
  options: { type: [String] },
  correctAnswer: { type: String, required: true },
  type: { type: String, default: 'multiple-choice' },
  // Add position field to maintain question order
  position: { type: Number, required: true, default: 0 },
  // Hierarchical fields
  subject: { type: String },
  topic: { type: String },
  subtopic: { type: String },
  concept: { type: String },
  difficulty: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }
});

// Pre-save middleware to automatically populate hierarchical fields from Quiz
questionSchema.pre('save', async function(next) {
  // Only run this if hierarchical fields are missing
  if (!this.subject || !this.topic || !this.subtopic || !this.concept || !this.difficulty) {
    try {
      // Find the parent Quiz document
      const quiz = await Quiz.findById(this.quizeRef);
      
      if (quiz) {
        // Inherit the hierarchical data
        this.subject = quiz.subject || this.subject;
        this.topic = quiz.topic || this.topic;
        this.subtopic = quiz.subtopic || this.subtopic;
        this.concept = quiz.concept || this.concept;
        this.difficulty = quiz.difficulty || this.difficulty;
      }
    } catch (error) {
      console.error('Error in Question pre-save middleware:', error);
    }
  }
  next();
});

module.exports = mongoose.model("Question", questionSchema);
