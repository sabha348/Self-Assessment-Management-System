const multer = require('multer');
const stream = require('stream');
const Document = require('../models/Document');
const { getIndexer } = require('./ragIndexer');
const { ragClient } = require('../utils/ragClient');
const pdfStorage = require('./pdfStorage');

// Direct uploads (local / Docker): the file arrives in the request and goes to GridFS.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: pdfStorage.MAX_UPLOAD_MB * 1024 * 1024 },
});

async function startIndexing(docId) {
  try {
    return (await getIndexer().scheduleIndex(docId)) ? 'pending' : 'none';
  } catch (e) {
    console.error('Could not schedule RAG indexing:', e.message);
    return 'none';
  }
}

/** Which upload path the browser should use. */
const getUploadMode = (req, res) => {
  res.json({ mode: pdfStorage.blobEnabled() ? 'blob' : 'direct', maxMb: pdfStorage.MAX_UPLOAD_MB });
};

/**
 * Vercel Blob client uploads. The browser asks this route for a short-lived
 * upload token (needs the user's JWT), then uploads straight to Blob, so the
 * PDF never passes through this function's 4.5 MB request limit.
 */
const handleBlobUpload = async (req, res) => {
  if (!pdfStorage.blobEnabled()) return res.status(404).json({ error: 'Blob uploads are not enabled' });
  const { handleUpload } = require('@vercel/blob/client');
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Only reached from the authenticated token request (see route).
        if (!pdfStorage.isAllowedUploadPath(pathname, req.user.userId)) {
          throw new Error('Uploads must be PDFs in your own folder');
        }
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: pdfStorage.MAX_UPLOAD_MB * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: req.user.userId }),
        };
      },
      // The document is registered by POST /register after the browser's upload
      // resolves (this callback does not fire for localhost, and the register step
      // also re-checks ownership), so there is nothing to do here.
      onUploadCompleted: async () => {},
    });
    res.json(json);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/** After a Blob upload: verify the file exists and belongs to the user, then record it. */
const registerBlobUpload = async (req, res) => {
  if (!pdfStorage.blobEnabled()) return res.status(404).json({ error: 'Blob uploads are not enabled' });
  const { pathname, title } = req.body || {};
  const userId = req.user.userId;
  if (!pdfStorage.isAllowedUploadPath(pathname, userId)) {
    return res.status(403).json({ error: 'Not your upload' });
  }
  try {
    const { head } = require('@vercel/blob');
    const meta = await head(pathname);
    const existing = await Document.findOne({ blobPathname: meta.pathname, uploadedBy: userId });
    const doc =
      existing ||
      (await new Document({
        title: String(title || pathname.split('/').pop()).slice(0, 300),
        fileType: 'PDF',
        uploadedBy: userId,
        blobPathname: meta.pathname,
        blobUrl: meta.url,
        size: meta.size,
        folderId: null,
      }).save());
    const ragStatus = existing ? existing.ragStatus : await startIndexing(doc._id);
    res.status(200).json({ message: 'File uploaded successfully', _id: doc._id, title: doc.title, ragStatus });
  } catch (error) {
    console.error('Register upload error:', error.message);
    res.status(404).json({ error: 'Uploaded file not found' });
  }
};

// Direct upload route handler (GridFS)
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { GridFSBucket } = require('mongodb');
    const mongoose = require('mongoose');
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: pdfStorage.BUCKET });
    const readableStream = new stream.PassThrough();
    readableStream.end(req.file.buffer);
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      metadata: { uploadedBy: req.user.userId, fileType: 'PDF', folderId: null },
    });
    const fileId = uploadStream.id;
    readableStream.pipe(uploadStream);

    uploadStream.on('finish', async () => {
      const docRef = await new Document({
        title: req.file.originalname,
        fileType: 'PDF',
        uploadedBy: req.user.userId,
        gridFSId: fileId,
        size: req.file.size,
        folderId: null,
      }).save();
      const ragStatus = await startIndexing(docRef._id);
      res.status(200).json({ message: 'File uploaded successfully', _id: docRef._id, title: docRef.title, ragStatus });
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
    const query = { uploadedBy: req.user.userId };
    if (req.query.folderId) query.folderId = req.query.folderId;
    const files = await Document.find(query).select('-content').sort({ createdAt: -1 });
    res.status(200).json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

const getFileById = async (req, res) => {
  try {
    const docRef = await Document.findById(req.params.id);
    if (!docRef) return res.status(404).json({ error: 'File not found' });
    if (docRef.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }
    await pdfStorage.streamToResponse(docRef, res);
  } catch (error) {
    console.error('Error fetching file:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Error fetching file' });
  }
};

const deleteFile = async (req, res) => {
  try {
    const file = await Document.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }
    try {
      await pdfStorage.deleteStored(file);
    } catch (storageError) {
      // Continue: removing the record matters more than an orphaned blob.
      console.error('Error deleting stored PDF:', storageError.message);
    }
    if (ragClient.isEnabled()) {
      try {
        await ragClient.deleteDocument({ documentId: file._id, userId: file.uploadedBy });
      } catch (ragError) {
        console.error('Error deleting from RAG index:', ragError.message);
      }
    }
    await Document.findByIdAndDelete(req.params.id);
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
  deleteFile,
  getUploadMode,
  handleBlobUpload,
  registerBlobUpload,
};
