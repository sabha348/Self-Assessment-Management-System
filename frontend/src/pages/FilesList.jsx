import React, { useRef, useState, useEffect } from 'react';
import { uploadFile } from '../services/fileService';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import { useNavigate,useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import 'react-toastify/dist/ReactToastify.css';
import { jwtDecode } from "jwt-decode";

// Import Material UI components
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  FormControl, InputLabel, Select, MenuItem, 
  FormGroup, FormControlLabel, Checkbox,
  Typography, Button, Box, Grid, Paper, IconButton
} from '@mui/material';

// Import icons
import DeleteIcon from '@mui/icons-material/Delete';
import FileIcon from '@mui/icons-material/InsertDriveFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SettingsIcon from '@mui/icons-material/Settings';
import TimeIcon from '@mui/icons-material/AccessTime';
import DateIcon from '@mui/icons-material/DateRange';

const FilesList = () => {
  const location = useLocation();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);

  const handleUpload = () => {
    fileInputRef.current.click();
  };

  // Get token from localStorage
  const token = localStorage.getItem('token');

    useEffect(() => {
      const fetchUser = async () => {
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            navigate("/login");
            return;
          }
  
          
          // Decode token to get user ID
          const decoded = jwtDecode(token);
          const userId = decoded.userId;
  
          // Fetch the latest user data from backend
          const response = await axios.get(`http://localhost:8000/user/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
  
  
          if (!response) {
            throw new Error("Failed to fetch user data");
          }
  
          const userData = await response.data;
          // console.log(userData);
          setCurrentUser(userData); // Update state with fresh data
        } catch (error) {
          console.error("Fetching user error:", error);
        }
      };
  
      fetchUser();
    }, [location.pathname]);
  

  // Question generation configuration state
  const [questionConfig, setQuestionConfig] = useState(() => {
    // Try to load from localStorage or use defaults
    const savedConfig = localStorage.getItem('questionConfigPrefs');
    return savedConfig ? JSON.parse(savedConfig) : {
      numQuestions: 5,
      difficulty: 'medium',
      questionTypes: ['open-ended'],
      timeLimit: 0 // 0 means no time limit
    };
  });

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:8000/api/files', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFiles(response.data);
      } catch (error) {
        console.error('Error:', error);
        setError(error.response?.data?.message || 'Failed to fetch files');
        toast.error('Failed to fetch files');
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      fetchFiles();
    } else {
      navigate('/login');
    }
  }, [token, navigate]);

  // Save config when it changes
  useEffect(() => {
    localStorage.setItem('questionConfigPrefs', JSON.stringify(questionConfig));
  }, [questionConfig]);

  const openFile = async (fileId) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      navigate('/pdf-viewer', {
        state: {
          pdfData: `data:application/pdf;base64,${response.data.content}`,
          title: response.data.title,
          // Pass question configuration settings
          questionConfig: questionConfig
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
        await axios.delete(`http://localhost:8000/api/files/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFiles(files.filter(file => file._id !== id));
        toast.success('File deleted successfully');
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete file');
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSaveConfig = () => {
    // Save to localStorage
    localStorage.setItem('questionConfigPrefs', JSON.stringify(questionConfig));
    
    // Save to backend for user preferences (optional)
    const saveToBackend = async () => {
      try {
        await axios.post('http://localhost:8000/api/user/preferences', 
          { questionConfig },
          { headers: { Authorization: `Bearer ${token}` }}
        );
        toast.success('Question generation settings saved!');
      } catch (error) {
        console.error('Failed to save preferences:', error);
        // No need to show error, localStorage is already saved
      }
    };
    
    saveToBackend();
    setConfigDialogOpen(false);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (50MB limit)
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
      
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File size exceeds 50MB limit');
        return;
      }

      let loadingToast;
      try {
        // Show loading toast
        loadingToast = toast.loading('Uploading file...');
        
        const response = await uploadFile(file);
        
        // Dismiss loading toast and show success
        toast.dismiss(loadingToast);
        toast.success('File uploaded successfully');
        
        // Navigate to PDF viewer with the data
        navigate('/pdf-viewer', {
          state: {
            pdfData: `data:application/pdf;base64,${response.content}`,
            title: file.name
          }
        });
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Failed to upload file: ' + (error.message || 'Unknown error'));
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 flex justify-center items-center">
        <div className="text-xl font-semibold text-gray-600">Loading files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf"
      />

      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 flex items-center gap-1 transition"
            >
              <span>←</span> Back
            </button>
            <h1 className="text-2xl font-bold">My Documents</h1>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleUpload}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Upload New
            </button>
            <button 
              onClick={() => setConfigDialogOpen(true)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 flex items-center gap-2 transition"
            >
              <SettingsIcon fontSize="small" />
              Question Settings
            </button>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-10 text-center">
            <div className="text-5xl text-gray-300 mb-4 flex justify-center">
              <FileIcon style={{ fontSize: '5rem' }} />
            </div>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">No files yet</h2>
            <p className="text-gray-500 mb-6">Upload a PDF document to generate questions and assessments</p>
            <button 
              onClick={handleUpload}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Upload Your First Document
            </button>
          </div>
        ) : (
          <Grid container spacing={3}>
            {files.map((file) => (
              <Grid item xs={12} sm={6} md={4} key={file._id}>
                <Paper
                  elevation={2}
                  className="hover:shadow-md transition-shadow"
                  sx={{ borderRadius: 2, overflow: 'hidden' }}
                >
                  <div
                    className="h-40 bg-gray-100 flex items-center justify-center cursor-pointer"
                    onClick={() => openFile(file._id)}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: 60, color: '#e53e3e' }} />
                  </div>
                  
                  <Box p={2}>
                    <div className="flex justify-between items-start">
                      <Typography 
                        variant="h6" 
                        sx={{ fontWeight: 600, mb: 1, maxWidth: '80%' }}
                        className="truncate"
                      >
                        {file.title || 'Untitled Document'}
                      </Typography>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFile(file._id);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </div>
                    
                    <div className="text-xs text-gray-500 flex items-center mt-2">
                      <DateIcon fontSize="small" sx={{ mr: 0.5, fontSize: 16 }} />
                      Uploaded {formatDate(file.createdAt)}
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <Button 
                        variant="outlined" 
                        size="small"
                        onClick={() => openFile(file._id)}
                        sx={{ 
                          borderRadius: '8px', 
                          fontSize: '0.75rem',
                          textTransform: 'none'
                        }}
                      >
                        Open Document
                      </Button>
                    </div>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </div>

      {/* Question Configuration Dialog */}
      <Dialog 
        open={configDialogOpen} 
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Question Generation Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure default settings for all question generation
          </Typography>
        </DialogTitle>
        
        <DialogContent dividers>
          {/* Number of Questions */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Number of Questions</InputLabel>
            <Select
              value={questionConfig.numQuestions}
              onChange={(e) => setQuestionConfig({...questionConfig, numQuestions: e.target.value})}
              disabled={currentUser.membership === 'free'} // Disable selection for free users
            >
              <MenuItem value={3}>3 questions</MenuItem>
              <MenuItem value={5}>5 questions</MenuItem>
              <MenuItem value={8}>8 questions</MenuItem>
              <MenuItem value={10}>10 questions</MenuItem>
            </Select>
          </FormControl>

          {/* Difficulty Selection */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Difficulty</InputLabel>
            <Select
              value={currentUser.membership === 'free' ? 'medium' : questionConfig.difficulty}
              onChange={(e) => setQuestionConfig({...questionConfig, difficulty: e.target.value})}
              disabled={currentUser.membership === 'free'} // Restrict free users
            >
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
              <MenuItem value="mixed">Mixed</MenuItem>
            </Select>
          </FormControl>

          {/* Time Limit */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Time Limit</InputLabel>
            <Select
              value={questionConfig.timeLimit}
              onChange={(e) => setQuestionConfig({...questionConfig, timeLimit: e.target.value})}
            >
              <MenuItem value={0}>No time limit</MenuItem>
              <MenuItem value={1}>1 minute</MenuItem>
              <MenuItem value={5}>5 minutes</MenuItem>
              <MenuItem value={10}>10 minutes</MenuItem>
              <MenuItem value={15}>15 minutes</MenuItem>
              <MenuItem value={30}>30 minutes</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Question Types
          </Typography>

          <FormGroup>
            {/* Open-Ended (Always Selected for Free Users) */}
            <FormControlLabel
              control={
                <Checkbox 
                  checked={questionConfig.questionTypes.includes('open-ended')}
                  onChange={(e) => {
                    if (currentUser.membership === 'free') return; // Prevent free users from unchecking
                    const newTypes = e.target.checked
                      ? [...questionConfig.questionTypes.filter(t => t !== 'mixed'), 'open-ended']
                      : questionConfig.questionTypes.filter(t => t !== 'open-ended');
                    setQuestionConfig({...questionConfig, questionTypes: newTypes.length ? newTypes : ['mixed']});
                  }}
                />
              }
              label="Open Ended"
            />

            {/* Other question types (Disabled for Free Users) */}
            <FormControlLabel
              control={
                <Checkbox 
                  checked={questionConfig.questionTypes.includes('mcq')}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...questionConfig.questionTypes.filter(t => t !== 'mixed'), 'mcq']
                      : questionConfig.questionTypes.filter(t => t !== 'mcq');
                    setQuestionConfig({...questionConfig, questionTypes: newTypes.length ? newTypes : ['mixed']});
                  }}
                  disabled={currentUser.membership === 'free'}
                />
              }
              label="Multiple Choice"
            />

            <FormControlLabel
              control={
                <Checkbox 
                  checked={questionConfig.questionTypes.includes('true-false')}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...questionConfig.questionTypes.filter(t => t !== 'mixed'), 'true-false']
                      : questionConfig.questionTypes.filter(t => t !== 'true-false');
                    setQuestionConfig({...questionConfig, questionTypes: newTypes.length ? newTypes : ['mixed']});
                  }}
                  disabled={currentUser.membership === 'free'}
                />
              }
              label="True/False"
            />

            <FormControlLabel
              control={
                <Checkbox 
                  checked={questionConfig.questionTypes.includes('mixed')}
                  onChange={(e) => {
                    setQuestionConfig({...questionConfig, questionTypes: e.target.checked ? ['mixed'] : ['open-ended']});
                  }}
                  disabled={currentUser.membership === 'free'}
                />
              }
              label="Mixed (All Types)"
            />
          </FormGroup> */}
        </DialogContent>

        
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleSaveConfig} 
            variant="contained" 
            color="primary"
          >
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FilesList;
