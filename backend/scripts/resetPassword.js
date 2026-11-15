#!/usr/bin/env node
/**
 * Reset a user's password directly in the database (for the account owner /
 * operator; e.g. when locked out and email reset is not available).
 *
 *   cd backend
 *   node scripts/resetPassword.js --email someone@example.com
 *
 * The new password is read from a hidden prompt (never from argv, so it does
 * not end up in shell history). Uses MONGODB_URI from backend/.env.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/Users');

const MIN_LENGTH = 8;

function parseEmail(argv) {
  const i = argv.indexOf('--email');
  const email = i >= 0 ? argv[i + 1] : undefined;
  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/resetPassword.js --email <user email>');
    process.exit(2);
  }
  return email.trim().toLowerCase();
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Mask typed characters.
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else rl.output.write('*');
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const email = parseEmail(process.argv);
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set (backend/.env).');
    process.exit(2);
  }

  const password = await promptHidden(`New password for ${email}: `);
  const confirm = await promptHidden('Repeat new password: ');
  if (password !== confirm) {
    console.error('Passwords do not match.');
    process.exit(1);
  }
  if (password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    // Emails are stored as typed at registration, so match case-insensitively.
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({ email: new RegExp(`^${escaped}$`, 'i') });
    if (!user) {
      console.error(`No user with email ${email}.`);
      process.exitCode = 1;
      return;
    }
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    console.log(`Password updated for ${user.email} (role: ${user.role}).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
