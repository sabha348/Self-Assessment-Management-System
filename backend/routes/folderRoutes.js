const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const Document = require('../models/Document');
const { authenticateToken } = require('../middleware/authenticate');

// Get all folders for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const folders = await Folder.find({ createdBy: req.user.userId });
    res.status(200).json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Create a new folder
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    
    const newFolder = new Folder({
      name,
      createdBy: req.user.userId,
      parentId: parentId || null
    });
    
    await newFolder.save();
    res.status(201).json(newFolder);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Rename a folder
router.put('/:id/rename', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;
    const userId = req.user.userId;
    
    const folder = await Folder.findById(id, { createdBy: userId });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check ownership
    if (folder.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    folder.name = newName;
    await folder.save();
    
    res.status(200).json(folder);
  } catch (error) {
    console.error('Error renaming folder:', error);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// Delete a folder and its contents
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const folder = await Folder.findById(id, { createdBy: userId });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check ownership
    if (folder.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Delete all files in this folder
    await Document.deleteMany({ folderId: id, uploadedBy: userId });
    
    // Delete the folder itself
    await Folder.findByIdAndDelete(id, { createdBy: userId });
    
    res.status(200).json({ message: 'Folder and contents deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

module.exports = router;