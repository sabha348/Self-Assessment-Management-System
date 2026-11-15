const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');

const TOKEN_TTL_MS = 30 * 60 * 1000; // reset links are valid for 30 minutes
const REQUEST_COOLDOWN_MS = 60 * 1000; // at most one email per account per minute
const MIN_PASSWORD_LENGTH = 8;

// Same response whether or not the account exists, so the endpoint can't be
// used to find out which emails are registered.
const GENERIC_RESPONSE = {
  message: 'If an account exists for that email, a reset link has been sent.',
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeEqualHex(a, b) {
  const ab = Buffer.from(a || '', 'hex');
  const bb = Buffer.from(b || '', 'hex');
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

/**
 * Forgot / reset password routes.
 *
 * Dependencies are injected so the flow can be tested without a database or
 * SMTP server.
 *
 * @param {object} deps
 * @param {object} deps.User      Mongoose-like model with findOne()
 * @param {Function} deps.sendMail ({to, subject, html, text}) => Promise
 * @param {string} deps.clientUrl  public frontend URL used in the link
 * @param {Function} [deps.now]    clock, for tests
 * @param {Function} [deps.logger]
 */
function createPasswordResetRouter({ User, sendMail, clientUrl, now = () => Date.now(), logger = console }) {
  const router = express.Router();

  const findByEmail = (email) =>
    User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, 'i') });

  router.post('/forgot-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    try {
      const user = await findByEmail(email);
      if (!user) return res.status(200).json(GENERIC_RESPONSE);

      if (user.resetPasswordRequestedAt &&
          now() - new Date(user.resetPasswordRequestedAt).getTime() < REQUEST_COOLDOWN_MS) {
        return res.status(200).json(GENERIC_RESPONSE);
      }

      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordTokenHash = hashToken(token);
      user.resetPasswordExpires = new Date(now() + TOKEN_TTL_MS);
      user.resetPasswordRequestedAt = new Date(now());
      await user.save();

      const link = `${clientUrl.replace(/\/$/, '')}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
      try {
        await sendMail({
          to: user.email,
          subject: 'Reset your SmartAssess password',
          text: `Use this link within 30 minutes to reset your password: ${link}\n\nIf you did not request this, ignore this email.`,
          html: `<p>Use the link below within 30 minutes to reset your password.</p>
                 <p><a href="${link}">Reset password</a></p>
                 <p>If you did not request this, you can ignore this email.</p>`,
        });
      } catch (mailErr) {
        // Don't reveal mail failures to the client (account enumeration), but log them.
        logger.error('Password reset email failed:', mailErr.message);
      }
      return res.status(200).json(GENERIC_RESPONSE);
    } catch (err) {
      logger.error('forgot-password error:', err.message);
      return res.status(500).json({ message: 'Could not process the request.' });
    }
  });

  router.post('/reset-password', async (req, res) => {
    const { email, token, password } = req.body || {};
    if (typeof email !== 'string' || typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'email, token and password are required.' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const INVALID = { message: 'This reset link is invalid or has expired.' };
    try {
      const user = await findByEmail(email.trim());
      if (!user || !user.resetPasswordTokenHash || !user.resetPasswordExpires) {
        return res.status(400).json(INVALID);
      }
      if (new Date(user.resetPasswordExpires).getTime() < now()) return res.status(400).json(INVALID);
      if (!safeEqualHex(hashToken(token), user.resetPasswordTokenHash)) return res.status(400).json(INVALID);

      user.password = await bcrypt.hash(password, 10);
      // Single use: clear the token.
      user.resetPasswordTokenHash = undefined;
      user.resetPasswordExpires = undefined;
      user.passwordResetRequired = false;
      await user.save();
      return res.status(200).json({ message: 'Password updated. You can now log in.' });
    } catch (err) {
      logger.error('reset-password error:', err.message);
      return res.status(500).json({ message: 'Could not reset the password.' });
    }
  });

  return router;
}

module.exports = { createPasswordResetRouter, hashToken, TOKEN_TTL_MS, REQUEST_COOLDOWN_MS };
