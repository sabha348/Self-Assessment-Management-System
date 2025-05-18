require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRouter');
const folderRoutes = require('./routes/folderRoutes');
const fileRoutes = require('./routes/fileRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const quizRoutes = require('./routes/quizRouter');
const registerUser = require('./authentication/register');
const loginUser = require('./authentication/login'); 
const adminRoutes = require('./routes/adminRoutes');
const { upload, uploadFile, getFiles } = require('./services/fileService');
const assessmentRouter = require('./routes/assessmentRouter');
const userAnalyticsRouter = require('./routes/userAnalyticsRouter'); // Add this line with your other router imports
const mongoose = require('mongoose');
// const upgradeMembership = require('./routes/membership');
const paymentRoutes = require('./routes/paymentRouter'); 
const helpRequestRouter = require('./routes/helpRequestRouter'); // Add this line with your other router imports and registrations
const errorRoutes = require('./routes/errorRoutes'); // Add this line with your other router imports

// Add this after all your route imports
const errorHandler = require('./middleware/errorHandler');

const app = express();
const port = process.env.PORT || 8000; // Changed port to 8000

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ["http://localhost:3000", "https://sams-frontend-blush.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Add this line before your routes
app.use(express.static('public'));

// app.use(cors({
//   origin: "http://localhost:3000", // Replace with your frontend URL
//   methods: "GET,POST,PUT, DELETE, OPTIONS",
//   credentials: true
// }));
// Then in server.js:
app.use(bodyParser.json());
// Update body-parser configuration with increased limits
app.use(express.json({ limit: '100mb' })); // Increased from 50mb to 100mb
app.use(express.urlencoded({ limit: '100mb', extended: true, parameterLimit: 100000 })); // Added parameterLimit

app.use('/api', helpRequestRouter); // Add this line with your other app.use statements

// Routes
app.use('/api/quizzes', quizRoutes);
app.use('/api/auth/register', registerUser);
app.use('/api/auth/login', loginUser);
app.use('/api/user', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/timetable', timetableRoutes); // Keeping this existing route
app.use('/api/assessment', assessmentRouter); // Added new quiz router
app.use('/api/payment',paymentRoutes);
app.use('/api/admin', adminRoutes);

// app.use('/api/membership/upgrade',upgradeMembership);
app.use('/api/analytics', userAnalyticsRouter); // Add this line with your other app.use statements
// app.use('/api/errors', errorRoutes); // Add this with your other routes


// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Error handling middleware
// app.use((err, req, res, next) => {
//   console.error('Server error:', err);
  
//   // Send a formatted error response
//   res.status(err.status || 500).json({
//     error: err.message || 'An unexpected error occurred',
//     details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   });
// });

// Add this after all your app.use() routes but before app.listen()
// app.use(errorHandler);

app.listen(port, () => {
  console.log(`Assessment server running on port ${port}`);
});
