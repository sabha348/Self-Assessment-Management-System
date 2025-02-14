const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authenticate');
const authorizeRole = require('../middleware/authorize');

// Route to create a new user (Registration should be public)
router.post('/', userController.createUser);

// Route to get all users (Only admin should have access)
router.get('/', userController.getAllUsers);

// Route to get a user by ID (Users can only see their own profile unless admin)
router.get('/:id', authenticateToken, userController.getUserById);

// Route to update a user by ID (Users can update their own profile, admin can update any)
router.put('/:id', authenticateToken, userController.updateUser);

// Route to delete a user by ID (Only admins should be able to delete any user)
router.delete('/:id', authenticateToken, authorizeRole('admin'), userController.deleteUserById);

// Route to delete all users (Highly restricted - Admin only)
router.delete('/', authenticateToken, authorizeRole('admin'), userController.deleteAllUsers);

module.exports = router;
