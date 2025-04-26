import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './UserDetail.css';

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/admin/users/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        setUserData(response.data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch user data');
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id]);

  if (loading) {
    return <div className="loading">Loading user data...</div>;
  }

  if (error || !userData) {
    return <div className="error">{error || 'User not found'}</div>;
  }

  const { user, stats } = userData;

  return (
    <div className="user-detail">
      <div className="page-header">
        <button className="btn btn-back" onClick={() => navigate('/admin/users')}>
          &larr; Back to Users
        </button>
        <h1>User Details</h1>
      </div>
      
      <div className="user-profile">
        <div className="profile-header">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="user-info">
            <h2>{user.name}</h2>
            <p className="email">{user.email}</p>
            <div className="badges">
              <span className={`badge ${user.role}`}>{user.role}</span>
              {stats.subscription && (
                <span className="badge subscription">
                  {stats.subscription.plan}
                </span>
              )}
            </div>
          </div>
          <div className="header-actions">
            {/* <Link to={`/admin/users/${user._id}/edit`} className="btn btn-secondary">
              Edit User
            </Link> */}
          </div>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Assessments</h3>
            <div className="stat-value">{stats.assessmentsCount}</div>
          </div>
          
          <div className="stat-card">
            <h3>Member Since</h3>
            <div className="stat-value">
              {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>
          
          <div className="stat-card">
            <h3>Last Login</h3>
            <div className="stat-value">
              {user.lastLogin 
                ? new Date(user.lastLogin).toLocaleString() 
                : 'Never logged in'}
            </div>
          </div>
          
          <div className="stat-card">
            <h3>Subscription</h3>
            <div className="stat-value">
              {stats.subscription 
                ? `${stats.subscription.plan} (${stats.subscription.status})` 
                : 'No subscription'}
            </div>
          </div>
        </div>
        
        {/* <div className="user-activity">
          <h3>Recent Activity</h3>
          {/* This would be populated with actual user activity data */}
          {/* <p className="placeholder">Activity tracking coming soon...</p> */}
        {/* </div> */} 
      </div>
    </div>
  );
};

export default UserDetail;