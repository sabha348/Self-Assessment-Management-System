import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  // Check if user is authenticated AND has admin role
  if (!isAuthenticated || user?.role !== 'admin') {
    // Redirect non-admin users to login or dashboard
    return <Navigate to="/login" replace />;
  }
  
  // Render admin layout for admin users
  return children;
};

export default AdminRoute;