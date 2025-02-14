import React, { useState } from 'react';
import { authService } from '../../services/authService';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    gender: '',
    mobileno: '',
    password: '',
  });

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await authService.register(userData);
      alert('Registration successful! Please log in.');
      navigate('/login'); // Redirect to login page
    } catch (error) {
      alert('Registration failed. Try again.');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-white">
      <div className="w-full max-w-4xl bg-gray-100 p-8 rounded-lg shadow-lg flex">
        {/* Left Section */}
        <div className="w-1/2 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Join the Self-Assessment Hub</h2>
          <p className="text-gray-700 mb-6">
            Enhance your learning with AI-powered quizzes, performance tracking, and smart study scheduling.
          </p>
          <p className="text-gray-600">Start your journey to smarter learning today!</p>
        </div>

        {/* Right Section - Registration Form */}
        <div className="w-1/2 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Account</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700">Full Name</label>
              <input
                type="text"
                name="name"
                className="w-full p-2 border rounded-lg"
                placeholder="Enter your name"
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                className="w-full p-2 border rounded-lg"
                placeholder="Enter your email"
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700">Gender</label>
              <select
                name="gender"
                className="w-full p-2 border rounded-lg"
                onChange={handleChange}
                required
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-700">Mobile Number</label>
              <input
                type="text"
                name="mobileno"
                className="w-full p-2 border rounded-lg"
                placeholder="Enter your mobile number"
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700">Password</label>
              <input
                type="password"
                name="password"
                className="w-full p-2 border rounded-lg"
                placeholder="Enter your password"
                onChange={handleChange}
                required
              />
            </div>
            <button type="submit" className="w-full bg-black text-white py-2 rounded-lg">
              Sign Up
            </button>
          </form>
          <p className="text-center text-gray-700 mt-4">
            Already have an account? <Link to="/login" className="text-blue-600">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
