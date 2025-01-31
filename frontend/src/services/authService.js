// src/services/authService.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const authService = {
  login: async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, credentials);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  register: async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getUserProfile: async (token) => {
    try {
      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: { 
          'Authorization': `Bearer ${token}` 
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};