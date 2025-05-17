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
      uploadedBy: req.user.userId,
      folderId: null // Default to no folder, will be updated later
    });

    await newDocument.save();
    
    res.status(200).json({
      message: 'File uploaded successfully',
      _id: newDocument._id,
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
    const { folderId } = req.query;
    
    // Build query based on user ID and optional folder ID
    const query = { uploadedBy: req.user.userId };
    
    // If folderId is specified, filter by that folder
    if (folderId) {
      query.folderId = folderId;
    }
    
    const files = await Document.find(query)
      .select('-content')  // Exclude the content field
      .sort({ createdAt: -1 }); // Sort by newest first
      
    res.status(200).json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

const getFileById = async (req, res) => {
  const userId = req.user.userId;
  try {
    const file = await Document.findById(req.params.id, { uploadedBy: userId });
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check ownership
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }
    
    res.json(file); 
  } catch (error) {
    res.status(500).json({ error: 'Error fetching file' });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    
    const file = await Document.findById(id, { uploadedBy: userId });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check ownership
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }
    
    await Document.findByIdAndDelete(id, { uploadedBy: userId });
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