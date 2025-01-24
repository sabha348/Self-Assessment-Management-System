const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String }, // Extracted content
    fileType: { type: String, enum: ['PDF', 'DOCX', 'TXT'] },
    filePath: { type: String }, // File path for uploaded documents
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('Document', documentSchema);
  