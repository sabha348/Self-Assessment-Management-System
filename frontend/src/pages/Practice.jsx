import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Container, 
  Grid2, 
  Card, 
  CardActionArea, 
  CardContent, 
  CardMedia, 
  Typography, 
  Box, 
  CircularProgress,
  Button,
  Breadcrumbs,
  Link as MuiLink,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Fade,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  TextField,
} from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import QuizIcon from '@mui/icons-material/Quiz';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ListIcon from '@mui/icons-material/List'; // Added missing icon
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
// Comment out ForceGraph if you're not using it yet
// import { ForceGraph2D } from 'react-force-graph';

// Styled components
const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease-in-out',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: theme.shadows[8],
    '& .MuiCardMedia-root': {
      transform: 'scale(1.05)',
    }
  },
}));

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  '&:before': {
    display: 'none',
  },
  '&.Mui-expanded': {
    margin: '8px 0',
  }
}));

const ContentWrapper = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(145deg, #f5f7fa 0%, #e4e9f2 100%)',
  minHeight: '100vh',
  padding: theme.spacing(4, 2),
}));

// Subject to image mapping
const subjectImages = {
  "Mathematics": "https://images.unsplash.com/photo-1596495577886-d920f1fb7238?q=80&w=500&auto=format",
  "Physics": "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?q=80&w=500&auto=format",
  "Biology": "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?q=80&w=500&auto=format",
  "Chemistry": "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?q=80&w=500&auto=format",
  "Literature": "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=500&auto=format",
  "History": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=500&auto=format",
  "Geography": "https://images.unsplash.com/photo-1566837945700-30057527ade0?q=80&w=500&auto=format",
  "Computer Science": "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=500&auto=format",
  "Knowledge": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=500&auto=format",
};

// Topic to image mapping
const topicImages = {
  "Calculus": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=500&auto=format",
  "Algebra": "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?q=80&w=500&auto=format",
  "Geometry": "https://images.unsplash.com/photo-1560785496-3c9d27877182?q=80&w=500&auto=format",
};

// Subtopic to image mapping
const subtopicImages = {
  "Calculus": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=500&auto=format",
  "Algebra": "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?q=80&w=500&auto=format",
  "Geometry": "https://images.unsplash.com/photo-1560785496-3c9d27877182?q=80&w=500&auto=format",
};

// Concept to image mapping
const conceptImages = {
  "Linear Equations": "https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=500&auto=format",
  "Differential Calculus": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=500&auto=format",
  "Quadratic Formula": "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?q=80&w=500&auto=format",
};

// Default images
const defaultSubjectImage = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=500&auto=format";
const defaultTopicImage = "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=500&auto=format";
const defaultSubtopicImage = "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=500&auto=format";
const defaultConceptImage = "https://images.unsplash.com/photo-1544256718-3bcf237f3974?q=80&w=500&auto=format";

