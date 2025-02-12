import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const FilesList = () => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        console.log('Fetching files...');
        const response = await axios.get('http://localhost:8000/api/files');
        console.log('Response:', response.data);
        setFiles(response.data);
      } catch (error) {
        console.error('Error:', error);
        setError(error.message);
      }
    };
    fetchFiles();
  }, []);

  const openFile = async (fileId) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/files/${fileId}`);
      navigate('/pdf-viewer', {
        state: {
          pdfData: `data:application/pdf;base64,${response.data.content}`,
          title: response.data.title
        }
      });
    } catch (error) {
      console.error('Error opening file:', error);
      toast.error('Failed to open file');
    }
  };

  const deleteFile = async (id) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await axios.delete(`http://localhost:8000/api/files/${id}`);
        setFiles(files.filter(file => file._id !== id));
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  if (error) return <div>Error: {error}</div>;
  if (files.length === 0) return <div>No files found</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-6">My Files ({files.length})</h1>
      <div className="grid gap-4">
        {files.map((file) => (
          <div key={file._id} 
          className="bg-white p-4 rounded-lg shadow flex justify-between items-center hover:bg-gray-50 cursor-pointer"
          onClick={() => openFile(file._id)}
        >
          <span>{file.title}</span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              deleteFile(file._id);
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilesList;