const User = require('../models/Users');
const Notification = require('../models/Notification');
const bcrypt = require('bcrypt');

exports.createUser = async (req, res) => {
    try{
        const { name, email, gender, mobileno, password, role,membership } = req.body;
        const newUser = new User({
            name,
            email,
            gender,
            mobileno,
            password,
            role,
            membership,
            
        });
        await newUser.save();
        res.status(201).json({message : 'User created successfully! '});
    } catch (error) {
        res.status(400).json({ error : error.message });
    }
};


// Get All Users 

exports.getAllUsers = async (req, res) => {
    try {
      const users = await User.find();
      res.status(200).json(users);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
};

// Get User By Id 
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        // console.log(user);
        if(!user) {
            return res.status(404).json({ message : 'User Not Found '});
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(404).json({ error : error.message });
    }
};

// Update a User by Id
exports.updateUser = async (req, res) => {
    try {
        const { name, email, gender, mobileno, role, membership } = req.body;
        // Remove password from direct updates
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            {
                name,
                email,
                gender,
                mobileno,
                role,
                membership
                // password removed from here
            },
            { new: true, runValidators: true } 
        );
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found'});
        }
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a user By Id
exports.deleteUserById = async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Create notification for admin if requested
      if (req.body.notifyAdmin) {
        await Notification.create({
          type: 'account_deletion',
          message: `User account deleted: ${req.body.userName}`,
          userName: req.body.userName,
          userEmail: req.body.userEmail,
          userId: req.params.id,
        });
      }
      
      res.status(200).json({ message: 'User deleted successfully!' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
};


// Delete all users
exports.deleteAllUsers = async (req, res) => {
    try {
      await User.deleteMany();
      res.status(200).json({ message: 'All users deleted successfully!' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
};

// Add this function to your userController.js
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId; // From auth middleware
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating password', error: error.message });
  }
};
