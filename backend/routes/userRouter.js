// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controller/userController');


// Route to create a new user
router.post('/', userController.createUser);

// Route to get all users
router.get('/', userController.getAllUsers);

// Route to get a user by ID
router.get('/:id', userController.getUserById);

// Route to update a user by ID
router.put('/:id', userController.updateUser);

router.delete('/:id',userController.deleteUserById);

// Route to delete all users
router.delete('/', userController.deleteAllUsers);


module.exports = router;
