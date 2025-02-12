const express = require('express');
const router = express.Router();
const { getFiles,getFileById, uploadFile, deleteFile } = require('../services/fileService');
const { upload } = require('../services/fileService');

router.post('/upload', upload.single('file'), uploadFile);
router.get('/', getFiles);
router.get('/:id', getFileById);
router.delete('/:id', deleteFile);

module.exports = router;