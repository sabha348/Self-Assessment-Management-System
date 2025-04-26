const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('email',email);

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('user',user);
        console.log('user.password',user.password);
        console.log('password',password);

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('isMatch',isMatch);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // After successful password verification, update lastLogin
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role, membership: user.membership, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // Send token via HTTP-only cookie (optional)
        res.cookie('token', token, {
            httpOnly: true, // Prevents JavaScript access
            secure: process.env.NODE_ENV === 'production', // Only secure in production
            sameSite: 'Strict',
            maxAge: 2 * 60 * 60 * 1000 // 2 hours
        });

        // Send response
        res.status(200).json({
            message: 'Login successful',
            token, // Only if you want token in response
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                membership: user.membership,
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = loginUser;
