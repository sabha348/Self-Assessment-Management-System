const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  // Make content optional since we're using GridFS for storage
  content: {
    type: String,
    required: false // Change from true to false
  },
  // Add GridFS ID field
  gridFSId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Indexing in the RAG service (chunks + embeddings for grounded questions).
  ragStatus: {
    type: String,
    enum: ['none', 'pending', 'processing', 'ready', 'failed'],
    default: 'none'
  },
  ragError: { type: String },
  ragPages: { type: Number },
  ragChunks: { type: Number },
  ragIndexedAt: { type: Date }
});

module.exports = mongoose.model('Document', DocumentSchema);