const Practice = () => {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [conceptQuestions, setConceptQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [assessmentConfigOpen, setAssessmentConfigOpen] = useState(false);
  const [assessmentConfigItem, setAssessmentConfigItem] = useState(null);
  const [assessmentConfigLevel, setAssessmentConfigLevel] = useState(null);
  
  // Add missing state variables
  const [topicProgress, setTopicProgress] = useState({}); // Progress tracking for topics
  const [recommendedItems, setRecommendedItems] = useState([]); // Recommended items
  
  const [editMode, setEditMode] = useState(false);
  const [editingName, setEditingName] = useState(null);
  const [newName, setNewName] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Define missing constants
  const defaultImage = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=500&auto=format";

  // Memoized fetch functions
  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true);
      setProgress(30);
      const response = await axios.get('http://localhost:8000/api/quizzes/subjects');
      setSubjects(response.data.subjects?.length > 0 ? response.data.subjects : [
        "Mathematics", "Physics", "Biology", "Chemistry",
        "Literature", "History", "Geography", "Computer Science"
      ]);
      setProgress(100);
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setError('Failed to load subjects');
      setSubjects([
        "Mathematics", "Physics", "Biology", "Chemistry",
        "Literature", "History", "Geography", "Computer Science"
      ]);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);

  // Update fetchTopics to match case-insensitively
  const fetchTopics = useCallback(async (subject) => {
    try {
      setLoading(true);
      setProgress(30);
      console.log(`Fetching topics for subject: ${subject}`);
      const response = await axios.get(`http://localhost:8000/api/quizzes/topics/${encodeURIComponent(subject)}`);
      console.log('Topics response:', response.data);
      setTopics(response.data.topics || []);
      setProgress(100);
    } catch (err) {
      console.error(`Failed to load topics for ${subject}:`, err);
      setError(`Failed to load topics for ${subject}`);
      setTopics([]);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);

  // Update fetchSubtopics to match case-insensitively  
  const fetchSubtopics = useCallback(async (topic) => {
    try {
      setLoading(true);
      setProgress(30);
      console.log(`Fetching subtopics for topic: ${topic}`);
      const response = await axios.get(`http://localhost:8000/api/quizzes/subtopics/${encodeURIComponent(topic)}`);
      console.log('Subtopics response:', response.data);
      setSubtopics(response.data.subtopics || []);
      setProgress(100);
    } catch (err) {
      console.error(`Failed to load subtopics for ${topic}:`, err);
      setError(`Failed to load subtopics for ${topic}`);
      setSubtopics([]);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);

  const fetchConcepts = useCallback(async (subtopic) => {
    try {
      setLoading(true);
      setProgress(30);
      const response = await axios.get(`http://localhost:8000/api/quizzes/concepts/${encodeURIComponent(subtopic)}`);
      setConcepts(response.data.concepts || []);
      setProgress(100);
    } catch (err) {
      setError(`Failed to load concepts for ${subtopic}`);
      setConcepts([]);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);

  const fetchQuestions = useCallback(async (concept) => {
    try {
      setLoadingQuestions(true);
      const response = await axios.get(`http://localhost:8000/api/quizzes/questions/concept/${encodeURIComponent(concept)}`);
      setConceptQuestions(response.data.questions || []);
    } catch (err) {
      setQuestionError(`Failed to load questions for ${concept}`);
      setConceptQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Handler functions
  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setTopics([]);
    setSubtopics([]);
    setConcepts([]);
    setError(null);
    fetchTopics(subject);
  };

  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
    setSubtopics([]);
    setConcepts([]);
    setError(null);
    fetchSubtopics(topic);
  };

  const handleSubtopicClick = (subtopic) => {
    setSelectedSubtopic(subtopic);
    setConcepts([]);
    setError(null);
    fetchConcepts(subtopic);
  };

  const handleConceptClick = (concept) => {
    setSelectedConcept(concept);
    setConceptQuestions([]);
    setQuestionError(null);
    fetchQuestions(concept);
  };

  const handleNavigationBack = () => {
    if (selectedConcept) {
      setSelectedConcept(null);
      setConceptQuestions([]);
    } else if (selectedSubtopic) {
      setSelectedSubtopic(null);
      setConcepts([]);
    } else if (selectedTopic) {
      setSelectedTopic(null);
      setSubtopics([]);
    } else if (selectedSubject) {
      setSelectedSubject(null);
      setTopics([]);
    }
    setError(null);
  };

  const openAssessmentConfig = (item, level) => {
    setAssessmentConfigItem(item);
    setAssessmentConfigLevel(level);
    setAssessmentConfigOpen(true);
  };

  const closeAssessmentConfig = () => {
    setAssessmentConfigOpen(false);
    setAssessmentConfigItem(null);
    setAssessmentConfigLevel(null);
  };

  // Add missing handler functions
  const handleRecommendationClick = (item) => {
    // Handle clicking on a recommendation
    if (item.type === 'subject') {
      handleSubjectClick(item.name);
    } else if (item.type === 'topic') {
      // First set the parent subject
      setSelectedSubject(item.parentSubject);
      handleTopicClick(item.name);
    } else if (item.type === 'subtopic') {
      // First set the parent subject and topic
      setSelectedSubject(item.parentSubject);
      setSelectedTopic(item.parentTopic);
      handleSubtopicClick(item.name);
    } else if (item.type === 'concept') {
      // Set the entire hierarchy
      setSelectedSubject(item.parentSubject);
      setSelectedTopic(item.parentTopic);
      setSelectedSubtopic(item.parentSubtopic);
      handleConceptClick(item.name);
    }
  };

  const navigateToItem = (item) => {
    // Navigate to the appropriate level for the item
    if (item.type === 'subject') {
      handleSubjectClick(item.name);
    } else if (item.type === 'topic') {
      // First set the parent subject
      setSelectedSubject(item.parentSubject);
      handleTopicClick(item.name);
    } else if (item.type === 'subtopic') {
      // First set the parent subject and topic
      setSelectedSubject(item.parentSubject);
      setSelectedTopic(item.parentTopic);
      handleSubtopicClick(item.name);
    } else if (item.type === 'concept') {
      // Set the entire hierarchy
      setSelectedSubject(item.parentSubject);
      setSelectedTopic(item.parentTopic);
      setSelectedSubtopic(item.parentSubtopic);
      handleConceptClick(item.name);
    }
  };
  
  // Mock data for recommendations until backend is ready
  // Remove this entire useEffect block
  // useEffect(() => {
  //   // This would normally come from the API
  //   const mockRecommendations = [
  //     {
  //       id: 1,
  //       name: "Calculus",
  //       type: "topic",
  //       parentSubject: "Mathematics",
  //       reason: "Weak Area",
  //       image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=500&auto=format"
  //     },
  //     {
  //       id: 2,
  //       name: "Thermodynamics",
  //       type: "topic",
  //       parentSubject: "Physics",
  //       reason: "Next Step",
  //       image: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?q=80&w=500&auto=format"
  //     },
  //     {
  //       id: 3,
  //       name: "Quadratic Equations",
  //       type: "concept",
  //       parentSubject: "Mathematics",
  //       parentTopic: "Algebra",
  //       parentSubtopic: "Equations",
  //       reason: "Popular",
  //       image: "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?q=80&w=500&auto=format"
  //     }
  //   ];
  //   
  //   setRecommendedItems(mockRecommendations);
  //   
  //   // Mock topic progress
  //   const mockProgress = {
  //     "Calculus": 35,
  //     "Algebra": 75,
  //     "Geometry": 50,
  //     "Thermodynamics": 20,
  //     "Mechanics": 85
  //   };
  //   
  //   setTopicProgress(mockProgress);
  // }, []);

  // Replace the mock useEffect with this:
  // useEffect(() => {
  //   const fetchTopicMastery = async () => {
  //     try {
  //       // Get userId from localStorage or your authentication system
  //       const userId = localStorage.getItem('userId') || '';
        
  //       // Try to get mastery data from API
  //       const response = await axios.get('http://localhost:8000/user/topic-mastery', {
  //         headers: {
  //           'Authorization': `Bearer ${localStorage.getItem('token')}`
  //         },
  //         params: { userId }
  //       });
        
  //       if (response.data && Object.keys(response.data).length > 0) {
  //         setTopicProgress(response.data);
  //         return; // Skip localStorage if API worked
  //       }
        
  //       // API had no data, fall back to localStorage
  //       const storedMastery = localStorage.getItem('topicMastery');
  //       if (storedMastery) {
  //         setTopicProgress(JSON.parse(storedMastery));
  //       } else {
  //         // No data anywhere, use mock data
  //         const mockProgress = {
  //           "Calculus": 35,
  //           "Algebra": 75,
  //           "Geometry": 50,
  //           "Thermodynamics": 20,
  //           "Mechanics": 85
  //         };
  //         setTopicProgress(mockProgress);
  //       }
  //     } catch (error) {
  //       console.error("Error fetching topic mastery:", error);
        
  //       // API failed, try localStorage
  //       const storedMastery = localStorage.getItem('topicMastery');
  //       if (storedMastery) {
  //         setTopicProgress(JSON.parse(storedMastery));
  //       } else {
  //         // No data anywhere, use mock data
  //         const mockProgress = {
  //           "Calculus": 35,
  //           "Algebra": 75,
  //           "Geometry": 50,
  //           "Thermodynamics": 20,
  //           "Mechanics": 85
  //         };
  //         setTopicProgress(mockProgress);
  //       }
  //     }
  //   };
    
  //   fetchTopicMastery();
  // }, [location.pathname]);

  // Add these functions to handle edit mode
  const startEditing = (currentName) => {
    setEditMode(true);
    setEditingName(currentName);
    setNewName(currentName);
  };

  const cancelEditing = () => {
    setEditMode(false);
    setEditingName(null);
    setNewName('');
  };

  // Function to handle saving renamed items
const saveRename = async () => {
  if (!newName || newName.trim() === '') {
    return;
  }
  
  try {
    let endpoint, params;
    
    console.log('Saving rename:', {
      editingName,
      newName: newName.trim(),
      selectedConcept, 
      selectedSubtopic,
      selectedTopic,
      selectedSubject
    });
    
    // Determine what we're renaming
    if (selectedConcept && editingName === selectedConcept) {
      // Renaming the selected concept
      endpoint = '/api/quizzes/rename/concept';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        subtopic: selectedSubtopic
      };
    } else if (selectedSubtopic && editingName === selectedSubtopic) {
      // Renaming the selected subtopic
      endpoint = '/api/quizzes/rename/subtopic';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        topic: selectedTopic
      };
    } else if (selectedTopic && editingName === selectedTopic) {
      // Renaming the selected topic
      endpoint = '/api/quizzes/rename/topic';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        subject: selectedSubject
      };
    } else if (selectedSubject && editingName === selectedSubject) {
      // Renaming the selected subject
      endpoint = '/api/quizzes/rename/subject';
      params = {
        oldName: editingName,
        newName: newName.trim()
      };
    } else if (selectedSubtopic && concepts.includes(editingName)) {
      // Renaming a concept in the list
      endpoint = '/api/quizzes/rename/concept';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        subtopic: selectedSubtopic
      };
    } else if (selectedTopic && subtopics.includes(editingName)) {
      // Renaming a subtopic in the list
      endpoint = '/api/quizzes/rename/subtopic';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        topic: selectedTopic
      };
    } else if (selectedSubject && topics.includes(editingName)) {
      // Renaming a topic in the list
      endpoint = '/api/quizzes/rename/topic';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        subject: selectedSubject
      };
    } else if (subjects.includes(editingName)) {
      // Renaming a subject in the list
      endpoint = '/api/quizzes/rename/subject';
      params = {
        oldName: editingName,
        newName: newName.trim()
      };
    } else {
      console.log('No condition matched for rename operation');
      return;
    }
    
    // Add user ID if available
    const userId = localStorage.getItem('userId');
    if (userId) {
      params.userId = userId;
    }
    
    // Get the token from localStorage
    const token = localStorage.getItem('token');
    console.log('Making API call to:', endpoint, 'with params:', params);
    
    // Make API call
    const response = await axios.put(`http://localhost:8000${endpoint}`, params, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('API response:', response.data);
    
    // Update local state based on the renamed item
    if (response.data.success) {
      // Update both the selected state and the array lists
      if (editingName === selectedConcept) {
        setSelectedConcept(newName.trim());
        setConcepts(prev => prev.map(item => item === editingName ? newName.trim() : item));
      } else if (editingName === selectedSubtopic) {
        setSelectedSubtopic(newName.trim());
        setSubtopics(prev => prev.map(item => item === editingName ? newName.trim() : item));
      } else if (editingName === selectedTopic) {
        setSelectedTopic(newName.trim());
        setTopics(prev => prev.map(item => item === editingName ? newName.trim() : item));
      } else if (editingName === selectedSubject) {
        setSelectedSubject(newName.trim());
        setSubjects(prev => prev.map(item => item === editingName ? newName.trim() : item));
      } else if (concepts.includes(editingName)) {
        // We're renaming an item in the list, not the selected item
        setConcepts(prev => prev.map(item => item === editingName ? newName.trim() : item));
      } else if (subtopics.includes(editingName)) {
        setSubtopics(prev => prev.map(item => item === editingName ? newName.trim() : item));
      } else if (topics.includes(editingName)) {
        setTopics(prev => prev.map(item => item === editingName ? newName.trim() : item));
      } else if (subjects.includes(editingName)) {
        setSubjects(prev => prev.map(item => item === editingName ? newName.trim() : item));
      }
      
      // Reset edit state
      setEditMode(false);
      setEditingName(null);
      setNewName('');
    } else {
      console.error('API returned success: false');
      alert('Failed to rename item. Please try again.');
    }
  } catch (error) {
    console.error('Error renaming item:', error);
    alert('Error renaming item: ' + (error.response?.data?.error || error.message));
  }
};

// Add this function to the Practice component

const handleDelete = async (item, level, parentItem) => {
  // Confirm deletion
  if (!window.confirm(`Are you sure you want to delete ${level}: ${item}? This will remove all associated questions and cannot be undone.`)) {
    return;
  }
  
  try {
    let endpoint = `/api/quizzes/delete/${level}/${encodeURIComponent(item)}`;
    let queryParams = [];
    
    // Add parent category if available
    if (level === 'topic' && selectedSubject) {
      queryParams.push(`parentCategory=subject&parentValue=${encodeURIComponent(selectedSubject)}`);
    } else if (level === 'subtopic' && selectedTopic) {
      queryParams.push(`parentCategory=topic&parentValue=${encodeURIComponent(selectedTopic)}`);
    } else if (level === 'concept' && selectedSubtopic) {
      queryParams.push(`parentCategory=subtopic&parentValue=${encodeURIComponent(selectedSubtopic)}`);
    }
    
    // Add query parameters to the endpoint
    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }
    
    // Get the token from localStorage
    const token = localStorage.getItem('token');
    
    const response = await axios.delete(`http://localhost:8000${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Delete response:', response.data);
    
    if (response.data.success) {
      // Update state based on what was deleted
      if (level === 'subject') {
        // Remove the subject from the list
        setSubjects(prev => prev.filter(s => s !== item));
        // If the deleted subject was selected, clear the selection
        if (selectedSubject === item) {
          setSelectedSubject(null);
          setTopics([]);
          setSubtopics([]);
          setConcepts([]);
        }
      } else if (level === 'topic') {
        setTopics(prev => prev.filter(t => t !== item));
        if (selectedTopic === item) {
          setSelectedTopic(null);
          setSubtopics([]);
          setConcepts([]);
        }
      } else if (level === 'subtopic') {
        setSubtopics(prev => prev.filter(s => s !== item));
        if (selectedSubtopic === item) {
          setSelectedSubtopic(null);
          setConcepts([]);
        }
      } else if (level === 'concept') {
        setConcepts(prev => prev.filter(c => c !== item));
        if (selectedConcept === item) {
          setSelectedConcept(null);
          setConceptQuestions([]);
        }
      }
      
      // Show success message
      alert(`Successfully deleted ${level}: ${item}`);
    } else {
      alert('Failed to delete item. Please try again.');
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Error deleting item: ' + (error.response?.data?.error || error.message));
  }
};

  return (
    <ContentWrapper>
      <Container maxWidth="lg">
        {/* Progress Bar */}
        {loading && (
          <Fade in={loading}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}
            />
          </Fade>
        )}

        {/* Enhanced Breadcrumbs */}
        <Breadcrumbs 
          aria-label="breadcrumb" 
          sx={{ mb: 3, bgcolor: 'white', p: 2, borderRadius: 2, boxShadow: 1 }}
        >

        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/dashboard')} // Navigate to /dashboard
          sx={{ mr: 2 }}
        >
          Go to Dashboard
        </Button>
          <MuiLink
            component="button"
            onClick={() => handleNavigationBack()}
            color={!selectedSubject ? "text.primary" : "primary.main"}
            sx={{ fontWeight: !selectedSubject ? 'bold' : 'normal' }}
          >
            Subjects
          </MuiLink>
          {selectedSubject && (
            <MuiLink
              component="button"
              onClick={selectedTopic ? () => handleNavigationBack() : undefined}
              color={!selectedTopic ? "text.primary" : "primary.main"}
              sx={{ fontWeight: !selectedTopic ? 'bold' : 'normal' }}
            >
              {selectedSubject}
            </MuiLink>
          )}
          {selectedTopic && (
            <MuiLink
              component="button"
              onClick={selectedSubtopic ? () => handleNavigationBack() : undefined}
              color={!selectedSubtopic ? "text.primary" : "primary.main"}
              sx={{ fontWeight: !selectedSubtopic ? 'bold' : 'normal' }}
            >
              {selectedTopic}
            </MuiLink>
          )}
          {selectedSubtopic && (
            <Typography 
              color={selectedConcept ? "primary.main" : "text.primary"}
              sx={{ fontWeight: !selectedConcept ? 'bold' : 'normal' }}
            >
              {selectedSubtopic}
            </Typography>
          )}
          {selectedConcept && (
            <Typography color="text.primary" sx={{ fontWeight: 'bold' }}>
              {selectedConcept}
            </Typography>
          )}
        </Breadcrumbs>

        {/* Back to Dashboard button - only show at subjects level */}
        {/* {!selectedSubject && (
          <Box sx={{ mb: 3 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/dashboard')}
              variant="outlined"
              color="primary"
            >
              Back to Dashboard
            </Button>
          </Box>
        )} */}

        {/* Header Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          {(selectedSubject || selectedTopic || selectedSubtopic || selectedConcept) && (
            <Tooltip title="Go Back">
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleNavigationBack}
                variant="contained"
                color="primary"
                sx={{ mr: 2, borderRadius: 20 }}
              >
                Back
              </Button>
            </Tooltip>
          )}
          
          {/* Title with Edit Capability */}
          {editMode && editingName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <TextField
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                variant="outlined"
                size="small"
                sx={{ mr: 1, flexGrow: 1 }}
                autoFocus
              />
              <IconButton 
                color="primary" 
                onClick={saveRename}
                disabled={!newName || newName.trim() === ''}
              >
                <SaveIcon />
              </IconButton>
              <IconButton color="default" onClick={cancelEditing}>
                <CancelIcon />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <Typography
                variant="h3"
                sx={{
                  flexGrow: 1,
                  fontWeight: 700,
                  color: 'primary.main',
                  letterSpacing: '-0.5px',
                }}
              >
                {selectedConcept
                  ? `${selectedConcept} Questions`
                  : selectedSubtopic
                  ? `${selectedSubtopic} Concepts`
                  : selectedTopic
                  ? `${selectedTopic} Subtopics`
                  : selectedSubject
                  ? `${selectedSubject} Topics`
                  : 'Explore Subjects'}
              </Typography>
              
              {/* Remove this Edit button since we now have inline editing */}
              {/* {(selectedSubject || selectedTopic || selectedSubtopic || selectedConcept) && (
                <Tooltip title="Rename">
                  <IconButton 
                    color="primary"
                    onClick={() => startEditing(
                      selectedConcept || selectedSubtopic || selectedTopic || selectedSubject
                    )}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              )} */}
            </Box>
          )}
        </Box>

        {/* Questions Section */}
        {selectedConcept && (
          <Fade in={!!selectedConcept}>
            <Paper 
              elevation={4}
              sx={{ 
                p: 3, 
                mb: 4, 
                borderRadius: 2,
                bgcolor: 'white',
                borderLeft: '5px solid',
                borderColor: 'primary.main'
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" color="primary.main">
                    Practice Questions
                  </Typography>
                  <Chip 
                    label={`${conceptQuestions.length} Qs`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
                <IconButton onClick={() => setSelectedConcept(null)}>
                  <CloseIcon />
                </IconButton>
              </Box>

              {loadingQuestions ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : questionError ? (
                <Typography color="error" sx={{ my: 2 }}>{questionError}</Typography>
              ) : conceptQuestions.length === 0 ? (
                <Typography sx={{ my: 2, color: 'text.secondary' }}>
                  No questions available yet. Check back later!
                </Typography>
              ) : (
                conceptQuestions.map((question, index) => (
                  <StyledAccordion key={index}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography sx={{ fontWeight: 500 }}>
                        Q{index + 1}: {question.question}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box>
                        {question.options && (
                          <Box sx={{ mb: 2 }}>
                            {question.options.map((option, idx) => (
                              <Chip
                                key={idx}
                                label={`${String.fromCharCode(97 + idx)}. ${option}`}
                                variant={option === question.correctAnswer ? "filled" : "outlined"}
                                color={option === question.correctAnswer ? "success" : "default"}
                                sx={{ m: 0.5 }}
                              />
                            ))}
                          </Box>
                        )}
                        <Paper 
                          sx={{ 
                            p: 2, 
                            bgcolor: 'success.light', 
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <InfoIcon color="success" />
                          <Typography>{question.correctAnswer}</Typography>
                        </Paper>
                      </Box>
                    </AccordionDetails>
                  </StyledAccordion>
                ))
              )}
            </Paper>
          </Fade>
        )}

        {/* Main Content Grid */}
        <Grid2 container spacing={3}>
          {error && !selectedConcept && (
            <Grid2 item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'error.light', borderRadius: 2 }}>
                <Typography color="error">{error}</Typography>
              </Paper>
            </Grid2>
          )}

          {/* Update the Card content section in the subjects mapping */}
          {!selectedSubject && subjects.map((subject) => (
            <Grid2 item xs={12} sm={6} md={4} lg={3} key={subject}>
              <StyledCard>
                <CardActionArea onClick={() => handleSubjectClick(subject)}>
                  <CardMedia
                    component="img"
                    height="160"
                    image={subjectImages[subject] || defaultSubjectImage}
                    alt={subject}
                    sx={{ transition: 'transform 0.3s' }}
                  />
                  <CardContent>
                    {editMode && editingName === subject ? (
                      <Box 
                        sx={{ display: 'flex', alignItems: 'center' }}
                        onClick={(e) => e.stopPropagation()} // Prevent card click
                      >
                        <TextField
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          variant="outlined"
                          size="small"
                          sx={{ flexGrow: 1 }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <IconButton size="small" color="primary" onClick={saveRename}>
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEditing}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 600,
                            textAlign: 'center',
                            color: 'text.primary',
                            cursor: 'pointer',
                            '&:hover': {
                              textDecoration: 'underline',
                              color: 'primary.main'
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(subject);
                          }}
                        >
                          {subject}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
                <CardActions sx={{ justifyContent: 'space-between', p: 2, borderTop: '1px solid #eee' }}>
                  <Button 
                    size="small"
                    startIcon={<ListIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubjectClick(subject);
                    }}
                  >
                    Explore
                  </Button>
                  <Box>
                    <Button 
                      size="small"
                      color="secondary"
                      startIcon={<QuizIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssessmentConfig(subject, 'subject');
                      }}
                    >
                      Practice
                    </Button>
                    {/* <Button 
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(subject, 'subject');
                      }}
                      sx={{ ml: 1 }}
                    >
                      Delete
                    </Button> */}
                  </Box>
                </CardActions>
              </StyledCard>
            </Grid2>
          ))}

          {selectedSubject && !selectedTopic && topics.map((topic) => (
            <Grid2 item xs={12} sm={6} md={4} lg={3} key={topic}>
              <StyledCard>
                {/* <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                  <Tooltip title={`Mastery: ${topicProgress[topic] || 0}%`}>
                    <CircularProgress 
                      variant="determinate" 
                      value={topicProgress[topic] || 0} 
                      size={40}
                      thickness={5}
                      sx={{
                        background: 'rgba(255,255,255,0.8)',
                        borderRadius: '50%',
                        padding: '2px',
                        boxShadow: 1,
                        color: topicProgress[topic] > 80 ? 'success.main' : 
                              topicProgress[topic] > 50 ? 'warning.main' : 'error.main',
                      }}
                    />
                  </Tooltip>
                </Box> */}
                <CardActionArea onClick={() => handleTopicClick(topic)}>
                  <CardMedia
                    component="img"
                    height="160"
                    image={topicImages[topic] || defaultTopicImage}
                    alt={topic}
                    sx={{ transition: 'transform 0.3s' }}
                  />
                  <CardContent>
                    {editMode && editingName === topic ? (
                      <Box 
                        sx={{ display: 'flex', alignItems: 'center' }}
                        onClick={(e) => e.stopPropagation()} // Prevent card click
                      >
                        <TextField
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          variant="outlined"
                          size="small"
                          sx={{ flexGrow: 1 }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <IconButton size="small" color="primary" onClick={saveRename}>
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEditing}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 600, 
                          textAlign: 'center',
                          cursor: 'pointer',
                          '&:hover': {
                            textDecoration: 'underline',
                            color: 'primary.main'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(topic);
                        }}
                      >
                        {topic}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
                <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                  <Button 
                    size="small" 
                    startIcon={<ListIcon />} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTopicClick(topic);
                    }}
                  >
                    Explore
                  </Button>
                  <Box>
                    <Button 
                      size="small" 
                      color="secondary"
                      startIcon={<QuizIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssessmentConfig(topic, 'topic');
                      }}
                    >
                      Practice
                    </Button>
                    <Button 
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(topic, 'topic');
                      }}
                      sx={{ ml: 1 }}
                    >
                      Delete
                    </Button>
                  </Box>
                </CardActions>
              </StyledCard>
            </Grid2>
          ))}

          {selectedTopic && !selectedSubtopic && subtopics.map((subtopic) => (
            <Grid2 item xs={12} sm={6} md={4} lg={3} key={subtopic}>
              <StyledCard>
                <CardActionArea onClick={() => handleSubtopicClick(subtopic)}>
                  <CardMedia
                    component="img"
                    height="160"
                    image={subtopicImages[subtopic] || defaultSubtopicImage}
                    alt={subtopic}
                    sx={{ transition: 'transform 0.3s' }}
                  />
                  <CardContent>
                    {editMode && editingName === subtopic ? (
                      <Box 
                        sx={{ display: 'flex', alignItems: 'center' }}
                        onClick={(e) => e.stopPropagation()} // Prevent card click
                      >
                        <TextField
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          variant="outlined"
                          size="small"
                          sx={{ flexGrow: 1 }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <IconButton size="small" color="primary" onClick={saveRename}>
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEditing}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 600, 
                          textAlign: 'center',
                          cursor: 'pointer',
                          '&:hover': {
                            textDecoration: 'underline',
                            color: 'primary.main'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(subtopic);
                        }}
                      >
                        {subtopic}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
                <CardActions sx={{ justifyContent: 'space-between', p: 2, borderTop: '1px solid #eee' }}>
                  <Button 
                    size="small" 
                    startIcon={<ListIcon />} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubtopicClick(subtopic);
                    }}
                  >
                    Explore
                  </Button>
                  <Box>
                    <Button 
                      size="small" 
                      color="secondary"
                      startIcon={<QuizIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssessmentConfig(subtopic, 'subtopic');
                      }}
                    >
                      Practice
                    </Button>
                    <Button 
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(subtopic, 'subtopic');
                      }}
                      sx={{ ml: 1 }}
                    >
                      Delete
                    </Button>
                  </Box>
                </CardActions>
              </StyledCard>
            </Grid2>
          ))}

          {selectedSubtopic && !selectedConcept && concepts.map((concept) => (
            <Grid2 item xs={12} sm={6} md={4} lg={3} key={concept}>
              <StyledCard>
                <CardActionArea onClick={() => handleConceptClick(concept)}>
                  <CardMedia
                    component="img"
                    height="160"
                    image={conceptImages[concept] || defaultConceptImage}
                    alt={concept}
                    sx={{ transition: 'transform 0.3s' }}
                  />
                  <CardContent>
                    {editMode && editingName === concept ? (
                      <Box 
                        sx={{ display: 'flex', alignItems: 'center' }}
                        onClick={(e) => e.stopPropagation()} // Prevent card click
                      >
                        <TextField
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          variant="outlined"
                          size="small"
                          sx={{ flexGrow: 1 }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <IconButton size="small" color="primary" onClick={saveRename}>
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEditing}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 600, 
                          textAlign: 'center',
                          cursor: 'pointer',
                          '&:hover': {
                            textDecoration: 'underline',
                            color: 'primary.main'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(concept);
                        }}
                      >
                        {concept}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
                <CardActions sx={{ justifyContent: 'space-between', p: 2, borderTop: '1px solid #eee' }}>
                  <Button 
                    size="small" 
                    color="secondary"
                    startIcon={<QuizIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      openAssessmentConfig(concept, 'concept');
                    }}
                  >
                    Practice
                  </Button>
                  <Button 
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(concept, 'concept');
                    }}
                  >
                    Delete
                  </Button>
                </CardActions>
              </StyledCard>
            </Grid2>
          ))}
        </Grid2>

        {/* Empty State Messages */}
        {selectedSubject && topics.length === 0 && !loading && !error && (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No topics available for {selectedSubject}
            </Typography>
          </Box>
        )}
        {selectedTopic && subtopics.length === 0 && !loading && !error && (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No subtopics available for {selectedTopic}
            </Typography>
          </Box>
        )}
        {selectedSubtopic && concepts.length === 0 && !loading && !error && (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No concepts available for {selectedSubtopic}
            </Typography>
          </Box>
        )}
        
        {/* Recommended Items Section */}
        {selectedSubject && !loading && recommendedItems.length > 0 && (
          <Box sx={{ mt: 6 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>Recommended for You</Typography>
            <Grid2 container spacing={3}>
              {recommendedItems.map((item) => (
                <Grid2 item xs={12} sm={6} md={4} lg={3} key={item.id}>
                  <StyledCard>
                    <CardActionArea onClick={() => handleRecommendationClick(item)}>
                      <CardMedia
                        component="img"
                        height="160"
                        image={item.image || defaultImage}
                        alt={item.name}
                        sx={{ transition: 'transform 0.3s' }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          bgcolor: 'rgba(0,0,0,0.6)',
                          color: 'white',
                          p: 1,
                          fontSize: '0.8rem',
                        }}
                      >
                        <Chip
                          label={item.reason}
                          size="small"
                          color={
                            item.reason === 'Weak Area' ? 'error' :
                            item.reason === 'Next Step' ? 'primary' :
                            'default'
                          }
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                    <CardActions sx={{ justifyContent: 'space-between' }}>
                      <Button size="small" onClick={() => navigateToItem(item)}>
                        Explore
                      </Button>
                      <Button 
                        size="small" 
                        color="secondary"
                        startIcon={<QuizIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssessmentConfig(item.name, item.type);
                        }}
                      >
                        Practice
                      </Button>
                    </CardActions>
                  </StyledCard>
                </Grid2>
              ))}
            </Grid2>
          </Box>
        )}
      </Container>

      {/* Assessment Configuration Modal */}
      <AssessmentConfigModal 
        open={assessmentConfigOpen} 
        handleClose={closeAssessmentConfig} 
        item={assessmentConfigItem} 
        level={assessmentConfigLevel} 
        navigate={navigate}
      />
    </ContentWrapper>
  );
};

// Assessment Configuration Modal
const AssessmentConfigModal = ({ open, handleClose, item, level, navigate }) => {
  const [config, setConfig] = useState({
    numQuestions: 5,
    difficulty: 'Medium',
    timeLimit: 0, // 0 = no limit
    questionTypes: ['open-ended'],
    includeSubtopics: true,
    selectedItems: [] // Store selected topics/subtopics/concepts
  });
  
  // State to hold all available items at the current level
  const [availableItems, setAvailableItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
  // Fetch available items based on level when modal opens
  useEffect(() => {
    if (open && level && !config.includeSubtopics) {
      fetchAvailableItems();
    }
  }, [open, level, item, config.includeSubtopics]);
  
  const fetchAvailableItems = async () => {
    if (!level || !item) return;
    
    setLoadingItems(true);
    try {
      let endpoint;
      if (level === 'subject') {
        endpoint = `/api/quizzes/topics/${encodeURIComponent(item)}`;
      } else if (level === 'topic') {
        endpoint = `/api/quizzes/subtopics/${encodeURIComponent(item)}`;
      } else if (level === 'subtopic') {
        endpoint = `/api/quizzes/concepts/${encodeURIComponent(item)}`;
      }
      
      if (endpoint) {
        const response = await axios.get(`http://localhost:8000${endpoint}`);
        
        // Extract the appropriate data based on level
        let items = [];
        if (level === 'subject' && response.data.topics) {
          items = response.data.topics;
        } else if (level === 'topic' && response.data.subtopics) {
          items = response.data.subtopics;
        } else if (level === 'subtopic' && response.data.concepts) {
          items = response.data.concepts;
        }
        
        setAvailableItems(items);
        
        // If we have items and nothing is selected yet, select all by default
        if (items.length > 0 && config.selectedItems.length === 0) {
          setConfig(prev => ({...prev, selectedItems: [...items]}));
        }
      }
    } catch (error) {
      console.error(`Error fetching ${level} items:`, error);
      setAvailableItems([]);
    } finally {
      setLoadingItems(false);
    }
  };
  
  const handleItemToggle = (itemName) => {
    setConfig(prev => {
      const currentSelected = [...prev.selectedItems];
      const itemIndex = currentSelected.indexOf(itemName);
      
      if (itemIndex === -1) {
        // Item not selected, add it
        currentSelected.push(itemName);
      } else {
        // Item already selected, remove it
        currentSelected.splice(itemIndex, 1);
      }
      
      return {...prev, selectedItems: currentSelected};
    });
  };
  
  const handleStartAssessment = () => {
    handleClose();
    // Navigate to assessment with these parameters
    navigate('/assessment', { 
      state: { 
        level,
        item, 
        config
      }
    });
  };
  
  const handleIncludeAllToggle = (e) => {
    const includeAll = e.target.checked;
    setConfig({...config, includeSubtopics: includeAll});
    
    if (!includeAll) {
      // When toggling off "include all", fetch the items if we don't have them yet
      if (availableItems.length === 0) {
        fetchAvailableItems();
      }
    }
  };

  // Get the appropriate label for the current level
  const getItemTypeLabel = () => {
    if (level === 'subject') return 'topics';
    if (level === 'topic') return 'subtopics';
    if (level === 'subtopic') return 'concepts';
    return 'items';
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <AssessmentIcon sx={{ mr: 1 }} />
          Configure Assessment
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
          {level ? `${level.charAt(0).toUpperCase() + level.slice(1)}: ` : ''}<strong>{item || ''}</strong>
        </Typography>
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Number of Questions</InputLabel>
          <Select
            value={config.numQuestions}
            onChange={(e) => setConfig({...config, numQuestions: e.target.value})}
          >
            <MenuItem value={5}>5 questions</MenuItem>
            <MenuItem value={10}>10 questions</MenuItem>
            <MenuItem value={15}>15 questions</MenuItem>
            <MenuItem value={20}>20 questions</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Difficulty</InputLabel>
          <Select
            value={config.difficulty}
            onChange={(e) => setConfig({...config, difficulty: e.target.value})}
          >
            <MenuItem value="easy">Easy</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="hard">Hard</MenuItem>
            <MenuItem value="mixed">Mixed</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Time Limit</InputLabel>
          <Select
            value={config.timeLimit}
            onChange={(e) => setConfig({...config, timeLimit: e.target.value})}
          >
            <MenuItem value={0}>No time limit</MenuItem>
            <MenuItem value={5}>5 minutes</MenuItem>
            <MenuItem value={10}>10 minutes</MenuItem>
            <MenuItem value={15}>15 minutes</MenuItem>
            <MenuItem value={30}>30 minutes</MenuItem>
          </Select>
        </FormControl>

         {/* <FormControl component="fieldset" fullWidth margin="normal">
          <FormLabel component="legend">Question Types</FormLabel>
          <FormGroup>
            <FormControlLabel
              control={<Checkbox checked={config.questionTypes.includes('multiple-choice')} 
                onChange={(e) => {
                  const newTypes = e.target.checked
                    ? [...config.questionTypes, 'multiple-choice']
                    : config.questionTypes.filter(t => t !== 'multiple-choice');
                  setConfig({...config, questionTypes: newTypes});
                }}
              />}
              label="Multiple Choice"
            />
            <FormControlLabel
              control={<Checkbox checked={config.questionTypes.includes('open-ended')} 
                onChange={(e) => {
                  const newTypes = e.target.checked
                    ? [...config.questionTypes, 'open-ended']
                    : config.questionTypes.filter(t => t !== 'open-ended');
                  setConfig({...config, questionTypes: newTypes});
                }}
              />}
              label="Open Ended"
            />
            <FormControlLabel
              control={<Checkbox checked={config.questionTypes.includes('true-false')} 
                onChange={(e) => {
                  const newTypes = e.target.checked
                    ? [...config.questionTypes, 'true-false']
                    : config.questionTypes.filter(t => t !== 'true-false');
                  setConfig({...config, questionTypes: newTypes});
                }}
              />}
              label="True/False"
            />
          </FormGroup>
        </FormControl>  */}

        {/* Include all toggle and item selection */}
        {level && (level === 'subject' || level === 'topic' || level === 'subtopic') && (
          <>
            <FormControlLabel
              control={<Switch checked={config.includeSubtopics} 
                onChange={handleIncludeAllToggle}
              />}
              label={
                level === 'subject' 
                  ? 'Include all topics' 
                  : level === 'topic' 
                    ? 'Include all subtopics' 
                    : 'Include all concepts'
              }
            />
            
            {/* Show selectable items when "Include all" is turned off */}
            {!config.includeSubtopics && (
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Select specific {getItemTypeLabel()} to include:
                </Typography>
                
                {loadingItems ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : availableItems.length === 0 ? (
                  <Typography variant="body2" color="error">
                    No {getItemTypeLabel()} available
                  </Typography>
                ) : (
                  <Box sx={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto',
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    p: 1
                  }}>
                    {availableItems.map(itemName => (
                      <FormControlLabel
                        key={itemName}
                        control={
                          <Checkbox
                            checked={config.selectedItems.includes(itemName)}
                            onChange={() => handleItemToggle(itemName)}
                            size="small"
                          />
                        }
                        label={<Typography variant="body2">{itemName}</Typography>}
                        sx={{ display: 'block', my: 0.5 }}
                      />
                    ))}
                  </Box>
                )}
                
                {/* Add select all/none buttons for convenience */}
                {availableItems.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button 
                      size="small"
                      onClick={() => setConfig({...config, selectedItems: []})}
                      sx={{ mr: 1 }}
                    >
                      Clear All
                    </Button>
                    <Button 
                      size="small"
                      onClick={() => setConfig({...config, selectedItems: [...availableItems]})}
                    >
                      Select All
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleStartAssessment}
          disabled={!config.includeSubtopics && config.selectedItems.length === 0}
          startIcon={<PlayArrowIcon />}
        >
          Start Assessment
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// New component for hierarchical visualization

const KnowledgeMap = ({ subject, topic, subtopic, handleSubjectClick, handleTopicClick, handleSubtopicClick, handleConceptClick }) => {
  return (
    <Box sx={{ 
      height: 500, 
      border: '1px solid #e0e0e0', 
      borderRadius: 2, 
      p: 2,
      mb: 4,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <Typography variant="h6" gutterBottom>Knowledge Map</Typography>
      <Typography color="textSecondary">
        Visualization is coming soon! This will show the relationships between subjects, topics, subtopics, and concepts.
      </Typography>
      <Button 
        variant="outlined" 
        color="primary" 
        sx={{ mt: 2 }}
        onClick={() => alert('Force graph visualization will be implemented soon.')}
      >
        Preview Concept Map
      </Button>
    </Box>
  );
};

export default Practice;