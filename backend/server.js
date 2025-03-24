const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRouter');
const fileRoutes = require('./routes/fileRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const assessmentRoutes = require('./routes/assessmentRouter');
const registerUser = require('./authentication/register');
const loginUser = require('./authentication/login'); 
const { upload, uploadFile, getFiles } = require('./services/fileService');
const quizRouter = require('./routes/quizRouter');
const masteryRouter = require('./routes/masteryRouter'); // Add this line with your other router imports
const userAnalyticsRouter = require('./routes/userAnalyticsRouter'); // Add this with your other router imports and registrations
const mongoose = require('mongoose');
// const upgradeMembership = require('./routes/membership');
const paymentRoutes = require('./routes/paymentRouter'); 


const app = express();
const port = process.env.PORT || 8000; // Changed port to 8000

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


// app.use(cors({
//   origin: "http://localhost:3000", // Replace with your frontend URL
//   methods: "GET,POST,PUT, DELETE, OPTIONS",
//   credentials: true
// }));

app.use(bodyParser.json());
// Update body-parser configuration with increased limits
app.use(express.json({ limit: '100mb' })); // Increased from 50mb to 100mb
app.use(express.urlencoded({ limit: '100mb', extended: true, parameterLimit: 100000 })); // Added parameterLimit

// Routes
app.use('/api/assessment', assessmentRoutes);
app.use('/api/auth/register', registerUser);
app.use('/api/auth/login', loginUser);
app.use('/user', userRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/timetable', timetableRoutes); // Keeping this existing route
app.use('/api/quizzes', quizRouter); // Added new quiz router
app.use('/api/payment',paymentRoutes);

// app.use('/api/membership/upgrade',upgradeMembership);
app.use('/api/mastery', masteryRouter); // Add this line with your other app.use statements
app.use('/api/user-analytics', userAnalyticsRouter); // Add this with your other app.use statements

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Send a formatted error response
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(port, () => {
  console.log(`Assessment server running on port ${port}`);
});
