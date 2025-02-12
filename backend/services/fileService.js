const multer = require('multer');
const Document = require('../models/Document');

// Configure multer to store in memory instead of disk
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// File upload route handler
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create new document in MongoDB
    const newDocument = new Document({
      title: req.file.originalname,
      content: req.file.buffer.toString('base64'), // Store file as base64
      fileType: 'PDF',
      // uploadedBy: req.user._id  // Uncomment when auth is implemented
    });

    await newDocument.save();
    
    res.status(200).json({
      message: 'File uploaded successfully',
      documentId: newDocument._id,
      title: newDocument.title,
      content: newDocument.content // Send back the base64 content
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
};

module.exports = {
  upload,
  uploadFile
};