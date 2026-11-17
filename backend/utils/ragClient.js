/**
 * HTTP client for the Python RAG service (rag_service/).
 *
 * The backend authenticates end users (JWT) and passes the verified userId;
 * the RAG service trusts only callers holding RAG_SERVICE_TOKEN.
 * Disabled unless RAG_ENABLED=true, so the app keeps working (legacy path)
 * wherever the RAG service is not deployed.
 */
const axios = require('axios');

class RagError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'RagError';
    this.status = status; // HTTP status from the RAG service, if any
  }
}

function createRagClient({
  baseURL = process.env.RAG_URL || 'http://localhost:8001',
  token = process.env.RAG_SERVICE_TOKEN || '',
  enabled = process.env.RAG_ENABLED === 'true',
  http = null,
} = {}) {
  const client = http || axios.create({ baseURL, headers: { 'X-Service-Token': token } });

  async function call(fn) {
    try {
      const res = await fn();
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.message;
      throw new RagError(`RAG service: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`, status);
    }
  }

  return {
    isEnabled: () => enabled,

    /** Index a PDF. Can take minutes for a long book (embedding rate limits). */
    ingestDocument({ documentId, userId, title, buffer }) {
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: 'application/pdf' }), title || 'document.pdf');
      form.append('document_id', String(documentId));
      form.append('user_id', String(userId));
      form.append('title', title || '');
      return call(() => client.post('/v1/documents', form, { timeout: 15 * 60 * 1000 }));
    },

    /** Index a PDF the RAG service downloads itself (signed Blob URL): no request-size limit. */
    ingestFromUrl({ documentId, userId, title, url }) {
      return call(() =>
        client.post(
          '/v1/documents/from-url',
          { document_id: String(documentId), user_id: String(userId), title: title || '', source_url: url },
          { timeout: 15 * 60 * 1000 }
        )
      );
    },

    async deleteDocument({ documentId, userId }) {
      try {
        await call(() =>
          client.delete(`/v1/documents/${encodeURIComponent(documentId)}`, { params: { user_id: String(userId) }, timeout: 15000 })
        );
        return true;
      } catch (err) {
        if (err.status === 404) return false; // never indexed: nothing to delete
        throw err;
      }
    },

    generateQuestions({ userId, documentId, n, difficulty, focusText, pageMin, pageMax }) {
      return call(() =>
        client.post(
          '/v1/questions',
          {
            user_id: String(userId),
            document_id: String(documentId),
            n,
            difficulty,
            focus_text: focusText || null,
            page_min: pageMin || null,
            page_max: pageMax || null,
          },
          { timeout: 120000 }
        )
      );
    },

    /** items: [{question, reference_answer, key_points, source_chunk_ids, answer}] */
    grade({ userId, items }) {
      return call(() => client.post('/v1/grade', { user_id: String(userId), items }, { timeout: 180000 }));
    },
  };
}

module.exports = { createRagClient, RagError, ragClient: createRagClient() };
