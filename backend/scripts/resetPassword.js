const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/Users');
const connectDB = require('../config/db');




async function resetPassword() {
      await connectDB();
    
  try {
    const adminEmail = "sahiladmin@gmail.com";
    const newPassword = "sahiladmin"; // Choose a secure password
    
    // Find the admin user
    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.log('Admin not found');
      process.exit(1);
      return;
    }
    
    // Hash and set the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();
    
    console.log('Admin password reset successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

// Run the function
resetPassword();