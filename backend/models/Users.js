const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  mobileno: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  membership: { 
    type: String, 
    enum: ['free', 'premium'], 
    default: 'free' 
  },
  membershipExpiry: Date, //  Store expiry date for paid plans 
  stripeCustomerId: { type: String }, // Store Stripe customer ID
  stripePaymentId: { type: String }, // Store Stripe payment ID for one-time purchase
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  preferences: {
    questionConfig: {
      numQuestions: { type: Number, default: 5 },
      difficulty: { type: String, default: 'medium' },
      questionTypes: [{ type: String }],
      timeLimit: { type: Number, default: 0 }
    }
  }
});

// userSchema.pre('save', async function(next) {
//   // Only hash the password if it has been modified (or is new)
//   if (!this.isModified('password')) return next();
  
//   try {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// userSchema.methods.comparePassword = async function(candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

module.exports = mongoose.model('User', userSchema);
