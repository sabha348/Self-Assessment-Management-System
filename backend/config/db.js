// config/db.js
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

const connectDB = async () => {
  try {
    const mongoURI = `${process.env.URL}/${process.env.DBNAME}`;
    await mongoose.connect(mongoURI);
    console.log(`MongoDB connected successfully to ${process.env.DBNAME}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;