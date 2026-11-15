import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'loading', message: '' });
    try {
      const data = await authService.forgotPassword(email);
      setStatus({ state: 'sent', message: data.message });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error.response?.data?.message || 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-white px-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Forgot your password?</h2>
        <p className="text-gray-600 mb-4">Enter your account email and we'll send you a reset link.</p>
        {status.state === 'sent' ? (
          <p className="text-green-700 bg-green-50 p-3 rounded-lg" role="status">{status.message}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-gray-700" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="w-full p-2 border rounded-lg mb-4"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {status.state === 'error' && <p className="text-red-600 mb-3" role="alert">{status.message}</p>}
            <button
              type="submit"
              disabled={status.state === 'loading'}
              className="w-full bg-black text-white py-2 rounded-lg disabled:opacity-60"
            >
              {status.state === 'loading' ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="text-center text-gray-700 mt-4">
          <Link to="/login" className="text-blue-600">Back to login</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
