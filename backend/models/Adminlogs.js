const mongoose = require('mongoose');

const adminLogsSchema = new mongoose.Schema({
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('AdminLog', adminLogsSchema);
  