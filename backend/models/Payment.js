const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stripeSessionId: {
    type: String,
    required: true,
    unique: true
  },
  stripePaymentIntentId: String,
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'inr'
  },
  status: {
    type: String,
    enum: ['succeeded', 'failed', 'pending', 'refunded'],
    default: 'succeeded'
  },
  date: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Object
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);