const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const answerSchema = new Schema({
    aid: { type: String, required: true },
    qid: { type: String, required: true, ref: 'Question' },
    answer: { type: String, required: true }
});

module.exports = mongoose.model('Answer', answerSchema);


