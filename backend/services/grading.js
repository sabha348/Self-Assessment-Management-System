/**
 * Grades free-text answers through the RAG service's point-based grader.
 *
 * Grounded questions (key points + source chunks) are graded against their
 * source pages, with page citations. Questions created before grounding have
 * neither, so they are graded against their reference answer alone. Either way
 * the result has one shape, used by both the PDF quiz and Practice.
 */

function toCitationOut(c) {
  return {
    chunkId: c.chunk_id ?? c.chunkId,
    pageStart: c.page_start ?? c.pageStart,
    pageEnd: c.page_end ?? c.pageEnd,
    pageLabelStart: c.page_label_start ?? c.pageLabelStart,
    pageLabelEnd: c.page_label_end ?? c.pageLabelEnd,
    snippet: c.snippet,
  };
}

const isGrounded = (q) => Boolean(q && q.grounded && q.sourceChunkIds && q.sourceChunkIds.length);

class GradingUnavailable extends Error {
  constructor() {
    super('Grading is not available on this server (RAG service disabled)');
    this.status = 503;
  }
}

function createGrader({ rag }) {
  /** items: [{question: QuestionDoc, userAnswer}] -> evaluations in the same order */
  async function grade(userId, items) {
    if (!rag.isEnabled()) throw new GradingUnavailable();
    const res = await rag.grade({
      userId,
      items: items.map(({ question, userAnswer }) => ({
        question: question.question,
        reference_answer: question.correctAnswer || 'No reference answer available',
        key_points: isGrounded(question) ? question.keyPoints || [] : [],
        source_chunk_ids: isGrounded(question) ? question.sourceChunkIds : [],
        answer: String(userAnswer ?? ''),
      })),
    });
    return res.results.map((r, i) => ({
      is_correct: r.verdict === 'correct',
      verdict: r.verdict,
      accuracy: r.score,
      missing_points: r.missing_points,
      feedback: r.feedback,
      citations: (r.citations || []).map(toCitationOut),
      correct_answer: items[i].question.correctAnswer,
      user_answer: String(items[i].userAnswer ?? ''),
      grader: isGrounded(items[i].question) ? 'rag-points-v1' : 'rag-reference-v1',
    }));
  }

  return { grade };
}

let defaultGrader;
function getGrader() {
  if (!defaultGrader) defaultGrader = createGrader({ rag: require('../utils/ragClient').ragClient });
  return defaultGrader;
}

module.exports = { createGrader, getGrader, isGrounded, toCitationOut, GradingUnavailable };
