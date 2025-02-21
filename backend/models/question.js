const mongoose = require("mongoose");
const UserAnswer = require("./UserAnswer");

const questionSchema = new mongoose.Schema({
  questionId: {type:String, required: true, unique: true }, // create Qusestion id for each questions
  quizeRef: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz",required: true},
  type: { type: String },
  question: { type: String, required:true },
  options: [{ type: String }], // Only applicable for multiple-choice questions (4 options)
  correctAnswer: { type: String, required: true }, // Stores the correct answer
  topic: {type: String},
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }, // Reference to the user who submitted the
});

module.exports = mongoose.model("Question", questionSchema);
