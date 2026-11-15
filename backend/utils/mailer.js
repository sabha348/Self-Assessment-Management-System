const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Email is not configured (EMAIL_USER / EMAIL_PASS)');
    }
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  return getTransporter().sendMail({ from: process.env.EMAIL_USER, to, subject, html, text });
}

module.exports = { sendMail };
