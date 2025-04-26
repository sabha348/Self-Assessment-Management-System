const express = require('express');
const router = express.Router();
const { getFiles, getFileById, uploadFile, deleteFile, upload } = require('../services/fileService');
const {authenticateToken} = require('../middleware/authenticate');


// Protect file upload and deletion routes
router.post('/upload', authenticateToken, upload.single('file'), uploadFile);
router.get('/', authenticateToken, getFiles);
router.get('/:id', authenticateToken, getFileById);
router.delete('/:id', authenticateToken, deleteFile);


module.exports = router;
