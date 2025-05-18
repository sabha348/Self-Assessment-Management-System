import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';


export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  // Retrieve token from localStorage
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    const response = await axios.post(
      `${API_URL}/files/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`, // Attach token in headers
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error('File upload failed');
  }
};
