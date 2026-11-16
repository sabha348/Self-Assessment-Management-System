/**
 * Grounded quiz generation: questions come only from chunks of the user's
 * own PDF retrieved by the RAG service, and carry page citations.
 *
 * tryGenerate() returns { handled: false } when the grounded path does not
 * apply (RAG disabled, no document id, document not indexed yet), so the
 * caller can fall back to the legacy generator. A PDF that has never been
 * indexed (uploaded before RAG existed) is queued for indexing the first
 * time someone generates questions from it.
 */
const DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'mixed']);
const MAX_QUESTIONS = 10;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function toCitation(c) {
  return {
    chunkId: c.chunk_id,
    pageStart: c.page_start,
    pageEnd: c.page_end,
    pageLabelStart: c.page_label_start,
    pageLabelEnd: c.page_label_end,
    snippet: c.snippet,
  };
}

function createGroundedQuiz({ Quiz, Question, Document, rag, indexer, categorize, logger = console, now = Date.now }) {
  async function tryGenerate({ userId, body }) {
    const { documentId } = body;
    if (!rag.isEnabled() || !documentId) return { handled: false };

    const doc = await Document.findOne({ _id: documentId, uploadedBy: userId });
    if (!doc) throw new HttpError(404, 'Document not found');
    if (doc.ragStatus !== 'ready') {
      if (!['pending', 'processing'].includes(doc.ragStatus)) await indexer.scheduleIndex(doc._id);
      return { handled: false, indexing: true };
    }

    const n = Math.max(1, Math.min(MAX_QUESTIONS, parseInt(body.numQuestions, 10) || 5));
    const difficulty = DIFFICULTIES.has(body.difficulty) ? body.difficulty : 'medium';
    const text = typeof body.text === 'string' ? body.text : '';
    const pageMin = Number.isInteger(body.pageStart) ? body.pageStart : undefined;
    const pageMax = Number.isInteger(body.pageEnd) ? body.pageEnd : undefined;

    const gen = await rag.generateQuestions({
      userId,
      documentId: String(doc._id),
      n,
      difficulty,
      focusText: text.slice(0, 8000),
      pageMin,
      pageMax,
    });
    if (!gen.questions.length) {
      throw new HttpError(422, 'Not enough readable content here to write questions. Try selecting a longer passage.');
    }

    const quiz = await new Quiz({
      numberOfQuestions: gen.questions.length,
      userId,
      difficulty,
      type: 'open-ended',
      topic: body.topic || 'General',
      subject: body.subject || 'Knowledge',
      content: (text || doc.title).substring(0, 1000),
      quizTime: body.timeLimit || 30,
    }).save();

    const stamp = now();
    const saved = await Promise.all(
      gen.questions.map((q, i) =>
        new Question({
          questionId: `Q${stamp}${i}`,
          quizeRef: quiz._id,
          question: q.question,
          correctAnswer: q.reference_answer,
          type: 'open-ended',
          position: i,
          userId,
          difficulty,
          grounded: true,
          documentId: doc._id,
          keyPoints: q.key_points,
          sourceChunkIds: q.citations.map((c) => c.chunk_id),
          citations: q.citations.map(toCitation),
        }).save()
      )
    );

    // Subject/topic categorisation is slow and non-critical: run it after
    // responding. Questions are already saved, so submitting never races it.
    const categoryText = text || gen.questions.map((q) => `${q.question} ${q.reference_answer}`).join(' ');
    setImmediate(async () => {
      try {
        const c = await categorize(categoryText, userId);
        const fields = { subject: c.Subject, topic: c.Topic, subtopic: c.Subtopic, concept: c.Concept };
        await Quiz.updateOne({ _id: quiz._id }, { $set: fields });
        await Question.updateMany({ quizeRef: quiz._id }, { $set: fields });
      } catch (err) {
        logger.error(`Categorisation failed for quiz ${quiz._id}: ${err.message}`);
      }
    });

    return {
      handled: true,
      body: {
        quizId: quiz._id,
        grounded: true,
        questions: saved.map((q) => q.question),
        questionDetails: saved.map((q) => ({
          questionId: q.questionId,
          question: q.question,
          citations: q.citations,
        })),
        insufficientContext: Boolean(gen.insufficient_context),
      },
    };
  }

  return { tryGenerate };
}

let defaultGroundedQuiz;
function getGroundedQuiz() {
  if (!defaultGroundedQuiz) {
    defaultGroundedQuiz = createGroundedQuiz({
      Quiz: require('../models/Quiz'),
      Question: require('../models/Question'),
      Document: require('../models/Document'),
      rag: require('../utils/ragClient').ragClient,
      indexer: require('./ragIndexer').getIndexer(),
      categorize: require('../utils/TextCategory').categorizeText,
    });
  }
  return defaultGroundedQuiz;
}

module.exports = { createGroundedQuiz, getGroundedQuiz, HttpError };
