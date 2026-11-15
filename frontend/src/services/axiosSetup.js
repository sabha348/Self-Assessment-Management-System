import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Attach the JWT to every request sent to our own API, so routes that
// require authentication work even where a call site forgot the header.
// Requests to third-party hosts are left untouched.
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const url = config.url || '';
  const isOwnApi = url.startsWith(API_URL) || url.startsWith('/api');
  if (token && isOwnApi && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
