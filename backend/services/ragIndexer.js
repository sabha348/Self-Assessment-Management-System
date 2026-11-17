/**
 * Background indexing of uploaded PDFs into the RAG service.
 *
 * Indexing a long book takes minutes (the embedding API is rate limited),
 * so uploads return immediately and indexing runs in the background; the
 * Document's ragStatus (pending -> processing -> ready | failed) is what the
 * UI polls.
 */
const { readGridFS } = require('./pdfStorage');

function createIndexer({
  Document,
  rag,
  readFile = readGridFS,
  storage = require('./pdfStorage'),
  background = require('../utils/background').runInBackground,
  logger = console,
}) {
  const inFlight = new Set(); // don't index the same document twice at once

  // Large PDFs must not travel in a request body (4.5 MB on serverless): with
  // Blob storage the RAG service downloads the PDF itself via a signed URL.
  async function send(doc) {
    const meta = { documentId: doc._id, userId: doc.uploadedBy, title: doc.title };
    if (storage.blobEnabled()) {
      const pathname = doc.blobPathname || (await storage.copyGridFSToBlob(doc, Document));
      return rag.ingestFromUrl({ ...meta, url: await storage.signedDownloadUrl(pathname) });
    }
    return rag.ingestDocument({ ...meta, buffer: await readFile(doc.gridFSId) });
  }

  async function indexDocument(documentId) {
    const key = String(documentId);
    if (inFlight.has(key)) return { skipped: 'in-flight' };
    inFlight.add(key);
    try {
      const doc = await Document.findById(documentId);
      if (!doc) return { skipped: 'missing' };
      if (!doc.gridFSId && !doc.blobPathname) {
        await Document.updateOne({ _id: doc._id }, { ragStatus: 'failed', ragError: 'No stored PDF for this document' });
        return { status: 'failed' };
      }
      await Document.updateOne({ _id: doc._id }, { ragStatus: 'processing', $unset: { ragError: 1 } });
      const res = await send(doc);
      await Document.updateOne(
        { _id: doc._id },
        { ragStatus: 'ready', ragPages: res.pages, ragChunks: res.chunks, ragIndexedAt: new Date() }
      );
      return { status: 'ready', ...res };
    } catch (err) {
      logger.error(`RAG indexing failed for ${key}: ${err.message}`);
      // 422 = not a readable PDF / no text (e.g. scanned): a permanent failure worth showing.
      const msg = err.status === 422 ? err.message.replace(/^RAG service: /, '') : 'Indexing failed, try again later';
      await Document.updateOne({ _id: documentId }, { ragStatus: 'failed', ragError: msg }).catch(() => {});
      return { status: 'failed', error: msg };
    } finally {
      inFlight.delete(key);
    }
  }

  /** Fire-and-forget: mark pending now, index in the background. */
  async function scheduleIndex(documentId) {
    if (!rag.isEnabled()) return false;
    await Document.updateOne({ _id: documentId }, { ragStatus: 'pending' });
    background(() => indexDocument(documentId), `indexing ${documentId}`);
    return true;
  }

  return { indexDocument, scheduleIndex, isIndexing: (id) => inFlight.has(String(id)) };
}

let defaultIndexer;
function getIndexer() {
  if (!defaultIndexer) {
    const Document = require('../models/Document');
    const { ragClient } = require('../utils/ragClient');
    defaultIndexer = createIndexer({ Document, rag: ragClient });
  }
  return defaultIndexer;
}

module.exports = { createIndexer, getIndexer };
