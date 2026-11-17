// // config/db.js
// const mongoose = require('mongoose');
// require('dotenv').config(); // Load environment variables

const mongoose = require('mongoose');
require('dotenv').config();

// One connection per process, reused across requests (a warm serverless
// instance handles many). Queries made before it connects are buffered by
// mongoose. A failed connect is retried on the next call instead of killing the
// process, which on a serverless platform would fail every request.
let connecting = null;
const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!connecting) {
    connecting = mongoose
      .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then((m) => {
        console.log('MongoDB connected successfully');
        return m.connection;
      })
      .catch((error) => {
        console.error('MongoDB connection failed:', error.message);
        connecting = null;
        throw error;
      });
  }
  return connecting;
};

module.exports = connectDB;