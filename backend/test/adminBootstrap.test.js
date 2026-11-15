const test = require('node:test');
const assert = require('node:assert/strict');
const { maybeBootstrapAdmin, parseAdminEmails } = require('../utils/adminBootstrap');

const model = (hasAdmin) => ({ exists: async (q) => (q.role === 'admin' && hasAdmin ? { _id: 1 } : null) });

test('parses and normalises the email list', () => {
  assert.deepEqual(parseAdminEmails(' A@x.com, ,b@Y.com '), ['a@x.com', 'b@y.com']);
  assert.deepEqual(parseAdminEmails(undefined), []);
});

test('promotes a listed email when no admin exists', async () => {
  const u = { email: 'Owner@Example.com', role: 'user' };
  assert.equal(await maybeBootstrapAdmin(u, { User: model(false), adminEmails: 'owner@example.com' }), true);
  assert.equal(u.role, 'admin');
});

test('never promotes once an admin exists', async () => {
  const u = { email: 'owner@example.com', role: 'user' };
  assert.equal(await maybeBootstrapAdmin(u, { User: model(true), adminEmails: 'owner@example.com' }), false);
  assert.equal(u.role, 'user');
});

test('ignores emails not in the list, and an empty list', async () => {
  const u = { email: 'someone@example.com', role: 'user' };
  assert.equal(await maybeBootstrapAdmin(u, { User: model(false), adminEmails: 'owner@example.com' }), false);
  assert.equal(await maybeBootstrapAdmin(u, { User: model(false), adminEmails: '' }), false);
  assert.equal(u.role, 'user');
});
