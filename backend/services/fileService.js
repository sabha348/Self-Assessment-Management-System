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
      uploadedBy: req.user.userId // Uncomment when auth is implemented
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

const getFiles = async (req, res) => {
  try {
    const files = await Document.find({ uploadedBy: req.user.userId})
    .select('-content')  // Exclude the content field
    .sort({ createdAt: -1 }); // Sort by newest first
      
    res.status(200).json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

const getFileById = async (req, res) => {
  try {
    const file = await Document.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json(file);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching file' });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    await Document.findByIdAndDelete(id);
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

module.exports = {
  upload,
  uploadFile,
  getFiles,
  getFileById,
  deleteFile
};