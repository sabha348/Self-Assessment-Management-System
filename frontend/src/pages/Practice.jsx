import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Container, 
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
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Switch,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Avatar,
  useTheme,
  alpha
} from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import QuizIcon from '@mui/icons-material/Quiz';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ListIcon from '@mui/icons-material/List';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FunctionsIcon from '@mui/icons-material/Functions';
import ScienceIcon from '@mui/icons-material/Science';
import BiotechIcon from '@mui/icons-material/Biotech';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import PublicIcon from '@mui/icons-material/Public';
import ComputerIcon from '@mui/icons-material/Computer';
import SchoolIcon from '@mui/icons-material/School';
import CalculateIcon from '@mui/icons-material/Calculate';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import Joyride from 'react-joyride';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Styled components with improved animations and layout
const ContentWrapper = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(145deg, #f5f7fa 0%, #e4e9f2 100%)',
  minHeight: '100vh',
  padding: theme.spacing(3, 2),
}));

const CompactListItem = styled(ListItem)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  marginBottom: theme.spacing(0.75),
  padding: theme.spacing(1, 2),
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  backgroundColor: theme.palette.background.paper,
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.light, 0.07),
    transform: 'translateX(4px)',
    boxShadow: '0 3px 5px rgba(0,0,0,0.08)',
    '& .MuiListItemSecondaryAction-root': {
      opacity: 1,
      transform: 'translateX(0)',
    },
    '&::before': {
      opacity: 1,
      transform: 'translateX(0)',
    }
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '4px',
    backgroundColor: theme.palette.primary.main,
    opacity: 0.5,
    transform: 'translateX(-2px)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
  }
}));

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  overflow: 'hidden',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  '&:hover': {
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  },
  '&:before': {
    display: 'none',
  },
  '&.Mui-expanded': {
    margin: '8px 0',
    transform: 'scale(1.005)',
  }
}));

const CategoryIconWrapper = styled(Avatar)(({ theme, categorytype }) => ({
  backgroundColor: 
    categorytype === 'subject' ? theme.palette.primary.main :
    categorytype === 'topic' ? theme.palette.secondary.main :
    categorytype === 'subtopic' ? theme.palette.success.main :
    theme.palette.info.main,
  width: 32,
  height: 32,
  transform: 'scale(0.95)',
  transition: 'transform 0.2s ease',
  '${CompactListItem}:hover &': {
    transform: 'scale(1)'
  }
}));

const ActionButtonsWrapper = styled(Box)(({ theme }) => ({
  opacity: 0.6,
  transition: 'all 0.3s ease',
  transform: 'translateX(10px)',
  '&:hover': {
    opacity: 1,
  }
}));

const AnimatedSection = styled(Paper)(({ theme }) => ({
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[3],
    transform: 'translateY(-1px)'
  }
}));

// Subject to icon mapping
const subjectIcons = {
  "Mathematics": <FunctionsIcon fontSize="small" />,
  "Physics": <ScienceIcon fontSize="small" />,
  "Biology": <BiotechIcon fontSize="small" />,
  "Chemistry": <ScienceIcon fontSize="small" />,
  "Literature": <AutoStoriesIcon fontSize="small" />,
  "History": <HistoryEduIcon fontSize="small" />,
  "Geography": <PublicIcon fontSize="small" />,
  "Computer Science": <ComputerIcon fontSize="small" />,
  "Knowledge": <SchoolIcon fontSize="small" />,
};

// Topic to icon mapping
const topicIcons = {
  "Calculus": <CalculateIcon fontSize="small" />,
  "Algebra": <FunctionsOutlinedIcon fontSize="small" />,
  "Geometry": <ArchitectureIcon fontSize="small" />,
};

// Default icons by level
const getDefaultIcon = (level) => {
  switch (level) {
    case 'subject': return <SchoolIcon fontSize="small" />;
    case 'topic': return <ListIcon fontSize="small" />;
    case 'subtopic': return <InfoIcon fontSize="small" />;
    case 'concept': return <QuizIcon fontSize="small" />;
    default: return <InfoIcon fontSize="small" />;
  }
};

