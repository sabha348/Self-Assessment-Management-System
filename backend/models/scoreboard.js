const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const scoreboardSchema = new Schema({
    sid: { type: String, required: true, unique: true },
    score: { type: Int32, required: true},
    Timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Scoreboard', scoreboardSchema);


