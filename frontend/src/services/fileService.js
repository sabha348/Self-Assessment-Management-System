import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const errorMessage = (error) =>
  error?.response?.data?.error || error?.message || 'File upload failed';

/**
 * Upload a PDF. Where the server uses Vercel Blob, the browser uploads straight
 * to storage (no 4.5 MB limit from the API function) and then registers the file;
 * otherwise the file is posted to the API as before.
 * Returns { _id, title, ragStatus }.
 */
export const uploadFile = async (file, { onProgress } = {}) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');
  const auth = { Authorization: `Bearer ${token}` };

  let mode = 'direct';
  let maxMb = 25;
  try {
    const { data } = await axios.get(`${API_URL}/files/upload-mode`, { headers: auth });
    mode = data.mode;
    maxMb = data.maxMb || maxMb;
  } catch (e) {
    // Older servers have no upload-mode endpoint: use the direct upload.
  }
  if (file.size > maxMb * 1024 * 1024) throw new Error(`PDFs can be up to ${maxMb} MB`);

  try {
    if (mode === 'blob') {
      const { upload } = await import('@vercel/blob/client');
      const { userId } = jwtDecode(token);
      const safeName = file.name.replace(/[^\w.\- ]+/g, '_').replace(/\.pdf$/i, '') + '.pdf';
      const blob = await upload(`pdfs/${userId}/${safeName}`, file, {
        access: 'private',
        contentType: 'application/pdf',
        handleUploadUrl: `${API_URL}/files/blob-upload`,
        headers: auth,
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
      });
      const { data } = await axios.post(
        `${API_URL}/files/register`,
        { pathname: blob.pathname, title: file.name },
        { headers: auth }
      );
      return data;
    }

    const formData = new FormData();
    formData.append('file', file);
    const { data } = await axios.post(`${API_URL}/files/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data', ...auth },
    });
    return data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
};
