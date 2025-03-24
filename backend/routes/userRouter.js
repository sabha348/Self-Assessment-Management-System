const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authenticate');
const authorizeRole = require('../middleware/authorize');
const UserAnswer = require('../models/UserAnswer'); // Make sure path matches your project structure
// Import the TopicMastery model
const AssessmentResult = require('../models/AssessmentResult');
const Users = require('../models/Users');

// Route to create a new user (Registration should be public)
router.post('/', userController.createUser);

// Route to get all users (Only admin should have access)
router.get('/', userController.getAllUsers);




// Add this route to your existing userRouter.js

// Save user preferences
router.post("/preferences", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { questionConfig } = req.body;
    
    if (!questionConfig) {
      return res.status(400).json({ message: "No configuration provided" });
    }
    
    // Update user document with new preferences
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          "preferences.questionConfig": questionConfig 
        } 
      },
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({ message: "Preferences saved successfully" });
    
  } catch (error) {
    console.error("Error saving preferences:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get user preferences
router.get("/preferences", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Return preferences or default values if not set
    const preferences = user.preferences || { 
      questionConfig: {
        numQuestions: 5,
        difficulty: 'medium',
        questionTypes: ['open-ended'],
        timeLimit: 0
      }
    };
    
    res.json(preferences);
    
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



// Route to get a user by ID (Users can only see their own profile unless admin)
router.get('/:id', authenticateToken, userController.getUserById);

// Route to update a user by ID (Users can update their own profile, admin can update any)
router.put('/:id', authenticateToken, userController.updateUser);

// Route to delete a user by ID (Only admins should be able to delete any user)
router.delete('/:id', authenticateToken, authorizeRole('admin'), userController.deleteUserById);

// Route to delete all users (Highly restricted - Admin only)
router.delete('/', authenticateToken, authorizeRole('admin'), userController.deleteAllUsers);


router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    console.log(userId);
    const user = await User.findById(userId);
    console.log(user);
    res.json(user); // Returns decoded user info (userId, role, membership)
  } catch (error) {
      res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
