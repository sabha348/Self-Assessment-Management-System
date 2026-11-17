const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createRagClient } = require('../utils/ragClient');
const { createGrader } = require('../services/grading');
const { createIndexer } = require('../services/ragIndexer');
const { createGroundedQuiz } = require('../services/groundedQuiz');

// ---------------------------------------------------------------- ragClient

function startFakeRag(handler) {
  return new Promise((resolve) => {
    const seen = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen.push({ method: req.method, url: req.url, headers: req.headers, body });
        const [status, json] = handler(req, body);
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(json));
      });
    });
    server.listen(0, () => resolve({ server, seen, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

test('ragClient sends the service token, multipart PDF and maps errors', async () => {
  const fake = await startFakeRag((req) => {
    if (req.url.startsWith('/v1/documents') && req.method === 'POST') return [200, { document_id: 'd1', pages: 2, chunks: 3, skipped: false }];
    if (req.method === 'DELETE') return [404, { detail: 'document not found' }];
    if (req.url === '/v1/questions') return [409, { detail: 'document is not indexed yet' }];
    return [500, {}];
  });
  try {
    const rag = createRagClient({ baseURL: fake.url, token: 'secret', enabled: true });
    const res = await rag.ingestDocument({ documentId: 'd1', userId: 'u1', title: 'a.pdf', buffer: Buffer.from('%PDF-1.4 x') });
    assert.deepEqual(res, { document_id: 'd1', pages: 2, chunks: 3, skipped: false });
    const upload = fake.seen[0];
    assert.equal(upload.headers['x-service-token'], 'secret');
    assert.match(upload.headers['content-type'], /multipart\/form-data/);
    assert.match(upload.body, /name="document_id"\r\n\r\nd1/);
    assert.match(upload.body, /%PDF-1.4 x/);

    assert.equal(await rag.deleteDocument({ documentId: 'nope', userId: 'u1' }), false); // 404 is fine
    assert.match(fake.seen[1].url, /\/v1\/documents\/nope\?user_id=u1/);

    await assert.rejects(
      rag.generateQuestions({ userId: 'u1', documentId: 'd1', n: 3 }),
      (err) => err.status === 409 && /not indexed/.test(err.message)
    );
    assert.equal(rag.isEnabled(), true);
    assert.equal(createRagClient({ enabled: false }).isEnabled(), false);
  } finally {
    fake.server.close();
  }
});

// ---------------------------------------------------------------- grading

const grounded = (id) => ({
  questionId: id, question: `Q ${id}`, correctAnswer: `ref ${id}`, grounded: true,
  keyPoints: ['kp'], sourceChunkIds: ['c1'],
});
const legacy = (id) => ({ questionId: id, question: `Q ${id}`, correctAnswer: `ref ${id}` });

function fakeRag({ enabled = true } = {}) {
  const calls = [];
  return {
    calls,
    isEnabled: () => enabled,
    grade: async ({ userId, items }) => {
      calls.push({ userId, items });
      return { results: items.map((it) => ({
        verdict: it.answer === 'good' ? 'correct' : 'partial', score: it.answer === 'good' ? 100 : 50,
        missing_points: [], feedback: 'fb', point_status: [],
        citations: [{ chunk_id: 'c1', page_start: 3, page_end: 3, page_label_start: 'iii', page_label_end: 'iii', snippet: 's' }],
      })) };
    },
  };
}

test('grader sends grounded questions with sources and older ones against the reference', async () => {
  const rag = fakeRag();
  const grader = createGrader({ rag });
  const out = await grader.grade('u1', [
    { question: legacy('L1'), userAnswer: 'x' },
    { question: grounded('G1'), userAnswer: 'good' },
    { question: grounded('G2'), userAnswer: 'meh' },
  ]);
  assert.deepEqual(out.map((e) => e.grader), ['rag-reference-v1', 'rag-points-v1', 'rag-points-v1']);
  assert.deepEqual(out.map((e) => e.verdict), ['partial', 'correct', 'partial']);
  assert.equal(out[1].is_correct, true);
  assert.deepEqual(out[1].citations[0], { chunkId: 'c1', pageStart: 3, pageEnd: 3, pageLabelStart: 'iii', pageLabelEnd: 'iii', snippet: 's' });
  const [legacyItem, groundedItem] = rag.calls[0].items;
  assert.deepEqual(legacyItem, { question: 'Q L1', reference_answer: 'ref L1', key_points: [], source_chunk_ids: [], answer: 'x' });
  assert.deepEqual(groundedItem, { question: 'Q G1', reference_answer: 'ref G1', key_points: ['kp'], source_chunk_ids: ['c1'], answer: 'good' });
  assert.equal(rag.calls.length, 1); // one request for the whole quiz
});

test('grader reports 503 when the RAG service is disabled', async () => {
  const grader = createGrader({ rag: fakeRag({ enabled: false }) });
  await assert.rejects(grader.grade('u', [{ question: grounded('G'), userAnswer: 'a' }]), (e) => e.status === 503);
});

// ---------------------------------------------------------------- indexer

function fakeDocuments(docs) {
  const updates = [];
  return {
    updates,
    docs,
    findById: async (id) => docs[id] || null,
    updateOne: async ({ _id }, update) => {
      updates.push([String(_id), update]);
      Object.assign(docs[_id] || {}, Object.fromEntries(Object.entries(update).filter(([k]) => !k.startsWith('$'))));
    },
  };
}

test('indexer moves a document processing -> ready and records counts', async () => {
  const Document = fakeDocuments({ d1: { _id: 'd1', gridFSId: 'g1', uploadedBy: 'u1', title: 'Book.pdf' } });
  const ingested = [];
  const indexer = createIndexer({
    Document,
    rag: { isEnabled: () => true, ingestDocument: async (args) => { ingested.push(args); return { pages: 10, chunks: 14 }; } },
    readFile: async (id) => Buffer.from(`pdf-${id}`),
    logger: { error() {} },
  });
  const res = await indexer.indexDocument('d1');
  assert.equal(res.status, 'ready');
  assert.deepEqual(Document.updates.map(([, u]) => u.ragStatus), ['processing', 'ready']);
  assert.equal(Document.docs.d1.ragChunks, 14);
  assert.equal(ingested[0].userId, 'u1');
  assert.equal(ingested[0].buffer.toString(), 'pdf-g1');
});

test('indexer records a readable reason for unreadable PDFs and a generic one otherwise', async () => {
  for (const [status, expected] of [[422, 'PDF has no extractable text'], [502, 'Indexing failed, try again later']]) {
    const Document = fakeDocuments({ d1: { _id: 'd1', gridFSId: 'g', uploadedBy: 'u' } });
    const indexer = createIndexer({
      Document,
      rag: { isEnabled: () => true, ingestDocument: async () => { const e = new Error('RAG service: PDF has no extractable text'); e.status = status; throw e; } },
      readFile: async () => Buffer.from('x'),
      logger: { error() {} },
    });
    const res = await indexer.indexDocument('d1');
    assert.equal(res.status, 'failed');
    assert.equal(Document.docs.d1.ragError, expected);
  }
});

test('indexer does not index the same document twice at once', async () => {
  let release;
  const Document = fakeDocuments({ d1: { _id: 'd1', gridFSId: 'g', uploadedBy: 'u' } });
  const indexer = createIndexer({
    Document,
    rag: { isEnabled: () => true, ingestDocument: () => new Promise((r) => (release = () => r({ pages: 1, chunks: 1 }))) },
    readFile: async () => Buffer.from('x'),
  });
  const first = indexer.indexDocument('d1');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(await indexer.indexDocument('d1'), { skipped: 'in-flight' });
  release();
  assert.equal((await first).status, 'ready');
});

// ---------------------------------------------------------------- grounded quiz

function quizDeps({ ragStatus = 'ready', genQuestions } = {}) {
  const saved = { quizzes: [], questions: [], scheduled: [], genCalls: [] };
  class Quiz { constructor(d) { Object.assign(this, d, { _id: 'quiz1' }); } async save() { saved.quizzes.push(this); return this; } }
  Quiz.updateOne = async () => {};
  class Question { constructor(d) { Object.assign(this, d); } async save() { saved.questions.push(this); return this; } }
  Question.updateMany = async () => {};
  const Document = { findOne: async ({ _id, uploadedBy }) => (_id === 'd1' && uploadedBy === 'u1' ? { _id: 'd1', title: 'Book', ragStatus } : null) };
  const rag = {
    isEnabled: () => true,
    generateQuestions: async (args) => {
      saved.genCalls.push(args);
      return { insufficient_context: false, questions: genQuestions || [{
        question: 'What stops a while loop?', reference_answer: 'A false condition.', key_points: ['condition false'],
        citations: [{ chunk_id: 'c9', page_start: 86, page_end: 87, page_label_start: '64', page_label_end: '65', snippet: 'The body…' }],
      }] };
    },
  };
  const indexer = { scheduleIndex: async (id) => saved.scheduled.push(id) };
  const gq = createGroundedQuiz({ Quiz, Question, Document, rag, indexer, categorize: async () => ({}), logger: { error() {} }, now: () => 42 });
  return { gq, saved };
}

test('grounded quiz saves questions with key points, sources and citations', async () => {
  const { gq, saved } = quizDeps();
  const out = await gq.tryGenerate({ userId: 'u1', body: { documentId: 'd1', text: 'while loops', numQuestions: 99, difficulty: 'weird', pageStart: 86, pageEnd: 87 } });
  assert.equal(out.handled, true);
  assert.equal(saved.genCalls[0].n, 10); // capped
  assert.equal(saved.genCalls[0].difficulty, 'medium'); // sanitised
  assert.equal(saved.genCalls[0].pageMin, 86);
  const [q] = saved.questions;
  assert.equal(q.grounded, true);
  assert.deepEqual(q.sourceChunkIds, ['c9']);
  assert.deepEqual(q.keyPoints, ['condition false']);
  assert.equal(q.correctAnswer, 'A false condition.');
  assert.equal(q.questionId, 'Q420');
  assert.deepEqual(out.body.questions, ['What stops a while loop?']);
  assert.equal(out.body.questionDetails[0].citations[0].pageLabelStart, '64');
});

test('grounded quiz declines (and queues indexing) for an unindexed PDF', async () => {
  const { gq, saved } = quizDeps({ ragStatus: 'none' });
  assert.deepEqual(await gq.tryGenerate({ userId: 'u1', body: { documentId: 'd1' } }), { handled: false, indexing: true });
  assert.deepEqual(saved.scheduled, ['d1']);
  const busy = quizDeps({ ragStatus: 'processing' });
  await busy.gq.tryGenerate({ userId: 'u1', body: { documentId: 'd1' } });
  assert.deepEqual(busy.saved.scheduled, []); // already in progress: don't queue again
});

test('grounded quiz: other users documents 404, empty generation 422, no documentId falls through', async () => {
  const { gq } = quizDeps({ genQuestions: [] });
  await assert.rejects(gq.tryGenerate({ userId: 'intruder', body: { documentId: 'd1' } }), (e) => e.status === 404);
  await assert.rejects(gq.tryGenerate({ userId: 'u1', body: { documentId: 'd1' } }), (e) => e.status === 422);
  assert.deepEqual(await gq.tryGenerate({ userId: 'u1', body: { text: 'x' } }), { handled: false });
});


test('indexer on Blob storage sends a signed URL, copying GridFS PDFs to Blob first', async () => {
  const Document = fakeDocuments({
    old: { _id: 'old', gridFSId: 'g1', uploadedBy: 'u1', title: 'Old.pdf' },
    fresh: { _id: 'fresh', blobPathname: 'pdfs/u1/new-abc.pdf', uploadedBy: 'u1', title: 'New.pdf' },
  });
  const copied = [];
  const ingested = [];
  const storage = {
    blobEnabled: () => true,
    copyGridFSToBlob: async (doc) => { copied.push(doc._id); return `pdfs/${doc.uploadedBy}/copied.pdf`; },
    signedDownloadUrl: async (pathname) => `https://x.private.blob.vercel-storage.com/${pathname}?sig=1`,
  };
  const indexer = createIndexer({
    Document,
    rag: {
      isEnabled: () => true,
      ingestDocument: async () => { throw new Error('must not upload the PDF in the request body'); },
      ingestFromUrl: async (args) => { ingested.push(args); return { pages: 2, chunks: 3 }; },
    },
    storage,
    readFile: async () => { throw new Error('must not read GridFS directly'); },
    logger: { error() {} },
  });
  assert.equal((await indexer.indexDocument('fresh')).status, 'ready');
  assert.equal((await indexer.indexDocument('old')).status, 'ready');
  assert.deepEqual(copied, ['old']); // only the GridFS one is copied
  assert.deepEqual(ingested.map((a) => a.url), [
    'https://x.private.blob.vercel-storage.com/pdfs/u1/new-abc.pdf?sig=1',
    'https://x.private.blob.vercel-storage.com/pdfs/u1/copied.pdf?sig=1',
  ]);
});

test('uploads are only accepted as PDFs in the uploader\'s own folder', () => {
  const { isAllowedUploadPath } = require('../services/pdfStorage');
  assert.equal(isAllowedUploadPath('pdfs/u1/notes.pdf', 'u1'), true);
  assert.equal(isAllowedUploadPath('pdfs/u1/Notes.PDF', 'u1'), true);
  assert.equal(isAllowedUploadPath('pdfs/u2/notes.pdf', 'u1'), false); // someone else's folder
  assert.equal(isAllowedUploadPath('pdfs/u1/../u2/x.pdf', 'u1'), false);
  assert.equal(isAllowedUploadPath('pdfs/u1/script.html', 'u1'), false);
  assert.equal(isAllowedUploadPath('pdfs/u10/x.pdf', 'u1'), false); // prefix must end at the folder
  assert.equal(isAllowedUploadPath(undefined, 'u1'), false);
});

test('background work runs after the caller returns', async () => {
  const { runInBackground } = require('../utils/background');
  const order = [];
  const p = runInBackground(async () => { order.push('task'); throw new Error('boom'); }, 'test');
  order.push('caller');
  await p; // errors are logged, never thrown into the request
  assert.deepEqual(order, ['caller', 'task']);
});
