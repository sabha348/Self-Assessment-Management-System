#!/usr/bin/env node
/**
 * Index every stored PDF that is not yet in the RAG service.
 *
 *   cd backend && node scripts/backfillRagIndex.js [--retry-failed]
 *
 * Optional: PDFs are also indexed on demand the first time someone generates
 * questions from them. Runs one PDF at a time, because the embedding API is
 * rate limited per minute anyway. Needs MONGODB_URI, RAG_URL,
 * RAG_SERVICE_TOKEN and RAG_ENABLED=true.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Document = require('../models/Document');
const { ragClient } = require('../utils/ragClient');
const { createIndexer } = require('../services/ragIndexer');

async function main() {
  if (!ragClient.isEnabled()) {
    console.error('RAG_ENABLED is not true; nothing to do.');
    process.exit(2);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const statuses = process.argv.includes('--retry-failed') ? ['none', 'failed', null] : ['none', null];
  const docs = await Document.find({ gridFSId: { $exists: true }, ragStatus: { $in: statuses } }).select('_id title');
  console.log(`${docs.length} document(s) to index`);
  const indexer = createIndexer({ Document, rag: ragClient });
  let ok = 0;
  for (const [i, doc] of docs.entries()) {
    const started = Date.now();
    const res = await indexer.indexDocument(doc._id);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[${i + 1}/${docs.length}] ${doc.title}: ${res.status || res.skipped} (${secs}s)${res.error ? ' - ' + res.error : ''}`);
    if (res.status === 'ready') ok += 1;
  }
  console.log(`Done: ${ok}/${docs.length} indexed.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
