/**
 * Run work after the HTTP response has been sent.
 *
 * On a long-running server (local, Docker) a detached promise just keeps
 * running. On Vercel a function may be frozen as soon as it responds, so the
 * promise is registered with waitUntil(), which keeps the function alive until
 * it settles (bounded by the function's maxDuration).
 */
function runInBackground(task, label = 'background task') {
  const promise = Promise.resolve()
    .then(task)
    .catch((err) => console.error(`${label} failed: ${err.message}`));
  if (process.env.VERCEL) {
    try {
      require('@vercel/functions').waitUntil(promise);
    } catch (err) {
      console.error('waitUntil unavailable:', err.message);
    }
  }
  return promise;
}

module.exports = { runInBackground };
