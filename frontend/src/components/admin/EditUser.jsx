import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './EditUser.css';


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';


const EditUser = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(`${API_URL}/admin/users/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        setUser(response.data.user);
        setFormData({
          name: response.data.user.name,
          email: response.data.user.email,
          role: response.data.user.role
        });
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch user');
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put(
        `${API_URL}/admin/users/${id}`,
        formData,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      setUser(response.data);
      setSuccess('User updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user');
    }
  };

  const resetPassword = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/admin/users/${id}/reset-password`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      setTempPassword(response.data.temporaryPassword);
      setShowResetModal(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  if (loading) {
    return <div className="loading">Loading user...</div>;
  }

  if (!user) {
    return <div className="error">User not found</div>;
  }

  return (
    <div className="edit-user">
      <div className="page-header">
        <button className="btn btn-back" onClick={() => navigate('/admin/users')}>
          &larr; Back to Users
        </button>
        <h1>Edit User</h1>
      </div>
      
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      
      <div className="user-info-card">
        <div className="user-header">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="user-meta">
            <h2>{user.name}</h2>
            <p>Member since {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
            <button 
              type="button" 
              className="btn btn-warning" 
              onClick={resetPassword}
            >
              Reset Password
            </button>
          </div>
        </form>
      </div>
      
      {showResetModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Password Reset</h2>
            <p>The user's password has been reset. Please provide them with this temporary password:</p>
            <div className="temp-password">
              <code>{tempPassword}</code>
            </div>
            <p>They will be prompted to change it on their next login.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowResetModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditUser;