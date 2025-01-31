const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');

// login function

const loginUser = async (req,res) => {
    try {
        const {email, password } = req.body;

        //check if user exist in database 
        const user = await User.findOne({ email });
        if(!user) {
            return res.status(400).json({ message : 'Invalid Email or Password'}); 
        }

        // comapre the entered password with hashed password stored in the database 
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch) {
            return res.status(400).json({ message : 'Invalid Email or Password'});
        }

        //Generate  a JWT token with the user's ID and role
        const token = jwt.sign(
            {userId:user._id,role: user.role},
            process.env.JWT_SECRET, // use the secret key from .env
            { expiresIn : '2h'} // Token will expire in 2 hour
        );

        //send the token and a sucess message to the client 
        res.status(200).json({ token, message: 'Login successful'});

    } catch (error) {
        console.error('Login error: ',error);
        res.status(500).json({ message: 'Server error'});
    }
};

module.exports = loginUser;