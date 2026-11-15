const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcrypt');
const { createPasswordResetRouter, hashToken, TOKEN_TTL_MS, REQUEST_COOLDOWN_MS } = require('../authentication/passwordReset');

// Minimal in-memory stand-in for the Mongoose User model.
function makeUserModel(users) {
  return {
    async findOne({ email }) {
      const u = users.find((x) => email.test(x.email));
      if (!u) return null;
      u.save = async () => u;
      return u;
    },
  };
}

async function startApp({ users, now }) {
  const sent = [];
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createPasswordResetRouter({
    User: makeUserModel(users),
    sendMail: async (m) => { sent.push(m); },
    clientUrl: 'https://app.example/',
    now,
    logger: { error() {} },
  }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = async (path, body) => {
    const res = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  return { post, sent, close: () => server.close() };
}

const tokenFromMail = (mail) => new URL(mail.text.match(/https:\S+/)[0]).searchParams.get('token');

test('full flow: request link, reset password, token is single-use', async () => {
  let t = 1_000_000;
  const users = [{ email: 'Student@Example.com', password: await bcrypt.hash('old-password', 4) }];
  const app = await startApp({ users, now: () => t });
  try {
    const r1 = await app.post('/forgot-password', { email: 'student@example.com' });
    assert.equal(r1.status, 200);
    assert.equal(app.sent.length, 1);
    assert.equal(app.sent[0].to, 'Student@Example.com');
    const token = tokenFromMail(app.sent[0]);
    assert.match(token, /^[0-9a-f]{64}$/);
    // Only the hash is stored, never the token itself.
    assert.equal(users[0].resetPasswordTokenHash, hashToken(token));
    assert.notEqual(users[0].resetPasswordTokenHash, token);
    assert.match(app.sent[0].text, /^.*https:\/\/app\.example\/reset-password\?token=/m);

    const r2 = await app.post('/reset-password', { email: 'student@example.com', token, password: 'new-password-1' });
    assert.equal(r2.status, 200);
    assert.ok(await bcrypt.compare('new-password-1', users[0].password));

    const r3 = await app.post('/reset-password', { email: 'student@example.com', token, password: 'another-pass' });
    assert.equal(r3.status, 400, 'token must not be reusable');
  } finally { app.close(); }
});

test('unknown email gets the same response and no email is sent', async () => {
  const app = await startApp({ users: [], now: () => 0 });
  try {
    const r = await app.post('/forgot-password', { email: 'nobody@example.com' });
    assert.equal(r.status, 200);
    assert.match(r.body.message, /If an account exists/);
    assert.equal(app.sent.length, 0);
  } finally { app.close(); }
});

test('expired token is rejected', async () => {
  let t = 5_000_000;
  const users = [{ email: 'a@b.co', password: 'x' }];
  const app = await startApp({ users, now: () => t });
  try {
    await app.post('/forgot-password', { email: 'a@b.co' });
    const token = tokenFromMail(app.sent[0]);
    t += TOKEN_TTL_MS + 1;
    const r = await app.post('/reset-password', { email: 'a@b.co', token, password: 'long-enough-pw' });
    assert.equal(r.status, 400);
    assert.equal(users[0].password, 'x');
  } finally { app.close(); }
});

test('wrong token and short password are rejected', async () => {
  const users = [{ email: 'a@b.co', password: 'x' }];
  const app = await startApp({ users, now: () => 10 });
  try {
    await app.post('/forgot-password', { email: 'a@b.co' });
    const bad = await app.post('/reset-password', { email: 'a@b.co', token: 'f'.repeat(64), password: 'long-enough-pw' });
    assert.equal(bad.status, 400);
    const short = await app.post('/reset-password', { email: 'a@b.co', token: tokenFromMail(app.sent[0]), password: 'short' });
    assert.equal(short.status, 400);
    assert.equal(users[0].password, 'x');
  } finally { app.close(); }
});

test('repeat requests inside the cooldown do not send more emails', async () => {
  let t = 0;
  const users = [{ email: 'a@b.co', password: 'x' }];
  const app = await startApp({ users, now: () => t });
  try {
    await app.post('/forgot-password', { email: 'a@b.co' });
    t += 1000;
    await app.post('/forgot-password', { email: 'a@b.co' });
    assert.equal(app.sent.length, 1);
    t += REQUEST_COOLDOWN_MS;
    await app.post('/forgot-password', { email: 'a@b.co' });
    assert.equal(app.sent.length, 2);
  } finally { app.close(); }
});

test('regex characters in the email cannot match other accounts', async () => {
  const users = [{ email: 'victim@example.com', password: 'x' }];
  const app = await startApp({ users, now: () => 0 });
  try {
    await app.post('/forgot-password', { email: '.*@example.com' });
    assert.equal(app.sent.length, 0);
  } finally { app.close(); }
});
