const express = require('express');
const router = express.Router();
const {
  getFiles, getFileById, uploadFile, deleteFile, upload, getUploadMode, handleBlobUpload, registerBlobUpload,
} = require('../services/fileService');
const {authenticateToken} = require('../middleware/authenticate');
const Document = require('../models/Document');
const { ragClient } = require('../utils/ragClient');
const { getIndexer } = require('../services/ragIndexer');

router.get('/upload-mode', authenticateToken, getUploadMode);
router.post('/upload', authenticateToken, upload.single('file'), uploadFile);
// Vercel Blob client uploads. The token request comes from the browser with the
// user's JWT; Blob's own completion callback carries no JWT and is verified by
// handleUpload's signature check instead.
router.post('/blob-upload', (req, res, next) => {
  if (req.body && req.body.type === 'blob.upload-completed') return handleBlobUpload(req, res);
  return authenticateToken(req, res, () => handleBlobUpload(req, res, next));
});
router.post('/register', authenticateToken, registerBlobUpload);
router.get('/', authenticateToken, getFiles);
router.get('/:id', authenticateToken, getFileById);

// Indexing status for grounded (cited) questions: none | pending | processing | ready | failed
router.get('/:id/rag-status', authenticateToken, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, uploadedBy: req.user.userId })
      .select('ragStatus ragError ragPages ragChunks ragIndexedAt');
    if (!doc) return res.status(404).json({ error: 'File not found' });
    res.json({
      enabled: ragClient.isEnabled(),
      status: doc.ragStatus || 'none',
      error: doc.ragError,
      pages: doc.ragPages,
      chunks: doc.ragChunks,
      indexedAt: doc.ragIndexedAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read indexing status' });
  }
});

// (Re)index a file, e.g. one uploaded before indexing existed, or after a failure.
router.post('/:id/index', authenticateToken, async (req, res) => {
  try {
    if (!ragClient.isEnabled()) return res.status(503).json({ error: 'Indexing is not enabled' });
    const doc = await Document.findOne({ _id: req.params.id, uploadedBy: req.user.userId });
    if (!doc) return res.status(404).json({ error: 'File not found' });
    if (['pending', 'processing'].includes(doc.ragStatus)) return res.status(202).json({ status: doc.ragStatus });
    await getIndexer().scheduleIndex(doc._id);
    res.status(202).json({ status: 'pending' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start indexing' });
  }
});
router.delete('/:id', authenticateToken, deleteFile);

// Rename a file
router.put('/:id/rename', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;
    const userId = req.user.userId;

    console.log("User ID:", userId);

    const file = await Document.findById(id);

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

    const file = await Document.findById(id);

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
