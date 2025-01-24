const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
    planName: { type: String, required: true },
    features: [{ type: String }],
    price: { type: Number, required: true },
    duration: { type: Number }, // In months
  });
  
  module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
  