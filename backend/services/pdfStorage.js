/**
 * Where uploaded PDFs live.
 *
 * - Vercel Blob (private store), when BLOB_READ_WRITE_TOKEN is set: browsers
 *   upload straight to Blob, so PDFs larger than a serverless function's 4.5 MB
 *   request limit work, and the RAG service downloads them itself through a
 *   short-lived signed URL.
 * - MongoDB GridFS otherwise (local development, Docker), as before. Documents
 *   uploaded before Blob existed stay in GridFS and are copied to Blob the first
 *   time they need indexing.
 */
const { Readable } = require('stream');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

const BUCKET = 'pdfFiles';
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '25', 10);

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const userPrefix = (userId) => `pdfs/${userId}/`;

/** Only PDFs, only under the uploader's own folder, no path tricks. */
function isAllowedUploadPath(pathname, userId) {
  return (
    typeof pathname === 'string' &&
    pathname.startsWith(userPrefix(userId)) &&
    !pathname.includes('..') &&
    /\.pdf$/i.test(pathname)
  );
}

const gridfs = () => new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });

function readGridFS(gridFSId) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    gridfs()
      .openDownloadStream(gridFSId)
      .on('data', (c) => chunks.push(c))
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/** Stream a stored PDF to an Express response (streamed: no 4.5 MB response cap). */
async function streamToResponse(doc, res) {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.title || 'document.pdf')}"`);
  if (doc.blobPathname) {
    const { get } = require('@vercel/blob');
    const result = await get(doc.blobPathname, { access: 'private' });
    if (!result || result.statusCode !== 200) return res.status(404).json({ error: 'File not found' });
    return Readable.fromWeb(result.stream).pipe(res);
  }
  if (doc.gridFSId) return gridfs().openDownloadStream(doc.gridFSId).pipe(res);
  return res.json(doc); // very old documents stored inline
}

/** A URL the RAG service can GET for the next few minutes, and nothing else. */
async function signedDownloadUrl(pathname, minutes = 10) {
  const { issueSignedToken, presignUrl } = require('@vercel/blob');
  const validUntil = Date.now() + minutes * 60 * 1000;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  return presignedUrl;
}

/** Move a GridFS-stored PDF into Blob (used once, before indexing it on Vercel). */
async function copyGridFSToBlob(doc, Document) {
  const { put } = require('@vercel/blob');
  const buffer = await readGridFS(doc.gridFSId);
  const safeName = String(doc.title || 'document.pdf').replace(/[^\w.\- ]+/g, '_');
  const blob = await put(`${userPrefix(doc.uploadedBy)}${safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`}`, buffer, {
    access: 'private',
    addRandomSuffix: true,
    contentType: 'application/pdf',
  });
  await Document.updateOne({ _id: doc._id }, { blobPathname: blob.pathname, blobUrl: blob.url, size: buffer.length });
  return blob.pathname;
}

async function deleteStored(doc) {
  if (doc.blobPathname) {
    const { del } = require('@vercel/blob');
    await del(doc.blobPathname);
  }
  if (doc.gridFSId) await gridfs().delete(doc.gridFSId);
}

module.exports = {
  BUCKET,
  MAX_UPLOAD_MB,
  blobEnabled,
  userPrefix,
  isAllowedUploadPath,
  readGridFS,
  streamToResponse,
  signedDownloadUrl,
  copyGridFSToBlob,
  deleteStored,
};
