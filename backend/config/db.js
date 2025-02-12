// // config/db.js
// const mongoose = require('mongoose');
// require('dotenv').config(); // Load environment variables

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    // const mongoURI = `${process.env.URL}/${process.env.DBNAME}`;
    // await mongoose.connect(mongoURI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;