const bcrypt = require('bcrypt');
const User = require('../models/Users');

const registerUser = async (req, res) => {
    try {
        const { name, email, gender, mobileno, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if(existingUser)
        {
            return res.status(400).json({ message : 'User already exists' });
        }

        // Hash the password 
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);

        const newUser = new User({
            name,
            email,
            gender,
            mobileno,
            password: hashedPassword
        });

        //save user to the database 
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message : 'server error'});
    }
};

module.exports = registerUser;