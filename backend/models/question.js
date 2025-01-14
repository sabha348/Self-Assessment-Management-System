const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const questionSchema = new Schema({
    qid: { type: String },
    type: { type: String },
    topic: { type: String},
    question: { type: String, required: true, ref:'Answer' },
});


module.exports = mongoose.model('Question', questionSchema);