// Get appropriate icon for item
const getCategoryIcon = (item, level) => {
  if (level === 'subject') {
    return subjectIcons[item] || getDefaultIcon(level);
  } else if (level === 'topic') {
    return topicIcons[item] || getDefaultIcon(level);
  } else {
    return getDefaultIcon(level);
  }
};

const CategoryListItem = ({ 
  item, 
  itemType, 
  onItemClick, 
  onExplore,
  onPractice,
  onDelete,
  editMode,
  editingName,
  newName,
  setNewName,
  startEditing,
  saveRename,
  cancelEditing,
  showExplore = true,
  className = ''
}) => {
  const theme = useTheme();
  return (
    <CompactListItem
      button
      onClick={() => onItemClick(item)}
      className={className}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        <CategoryIconWrapper categorytype={itemType}>
          {getCategoryIcon(item, itemType)}
        </CategoryIconWrapper>
      </ListItemIcon>
      
      <ListItemText 
        primary={
          <Typography variant="body1" component="div" sx={{ 
            fontWeight: 500,
            transition: 'color 0.2s ease',
            '&:hover': { color: theme.palette.primary.main }
          }}>
            {editMode && editingName === item ? (
              <Box 
                sx={{ display: 'flex', alignItems: 'center', width: '80%' }}
                onClick={(e) => e.stopPropagation()}
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
              </Box>
            ) : item}
          </Typography>
        }
        sx={{ margin: 0 }}
      />
      
      {/* Show either action buttons OR edit controls */}
      <ListItemSecondaryAction>
        {editMode && editingName === item ? (
          <Box sx={{ display: 'flex' }}>
            <IconButton size="small" color="primary" onClick={saveRename} disabled={!newName || newName.trim() === ''}>
              <SaveIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={cancelEditing}>
              <CancelIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <ActionButtonsWrapper>
            
            <Tooltip title="Practice">
              <IconButton 
                edge="end" 
                onClick={(e) => {
                  e.stopPropagation();
                  onPractice(item, itemType);
                }}
                color="secondary"
                size="small"
                className="practice-button"
                sx={{ ml: 0.5 }}
              >
                <QuizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Edit">
              <IconButton 
                edge="end" 
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(item);
                }}
                size="small"
                sx={{ ml: 0.5 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Delete">
              <IconButton 
                edge="end" 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item, itemType);
                }}
                color="error"
                size="small"
                sx={{ ml: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ActionButtonsWrapper>
        )}
      </ListItemSecondaryAction>
    </CompactListItem>
  );
};

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
  const [assessmentConfigOpen, setAssessmentConfigOpen] = useState(false);
  const [assessmentConfigItem, setAssessmentConfigItem] = useState(null);
  const [assessmentConfigLevel, setAssessmentConfigLevel] = useState(null);
  const [runTour, setRunTour] = useState(false);
  const [steps] = useState([
    {
      target: '.subject-card',
      content: 'Click on a subject to navigate through topics, subtopics, and concepts. This helps you dive deeper into specific areas and find related questions for revision.',
      title: 'Explore Knowledge Hierarchy',
      disableBeacon: true,
      placement: 'bottom'
    },
    {
      target: '.practice-button',
      content: 'Take assessments at any level - subject, topic, subtopic, or concept. Configure the number of questions, difficulty level, time limit, and more to customize your practice experience.',
      title: 'Practice with Assessments',
      placement: 'top'
    }
  ]);

  const [editMode, setEditMode] = useState(false);
  const [editingName, setEditingName] = useState(null);
  const [newName, setNewName] = useState('');
  
  const [editQuestionModal, setEditQuestionModal] = useState(false);
  const [currentEditQuestion, setCurrentEditQuestion] = useState(null);
  const [editQuestionForm, setEditQuestionForm] = useState({
    questionText: '',
    correctAnswer: '',
    options: []
  });
  
  const navigate = useNavigate();

  // Check if user has seen this tour before
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenPracticeTour');
    if (!hasSeenTour) {
      // Short delay to ensure components are rendered
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Joyride callback handler
  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if (status === 'finished' || status === 'skipped') {
      setRunTour(false);
      // Save that user has seen the tour
      localStorage.setItem('hasSeenPracticeTour', 'true');
    }
  };
  
  // Memoized fetch function
  const fetchItems = useCallback(async (type, parent = null) => {
    try {
      // Set the appropriate loading state
    if (type === 'questions') {
      setLoadingQuestions(true);
    } else {
      setLoading(true);
    }
      setError(null);
    setQuestionError(null);
      
      const token = localStorage.getItem('token');
      let endpoint;
      
      switch (type) {
        case 'subjects':
          endpoint = '/assessment/subjects';
          break;
        case 'topics':
          endpoint = `/assessment/topics/${encodeURIComponent(parent)}`;
          break;
        case 'subtopics':
          endpoint = `/assessment/subtopics/${encodeURIComponent(parent)}`;
          break;
        case 'concepts':
          endpoint = `/assessment/concepts/${encodeURIComponent(parent)}`;
          break;
        case 'questions':
          endpoint = `/assessment/questions/concept/${encodeURIComponent(parent)}`;
          setLoadingQuestions(true);
          break;
        default:
          throw new Error(`Invalid item type: ${type}`);
      }
      
      console.log(`Fetching ${type}${parent ? ` for ${parent}` : ''}`);

      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      // Update the appropriate state based on type
      if (type === 'subjects') {
        setSubjects(response.data.subjects || []);
      } else if (type === 'topics') {
        setTopics(response.data.topics || []);
      } else if (type === 'subtopics') {
        setSubtopics(response.data.subtopics || []);
      } else if (type === 'concepts') {
        setConcepts(response.data.concepts || []);
      } else if (type === 'questions') {
        setConceptQuestions(response.data.questions || []);
        setLoadingQuestions(false);
      }
      
    } catch (err) {
      console.error(`Failed to load ${type}${parent ? ` for ${parent}` : ''}:`, err);
      const errorMsg = `Failed to load ${type}${parent ? ` for ${parent}` : ''}`;
      
      if (type === 'questions') {
        setQuestionError(errorMsg);
        setConceptQuestions([]);
        setLoadingQuestions(false);
      } else {
        setError(errorMsg);
        // Reset the appropriate state
        if (type === 'subjects') setSubjects([]);
        else if (type === 'topics') setTopics([]);
        else if (type === 'subtopics') setSubtopics([]);
        else if (type === 'concepts') setConcepts([]);
      }
    } finally {
       if (type === 'questions') {
      setLoadingQuestions(false);
    } else {
      setLoading(false);
    }
    }
  }, []);


  useEffect(() => {
    fetchItems('subjects');
  }, [fetchItems]);

  
  // Handler functions
  const handleItemClick = (item, level) => {
    switch (level) {
      case 'subject':
        setSelectedSubject(item);
        setSelectedTopic(null);
        setSelectedSubtopic(null);
        setSelectedConcept(null);
        setTopics([]);
        setSubtopics([]);
        setConcepts([]);
        fetchItems('topics', item);
        break;
      case 'topic':
        setSelectedTopic(item);
        setSelectedSubtopic(null);
        setSelectedConcept(null);
        setSubtopics([]);
        setConcepts([]);
        fetchItems('subtopics', item);
        break;
      case 'subtopic':
        setSelectedSubtopic(item);
        setSelectedConcept(null);
        setConcepts([]);
        fetchItems('concepts', item);
        break;
      case 'concept':
        setSelectedConcept(item);
        setConceptQuestions([]);
        setQuestionError(null);
        fetchItems('questions', item);
        break;
      default:
        console.error('Unknown level:', level);
    }
    setError(null);
  };

  const handleNavigationBack = () => {
    setLoading(false);
  setLoadingQuestions(false);
  setError(null);
  setQuestionError(null);
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
      endpoint = '/assessment/rename/concept';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        subtopic: selectedSubtopic
      };
    } else if (selectedSubtopic && editingName === selectedSubtopic) {
      // Renaming the selected subtopic
      endpoint = '/assessment/rename/subtopic';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        topic: selectedTopic
      };
    } else if (selectedTopic && editingName === selectedTopic) {
      // Renaming the selected topic
      endpoint = '/assessment/rename/topic';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        subject: selectedSubject
      };
    } else if (selectedSubject && editingName === selectedSubject) {
      // Renaming the selected subject
      endpoint = '/assessment/rename/subject';
      params = {
        oldName: editingName,
        newName: newName.trim()
      };
    } else if (selectedSubtopic && concepts.includes(editingName)) {
      // Renaming a concept in the list
      endpoint = '/assessment/rename/concept';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        subtopic: selectedSubtopic
      };
    } else if (selectedTopic && subtopics.includes(editingName)) {
      // Renaming a subtopic in the list
      endpoint = '/assessment/rename/subtopic';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        topic: selectedTopic
      };
    } else if (selectedSubject && topics.includes(editingName)) {
      // Renaming a topic in the list
      endpoint = '/assessment/rename/topic';
      params = {
        oldName: editingName,
        newName: newName.trim(),
        subject: selectedSubject
      };
    } else if (subjects.includes(editingName)) {
      // Renaming a subject in the list
      endpoint = '/assessment/rename/subject';
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
    const response = await axios.put(`${API_URL}${endpoint}`, params, {
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

const handleDelete = async (item, level) => {
  // Confirm deletion
  if (!window.confirm(`Are you sure you want to delete ${level}: ${item}? This will remove all associated questions and cannot be undone.`)) {
    return;
  }
  
  try {
    let endpoint = `/assessment/delete/${level}/${encodeURIComponent(item)}`;
    let queryParams = [];
    
    if (level === 'topic' && selectedSubject) {
      queryParams.push(`parentCategory=subject&parentValue=${encodeURIComponent(selectedSubject)}`);
    } else if (level === 'subtopic' && selectedTopic) {
      queryParams.push(`parentCategory=topic&parentValue=${encodeURIComponent(selectedTopic)}`);
    } else if (level === 'concept' && selectedSubtopic) {
      queryParams.push(`parentCategory=subtopic&parentValue=${encodeURIComponent(selectedSubtopic)}`);
    }
    
    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }
    
    // Get the token from localStorage
    const token = localStorage.getItem('token');

    const response = await axios.delete(`${API_URL}${endpoint}`, {
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
      
      alert(`Successfully deleted ${level}: ${item}`);
    } else {
      alert('Failed to delete item. Please try again.');
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Error deleting item: ' + (error.response?.data?.error || error.message));
  }
};

const handleDeleteQuestion = async (questionId) => {
  // Confirm deletion
  if (!window.confirm("Are you sure you want to delete this question? This action cannot be undone.")) {
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    
    const response = await axios.delete(
      `${API_URL}/assessment/questions/${questionId}`, 
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.data.success) {
      // Remove the question from the state
      setConceptQuestions(prev => 
        prev.filter(q => q.questionId !== questionId)
      );
      alert('Question deleted successfully!');
    }
  } catch (error) {
    console.error('Error deleting question:', error);
    alert('Failed to delete question: ' + (error.response?.data?.error || error.message));
  }
};

const openEditQuestionModal = (question) => {
  // Set the current question for editing
  setCurrentEditQuestion(question);
  
  // Populate the form with current values
  setEditQuestionForm({
    questionText: question.question,
    correctAnswer: question.correctAnswer,
    options: question.options ? [...question.options] : []
  });
  
  // Open the modal
  setEditQuestionModal(true);
};

const closeEditQuestionModal = () => {
  setEditQuestionModal(false);
  setCurrentEditQuestion(null);
  setEditQuestionForm({
    questionText: '',
    correctAnswer: '',
    options: []
  });
};

const handleUpdateQuestion = async () => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await axios.put(
      `${API_URL}/assessment/questions/${currentEditQuestion.questionId}`,
      {
        question: editQuestionForm.questionText,
        correctAnswer: editQuestionForm.correctAnswer,
        options: editQuestionForm.options
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.data.success) {
      // Update the question in the state
      setConceptQuestions(prev => 
        prev.map(q => 
          q.questionId === currentEditQuestion.questionId 
            ? response.data.question 
            : q
        )
      );
      
      // Close the modal and reset form
      closeEditQuestionModal();
      
      alert('Question updated successfully!');
    }
  } catch (error) {
    console.error('Error updating question:', error);
    alert('Failed to update question: ' + (error.response?.data?.error || error.message));
  }
};

const handleOptionChange = (index, value) => {
  setEditQuestionForm(prev => {
    const newOptions = [...prev.options];
    newOptions[index] = value;
    return { ...prev, options: newOptions };
  });
};

const addOption = () => {
  setEditQuestionForm(prev => ({
    ...prev,
    options: [...prev.options, '']
  }));
};

const removeOption = (index) => {
  setEditQuestionForm(prev => {
    const newOptions = [...prev.options];
    newOptions.splice(index, 1);
    return { ...prev, options: newOptions };
  });
};

  return (
    <ContentWrapper>
       {/* Joyride component */}
      <Joyride
        steps={steps}
        run={runTour}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#3b82f6',
            zIndex: 10000,
          }
        }}
      />
      <Container maxWidth="lg">

        {/* Compact Breadcrumb navigation */}
        <AnimatedSection
          elevation={1}
          sx={{ 
            mb: 2, 
            bgcolor: 'white', 
            p: 1.5, 
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 1.5, mb: { xs: 1, sm: 0 }, px: 2 }}
            startIcon={<ArrowBackIcon />}
            size="small"
          >
            Dashboard
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<UploadFileIcon />}
            onClick={() => navigate('/files')} 
            sx={{ mr: 1.5, mb: { xs: 1, sm: 0 } }}
            size="small"
          >
            Upload
          </Button>
          
          <Breadcrumbs aria-label="breadcrumb" sx={{ 
            flexGrow: 1, 
            '& .MuiBreadcrumbs-ol': { 
              flexWrap: 'wrap' 
            } 
          }}>
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
        </AnimatedSection>

        {/* Compact Header Section */}
        <AnimatedSection
          elevation={1}
          sx={{
            p: 1.5,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 1.5,
            backgroundColor: 'white'
          }}
        >
          {(selectedSubject || selectedTopic || selectedSubtopic || selectedConcept) && (
            <Tooltip title="Go Back">
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleNavigationBack}
                variant="outlined"
                size="small"
                sx={{ mr: 1.5, borderRadius: 20, minWidth: 0, px: 1 }}
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
                size="small"
              >
                <SaveIcon />
              </IconButton>
              <IconButton color="default" onClick={cancelEditing} size="small">
                <CancelIcon />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
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
              
              {loading && (
                <CircularProgress size={20} sx={{ ml: 2 }} />
              )}
            </Box>
          )}
        </AnimatedSection>

        {/* Questions Section - Improved */}
        {selectedConcept && (
          <Fade in={!!selectedConcept}>
            <AnimatedSection 
              elevation={2}
              sx={{ 
                p: 2, 
                mb: 3, 
                borderRadius: 1.5,
                bgcolor: 'white',
                borderLeft: '4px solid',
                borderColor: 'primary.main'
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <QuizIcon color="primary" />
                  <Typography variant="h6" color="primary.main" fontWeight="500">
                    Practice Questions
                  </Typography>
                  <Chip 
                    label={`${conceptQuestions.length} Questions`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
                <IconButton onClick={() => setSelectedConcept(null)} size="small">
                  <CloseIcon />
                </IconButton>
              </Box>

              {loadingQuestions ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : questionError ? (
                <Typography color="error" sx={{ my: 1.5 }}>{questionError}</Typography>
              ) : conceptQuestions.length === 0 ? (
                <Typography sx={{ my: 1.5, color: 'text.secondary' }}>
                  No questions available yet. Check back later!
                </Typography>
              ) : (
                <Box sx={{ mt: 1 }}>
                  {conceptQuestions.map((question, index) => (
                    <StyledAccordion key={index} sx={{ mb: 1 }}>
                      <AccordionSummary 
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          minHeight: '48px',
                          '& .MuiAccordionSummary-content': {
                            margin: '8px 0'
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', pr: 1 }}>
                          <Typography sx={{ fontWeight: 500, flex: 1, fontSize: '0.95rem' }}>
                            Q{index + 1}: {question.question}
                          </Typography>
                          <Box sx={{ display: 'flex', ml: 1 }} onClick={(e) => e.stopPropagation()}>
                            <IconButton 
                              size="small" 
                              color="primary" 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditQuestionModal(question);
                              }}
                              sx={{ mr: 0.5 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteQuestion(question.questionId);
                              }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                        <Box>
                          {question.options && (
                            <Box sx={{ mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {question.options.map((option, idx) => (
                                <Chip
                                  key={idx}
                                  label={`${String.fromCharCode(97 + idx)}. ${option}`}
                                  variant={option === question.correctAnswer ? "filled" : "outlined"}
                                  color={option === question.correctAnswer ? "success" : "default"}
                                  size="small"
                                />
                              ))}
                            </Box>
                          )}
                          <Paper 
                            sx={{ 
                              p: 1.5, 
                              bgcolor: 'success.light', 
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}
                            elevation={0}
                          >
                            <InfoIcon color="success" fontSize="small" />
                            <Typography variant="body2">{question.correctAnswer}</Typography>
                          </Paper>
                        </Box>
                      </AccordionDetails>
                    </StyledAccordion>
                  ))}
                </Box>
              )}
            </AnimatedSection>
          </Fade>
        )}

        {/* Error Message - More compact */}
        {error && !selectedConcept && (
          <Paper sx={{ p: 1.5, bgcolor: 'error.light', borderRadius: 1.5, mb: 2 }}>
            <Typography color="error" variant="body2">{error}</Typography>
          </Paper>
        )}

        {/* Main List Component - Only show when not viewing questions */}
{!selectedConcept && (
  <AnimatedSection elevation={1} sx={{ borderRadius: 1.5, mb: 3, overflow: 'hidden', backgroundColor: 'white' }}>
    <Box sx={{ p: 1.5, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {!selectedSubject && <SchoolIcon sx={{ mr: 1, color: 'primary.main' }} />}
        {selectedSubject && !selectedTopic && <ListIcon sx={{ mr: 1, color: 'secondary.main' }} />}
        {selectedTopic && !selectedSubtopic && <InfoIcon sx={{ mr: 1, color: 'success.main' }} />}
        {selectedSubtopic && !selectedConcept && <QuizIcon sx={{ mr: 1, color: 'info.main' }} />}
        
        <Typography variant="body1" fontWeight="500">
          {!selectedSubject && 'All Subjects'}
          {selectedSubject && !selectedTopic && `Topics in ${selectedSubject}`}
          {selectedTopic && !selectedSubtopic && `Subtopics in ${selectedTopic}`}
          {selectedSubtopic && !selectedConcept && `Concepts in ${selectedSubtopic}`}
        </Typography>
      </Box>
      
      {/* Counter chip */}
      <Chip 
        label={!selectedSubject ? `${subjects.length} subjects` : 
              selectedSubject && !selectedTopic ? `${topics.length} topics` :
              selectedTopic && !selectedSubtopic ? `${subtopics.length} subtopics` :
              `${concepts.length} concepts`}
        size="small"
        color={!selectedSubject ? 'primary' :
              selectedSubject && !selectedTopic ? 'secondary' :
              selectedTopic && !selectedSubtopic ? 'success' : 'info'}
        variant="outlined"
      />
    </Box>  
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <List sx={{ p: 1 }}>
              {/* Subjects List */}
              {!selectedSubject && subjects.map((subject, index) => (
                <React.Fragment key={subject}>
                  <CategoryListItem
                    item={subject}
                    itemType="subject"
                    onItemClick={() => handleItemClick(subject, 'subject')}
                    onExplore={() => handleItemClick(subject, 'subject')}
                    onPractice={() => openAssessmentConfig(subject, 'subject')}
                    onDelete={handleDelete}
                    editMode={editMode}
                    editingName={editingName}
                    newName={newName}
                    setNewName={setNewName}
                    startEditing={startEditing}
                    saveRename={saveRename}
                    cancelEditing={cancelEditing}
                    className="subject-card"
                  />
                </React.Fragment>
              ))}

              {/* Topics List */}
              {selectedSubject && !selectedTopic && topics.map((topic, index) => (
                <React.Fragment key={topic}>
                  <CategoryListItem
                    item={topic}
                    itemType="topic"
                    onItemClick={() => handleItemClick(topic, 'topic')}
                    onExplore={() => handleItemClick(topic, 'topic')}
                    onPractice={() => openAssessmentConfig(topic, 'topic')}
                    onDelete={handleDelete}
                    editMode={editMode}
                    editingName={editingName}
                    newName={newName}
                    setNewName={setNewName}
                    startEditing={startEditing}
                    saveRename={saveRename}
                    cancelEditing={cancelEditing}
                  />
                </React.Fragment>
              ))}

              {/* Subtopics List */}
              {selectedTopic && !selectedSubtopic && subtopics.map((subtopic, index) => (
                <React.Fragment key={subtopic}>
                  <CategoryListItem
                    item={subtopic}
                    itemType="subtopic"
                    onItemClick={() => handleItemClick(subtopic, 'subtopic')}
                    onExplore={() => handleItemClick(subtopic, 'subtopic')}
                    onPractice={() => openAssessmentConfig(subtopic, 'subtopic')}
                    onDelete={handleDelete}
                    editMode={editMode}
                    editingName={editingName}
                    newName={newName}
                    setNewName={setNewName}
                    startEditing={startEditing}
                    saveRename={saveRename}
                    cancelEditing={cancelEditing}
                  />
                </React.Fragment>
              ))}

              {/* Concepts List */}
              {selectedSubtopic && !selectedConcept && concepts.map((concept, index) => (
                <React.Fragment key={concept}>
                  <CategoryListItem
                    item={concept}
                    itemType="concept"
                    onItemClick={() => handleItemClick(concept, 'concept')}
                    onExplore={() => handleItemClick(concept, 'concept')}
                    onPractice={() => openAssessmentConfig(concept, 'concept')}
                    onDelete={handleDelete}
                    editMode={editMode}
                    editingName={editingName}
                    newName={newName}
                    setNewName={setNewName}
                    startEditing={startEditing}
                    saveRename={saveRename}
                    cancelEditing={cancelEditing}
                    showExplore={false}
                  />
                </React.Fragment>
              ))}
            </List>
          )}
          
          {/* Empty states for each level */}
          {!loading && !error && (
            <>
              {selectedSubject && topics.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No topics available for {selectedSubject}
                  </Typography>
                </Box>
              )}
              
              {selectedTopic && subtopics.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No subtopics available for {selectedTopic}
                  </Typography>
                </Box>
              )}
              
              {selectedSubtopic && concepts.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No concepts available for {selectedSubtopic}
                  </Typography>
                </Box>
              )}
              
              {!selectedSubject && subjects.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No subjects available yet
                  </Typography>
                </Box>
              )}
            </>
          )}
        </AnimatedSection>)}

        {/* Welcome message for brand new users - more compact */}
        {!selectedSubject && subjects.length === 0 && !loading && !error && (
          <AnimatedSection
            elevation={2}
            sx={{
              p: 3,
              borderRadius: 1.5,
              background: 'linear-gradient(145deg, #e3f2fd 0%, #bbdefb 100%)',
            }}
          >
            <Typography variant="h6" gutterBottom color="primary.dark" sx={{ fontWeight: 600 }}>
              Welcome to Your Self-Assessment Hub!
            </Typography>
            <Typography variant="body2" paragraph>
              This is where all your automatically generated quizzes will appear as you study documents. 
              To get started, upload study materials and generate questions while reading.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="contained"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => navigate('/files')}
                sx={{ borderRadius: '8px' }}
              >
                Upload Study Documents
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={() => navigate('/timetable')}
                sx={{ borderRadius: '8px' }}
              >
                View Study Schedule
              </Button>
            </Box>
          </AnimatedSection>
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

      {/* Edit Question Modal */}
      <Dialog open={editQuestionModal} onClose={closeEditQuestionModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <EditIcon sx={{ mr: 1 }} fontSize="small" />
            Edit Question
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Question Text"
            fullWidth
            margin="normal"
            value={editQuestionForm.questionText}
            onChange={(e) => setEditQuestionForm({...editQuestionForm, questionText: e.target.value})}
          />
          <TextField
            label="Correct Answer"
            fullWidth
            margin="normal"
            value={editQuestionForm.correctAnswer}
            onChange={(e) => setEditQuestionForm({...editQuestionForm, correctAnswer: e.target.value})}
          />
          {editQuestionForm.options.map((option, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mt: 1.5 }}>
              <TextField
                label={`Option ${index + 1}`}
                fullWidth
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                size="small"
              />
              <IconButton color="error" onClick={() => removeOption(index)} size="small" sx={{ ml: 0.5 }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button 
            onClick={addOption} 
            startIcon={<AddIcon />}
            size="small" 
            sx={{ mt: 1.5 }}
          >
            Add Option
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditQuestionModal} size="small">Cancel</Button>
          <Button onClick={handleUpdateQuestion} variant="contained" color="primary" size="small">Save</Button>
        </DialogActions>
      </Dialog>
    </ContentWrapper>
  );
};

// Assessment Configuration Modal - Kept the same with small adjustments for consistency
const AssessmentConfigModal = ({ open, handleClose, item, level, navigate }) => {
  // Keep the existing state and handlers
  const [config, setConfig] = useState({
    numQuestions: 5,
    difficulty: 'medium',
    timeLimit: 0, // 0 = no limit
    questionTypes: ['open-ended'],
    includeSubtopics: true,
    selectedItems: [], // Store selected topics/subtopics/concepts
    considerHistory: true // Add this new parameter
  });
  
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
    // Get the token from localStorage
    const token = localStorage.getItem('token');
    
    
    setLoadingItems(true);
    try {
      let endpoint;
      if (level === 'subject') {
        endpoint = `/assessment/topics/${encodeURIComponent(item)}`;
      } else if (level === 'topic') {
        endpoint = `/assessment/subtopics/${encodeURIComponent(item)}`;
      } else if (level === 'subtopic') {
        endpoint = `/assessment/concepts/${encodeURIComponent(item)}`;
      }
      
      if (endpoint) {
        const response = await axios.get(`${API_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
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
    // Include parent information from props
    navigate('/assessment', { 
      state: { 
        level,
        item, 
        config: {
          ...config,
          considerHistory: config.considerHistory // Pass this parameter
        }
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
          <AssessmentIcon sx={{ mr: 1 }} fontSize="small" />
          Configure Assessment
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
          {level ? `${level.charAt(0).toUpperCase() + level.slice(1)}: ` : ''}<strong>{item || ''}</strong>
        </Typography>
        
        <FormControl fullWidth margin="normal" size="small">
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

        {/* <FormControl fullWidth margin="normal" size="small">
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
        </FormControl> */}

        <FormControl fullWidth margin="normal" size="small">
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

        <FormControlLabel
          control={
            <Switch 
              checked={config.considerHistory}
              onChange={(e) => setConfig({...config, considerHistory: e.target.checked})}
              size="small"
            />
          }
          label={
            <Typography variant="body2">
              Consider my performance history when selecting questions
            </Typography>
          }
          sx={{ mt: 1, mb: 0.5 }}
        />

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={handleClose} size="small">
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => handleStartAssessment()}
            size="small"
          >
            Start Assessment
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default Practice;

