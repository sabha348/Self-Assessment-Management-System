const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Application Settings
  appName: { type: String, default: 'Self-Assessment System' },
  logo: { type: String }, // URL to logo image
  theme: {
    primary: { type: String, default: '#3f51b5' },
    secondary: { type: String, default: '#f50057' },
    mode: { type: String, enum: ['light', 'dark'], default: 'light' }
  },
  
  // User Settings
  registrationOpen: { type: Boolean, default: true },
  requireEmailVerification: { type: Boolean, default: true },
  defaultUserRole: { type: String, default: 'user' },
  
  // Assessment Settings
  defaultTimeLimit: { type: Number, default: 30 }, // minutes
  defaultQuestionsPerAssessment: { type: Number, default: 10 },
  enabledQuestionTypes: {
    multipleChoice: { type: Boolean, default: true },
    trueFalse: { type: Boolean, default: true },
    shortAnswer: { type: Boolean, default: true },
    essay: { type: Boolean, default: false }
  },
  
  // Subscription Settings
  subscriptionPlans: [{
    name: { type: String },
    price: { type: Number },
    duration: { type: Number }, // days
    features: [{ type: String }]
  }],
  
  // Contact Information
  contactEmail: { type: String },
  supportPhone: { type: String },
  
  // System Settings
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'System is currently under maintenance.' },
  
  // Meta
  lastUpdated: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);