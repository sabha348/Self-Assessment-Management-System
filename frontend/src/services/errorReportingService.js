import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const reportError = async (error, componentName = 'Unknown') => {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user')) || {};
    
    // Ensure we have these fields for error reporting
    const payload = {
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
      component: componentName,
      url: window.location.href,
      userName: user?.name || 'Anonymous User',
      userEmail: user?.email || 'unknown@example.com'
    };
    
    console.log("Reporting error with payload:", payload);

    await axios.post(`${API_URL}/errors/report`, payload, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    });
  } catch (reportingError) {
    console.error('Failed to report error to server:', reportingError);
  }
};