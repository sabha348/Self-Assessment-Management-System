import React, { useState } from 'react';
import { authService } from '../../services/authService';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await authService.login(credentials);
      alert('Login successful!');
      navigate('/dashboard'); // Redirect after login
    } catch (error) {
      alert('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-white">
      <div className="w-full max-w-4xl bg-gray-100 p-8 rounded-lg shadow-lg flex">
        {/* Left Section */}
        <div className="w-1/2 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome Back to the Self-Assessment Hub</h2>
          <p className="text-gray-700 mb-6">
            Continue your learning journey with AI-powered quizzes, performance tracking, and smart study scheduling.
          </p>
          <p className="text-gray-600">Log in to access your personalized study experience.</p>
        </div>

        {/* Right Section - Login Form */}
        <div className="w-1/2 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Login</h2>
          <form onSubmit={handleSubmit}>
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
              Login
            </button>
          </form>
          <p className="text-center text-gray-700 mt-4">
            New user? <Link to="/register" className="text-blue-600">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
