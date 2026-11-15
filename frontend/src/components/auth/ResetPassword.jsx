import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';

const MIN_LENGTH = 8;

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token || !email) {
    return (
      <div className="flex justify-center items-center min-h-screen px-4">
        <p>
          This reset link is incomplete. <Link to="/forgot-password" className="text-blue-600">Request a new one</Link>.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) return setError(`Password must be at least ${MIN_LENGTH} characters.`);
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await authService.resetPassword({ email, token, password });
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset the password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-white px-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Choose a new password</h2>
        <p className="text-gray-600 mb-4">for {email}</p>
        <form onSubmit={handleSubmit}>
          <label className="block text-gray-700" htmlFor="password">New password</label>
          <input id="password" type="password" autoComplete="new-password" className="w-full p-2 border rounded-lg mb-3"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <label className="block text-gray-700" htmlFor="confirm">Repeat new password</label>
          <input id="confirm" type="password" autoComplete="new-password" className="w-full p-2 border rounded-lg mb-4"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {error && <p className="text-red-600 mb-3" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-black text-white py-2 rounded-lg disabled:opacity-60">
            {loading ? 'Saving…' : 'Reset password'}
          </button>
        </form>
        {error && (
          <p className="text-center mt-4"><Link to="/forgot-password" className="text-blue-600">Request a new link</Link></p>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
