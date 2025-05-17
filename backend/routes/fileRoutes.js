const express = require('express');
const router = express.Router();
const { getFiles, getFileById, uploadFile, deleteFile, upload } = require('../services/fileService');
const {authenticateToken} = require('../middleware/authenticate');
const Document = require('../models/Document');

router.post('/upload', authenticateToken, upload.single('file'), uploadFile);
router.get('/', authenticateToken, getFiles);
router.get('/:id', authenticateToken, getFileById);
router.delete('/:id', authenticateToken, deleteFile);

// Rename a file
router.put('/:id/rename', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;
    const userId = req.user.userId;

    const file = await Document.findById(id, { uploadedBy: userId });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check ownership
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    file.title = newName;
    await file.save();
    
    res.status(200).json(file);
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// Move a file to a folder
router.put('/:id/move', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;
    const userId  = req.user.userId;

    const file = await Document.findById(id, { uploadedBy: userId });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check ownership
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    file.folderId = folderId || null;
    await file.save();
    
    res.status(200).json(file);
  } catch (error) {
    console.error('Error moving file:', error);
    res.status(500).json({ error: 'Failed to move file' });
  }
});

module.exports = router;
