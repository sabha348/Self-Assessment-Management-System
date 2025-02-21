const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const useranswerSchema = new Schema({
    userId: { type: String, required: true },
    questionId: { type: String, required: true, ref: 'Question' },
    userAnswer: { type: String, required: true },
    accuracy: { type: Number, min: 0, max: 100 }, // Accuracy percentage (0-100)
    timeTaken: { type: Number, min: 0 }, // Time taken to answer the question (in seconds)
    quizId: { type: String, required: true, ref: 'Quiz' },
    AnsweredAt: { type: Date, default: Date.now },
    missingPoint: { type: [String] }, // Explanation of missing points in user's answer
    isCorrect: { type: Boolean }, // Whether the answer is correct or not
});

module.exports = mongoose.model('UserAnswer', useranswerSchema);


