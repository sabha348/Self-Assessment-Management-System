const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  numberOfQuestions: { type: Number, required: true }, // Total number of questions in the quiz
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to the user who created the quiz
  createdAt: { type: Date, default: Date.now }, // Timestamp when the quiz was created
  difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true }, // Difficulty level of the quiz
  type: { 
    type: String, 
    enum: ["open-ended", "fill-in-the-blanks", "mcq", "msq", "mix"], 
    required: true 
  }, // Type of quiz format, including MCQ, MSQ, and mixed types
  grade: { type: String }, // Grade or level for which the quiz is designed
  topic: { type: String, required: true }, // The specific topic of the quiz
  subject: { type: String, required: true }, // Subject category of the quiz
  quizTime: { type: Number, required: true }, // Total time allocated for the quiz (in minutes)
  userTime: { type: Number }, // Time taken by the user to complete the quiz
});

module.exports = mongoose.model("Quiz", quizSchema);
