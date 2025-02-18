const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  type: { type: String },
  quizeRef: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz",required: true},
  questionId: {type:String, required: true, unique: true }, // create Qusestion id for each questions
  content: { type: String, required: true }, // The question text
  options: [{ type: String }], // Only applicable for multiple-choice questions (4 options)
  correctAnswer: { type: String, required: true }, // Stores the correct answer
  userAnswer: { type: String }, // Stores the user's submitted answer
  accuracy: { type: Number, min: 0, max: 100 }, // Accuracy percentage (0-100)
  missingPoint: { type: String }, // Explanation of missing points in user's answer
});

module.exports = mongoose.model("Question", questionSchema);
