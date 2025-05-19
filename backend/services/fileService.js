const multer = require('multer');
const Document = require('../models/Document');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const stream = require('stream');

// Configure multer to store in memory instead of disk
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// File upload route handler
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: 'pdfFiles' });
    
    // Create a readable stream from buffer
    const readableStream = new stream.PassThrough();
    readableStream.end(req.file.buffer);
    
    // Create upload stream to GridFS
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      metadata: {
        uploadedBy: req.user.userId,
        fileType: 'PDF',
        folderId: null
      }
    });
    
    // Track the file ID
    const fileId = uploadStream.id;
    
    // Stream the file to GridFS
    readableStream.pipe(uploadStream);
    
    // Handle upload completion
    uploadStream.on('finish', async () => {
      // Create a minimal document reference
      const docRef = new Document({
        title: req.file.originalname,
        fileType: 'PDF',
        uploadedBy: req.user.userId,
        gridFSId: fileId, // Store reference to GridFS file
        folderId: null
      });
      
      await docRef.save();
      
      res.status(200).json({
        message: 'File uploaded successfully',
        _id: docRef._id,
        title: docRef.title
      });
    });
    
    uploadStream.on('error', (error) => {
      console.error('GridFS upload error:', error);
      res.status(500).json({ error: 'File upload failed' });
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
  try {
    const docRef = await Document.findById(req.params.id);
    if (!docRef) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check ownership
    if (docRef.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }
    
    if (docRef.gridFSId) {
      // Get file from GridFS
      const db = mongoose.connection.db;
      const bucket = new GridFSBucket(db, { bucketName: 'pdfFiles' });
      
      // Set appropriate headers
      res.set('Content-Type', 'application/pdf');
      
      // Content-Disposition header with the filename from document title
      // Use a more standardized header format
      const safeFilename = encodeURIComponent(docRef.title || 'document.pdf');
      res.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
      // Stream file to response
      bucket.openDownloadStream(docRef.gridFSId).pipe(res);
    } else {
      // For backward compatibility - files stored directly in document
      res.json(docRef);
    }
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: 'Error fetching file' });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the document first to get GridFS ID
    const file = await Document.findById(id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check ownership
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }
    
    // If file is stored in GridFS, delete it from there first
    if (file.gridFSId) {
      const db = mongoose.connection.db;
      const bucket = new GridFSBucket(db, { bucketName: 'pdfFiles' });
      
      try {
        // Delete the file from GridFS
        await bucket.delete(file.gridFSId);
        console.log(`GridFS file ${file.gridFSId} deleted successfully`);
      } catch (gridFsError) {
        console.error('Error deleting from GridFS:', gridFsError);
        // Continue with document deletion even if GridFS deletion fails
        // This prevents orphaned references
      }
    }
    
    // Then delete the document reference
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