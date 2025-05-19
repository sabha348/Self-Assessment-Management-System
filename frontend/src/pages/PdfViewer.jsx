import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, Toaster } from 'react-hot-toast';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { thumbnailPlugin } from '@react-pdf-viewer/thumbnail';
import { jwtDecode } from 'jwt-decode';
import Joyride from 'react-joyride'; // Make sure this import is included

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/thumbnail/lib/styles/index.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const PdfViewer = () => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const decodedToken = token ? jwtDecode(token) : null;
  const userId = decodedToken?.userId; // or .id or ._id depending on your token
  const navigate = useNavigate();
  const { pdfData, title, userId: locationUserId} = location.state || {};
  const [selectedText, setSelectedText] = useState('');
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  const [showButton, setShowButton] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [showQuestions, setShowQuestions] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answers, setAnswers] = useState({});
  const [quizId, setQuizId] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [lastReadPosition, setLastReadPosition] = useState(0);
  const [autoSubmissionTimer, setAutoSubmissionTimer] = useState(null);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(Date.now());
  const [startTime, setStartTime] = useState(Date.now());
  const [savedMarkers, setSavedMarkers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  // Timer-related state variables
  const [quizEndTime, setQuizEndTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [quizTimerInterval, setQuizTimerInterval] = useState(null);

  // Break notification related states
  const [recentScores, setRecentScores] = useState([]);
  const [showBreakNotification, setShowBreakNotification] = useState(false);
  const [notificationIgnored, setNotificationIgnored] = useState(false);
  const [lastBreakTimestamp, setLastBreakTimestamp] = useState(null);

  // Constants for text limits
  const TEXT_LIMITS = {
    MIN_CHARS: 100,
    MAX_CHARS: 1000,  // Reduced from 3000 to 1000 for better server handling
    OPTIMAL_CHARS: 500
  };

  const [lastActiveTimestamp, setLastActiveTimestamp] = useState(() => {
    // Initialize from localStorage or use current time
    const saved = localStorage.getItem(`last-active-${userId}`);
    return saved ? parseInt(saved, 10) : Date.now();
  });

  const [questionConfig, setQuestionConfig] = useState({
  numQuestions: 5,
  difficulty: 'medium',
  questionTypes: ['open-ended'],
  timeLimit: 0
});

// Add this state variable with your other states
const [isProcessingResults, setIsProcessingResults] = useState(false);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const thumbnailPluginInstance = thumbnailPlugin();

  // Joyride tour state
  const [runTour, setRunTour] = useState(false);
  const [steps] = useState([
    {
      target: '.pdf-viewer-container',
      content: 'Select text from the PDF document and click the "Generate" button that appears to create questions about what you\'ve read.',
      title: 'Generate Questions Manually',
      disableBeacon: true,
      placement: 'top-start'
    },
    {
      target: '.pdf-viewer-container',
      content: 'Questions will also be automatically generated every 5 minutes as you read, allowing you to practice and test your understanding without interrupting your reading flow.',
      title: 'Auto-Generated Questions',
      placement: 'top-end'
    },
    {
      target: '.save-result-button',
      content: 'After answering questions, you can save your results temporarily in local storage. These will appear as markers on the right side of the document for quick reference.',
      title: 'Save Your Results',
    },
    {
      target: 'body',
      content: 'If you receive 5 scores below 60%, a break suggestion will appear. Taking regular breaks improves retention and learning effectiveness. You can choose to take a break or continue reading.',
      title: 'Break Suggestions',
      placement: 'center'
    }
  ]);



  useEffect(() => {
  // If location.state has question config, use it to initialize our state
  if (location.state?.questionConfig) {
    setQuestionConfig(location.state.questionConfig);
  }
}, [location.state]);

  // Check if user has seen this tour before
  useEffect(() => {
    if (userId) {
      const hasSeenTour = localStorage.getItem(`hasSeenPdfViewerTour-${userId}`);
      if (!hasSeenTour) {
        // Short delay to ensure components are rendered
        const timer = setTimeout(() => {
          setRunTour(true);
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [userId]);

  // Joyride callback handler
  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if (status === 'finished' || status === 'skipped') {
      setRunTour(false);
      // Save that user has seen the tour
      if (userId) {
        localStorage.setItem(`hasSeenPdfViewerTour-${userId}`, 'true');
      }
    }
  };


  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const text = selection.toString().trim();
      if (!text) {
        setShowButton(false);
        return;
      }

      // Get all selected ranges
      const range = selection.getRangeAt(0);
      const selectedNode = range.commonAncestorContainer;
      
      // Check if selection is within any PDF page
      const element = selectedNode.nodeType === 3 ? selectedNode.parentElement : selectedNode;
      const pdfPage = element.closest('.rpv-core__viewer-page') || 
                     element.closest('.react-pdf__Page') ||
                     element.closest('.rpv-core__viewer');

      if (pdfPage) {
        // Get the selection boundaries
        const rect = range.getBoundingClientRect();
        
        // Position the button at the top of the selection
        setButtonPosition({
          x: rect.left + (rect.width / 2),
          y: Math.max(rect.top + window.scrollY - 60, 70) // Ensure button doesn't go above header
        });
        setSelectedText(text);
        setShowButton(true);
      }
    };
    

     const handleClick = (e) => {
      // Check if clicked on the generate button itself
      const isClickingGenerateButton = e.target.closest('.generate-button');
      
      // Check if we just made a selection (this is the critical fix)
      const selection = window.getSelection();
      const hasSelection = selection && selection.toString().trim().length > 0;
      
      // Only clear selection and hide button if:
      // 1. Not clicking on generate button AND
      // 2. There's no fresh selection OR we're clicking far from the selection
      if (!isClickingGenerateButton && !hasSelection) {
        selection.removeAllRanges(); // Clear the selection
        setShowButton(false); // Hide the button
      }
    };

    const handleScroll = () => {
      setShowButton(false);
      // Only create timer if not already showing questions or results
      if (!isTimerPaused && !showQuestions && !showResults && !autoSubmissionTimer) {
        console.log('Setting up timer from scroll handler');
        const timer = setInterval(handleAutoSubmission, 60 * 1000);
        setAutoSubmissionTimer(timer);
      }
    };

    // Use mouseup instead of click for better text selection handling
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll);
    
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [isTimerPaused, showQuestions, showResults, autoSubmissionTimer]); // Add dependencies

  useEffect(() => {
    // Set start time when component mounts
    setStartTime(Date.now());
  }, []);

  useEffect(() => {
    // Validate token and user ID early
    if (!token) {
      console.error('No authentication token found');
      toast.error('Please log in to continue');
      navigate('/login');
      return;
    }
    
    // Verify userId exists from token
    if (!userId) {
      console.error('Invalid or expired token (no userId)');
      toast.error('Your session has expired, please log in again');
      localStorage.removeItem('token'); // Clear invalid token
      navigate('/login');
      return;
    }
  }, [token, userId, navigate]);

  const handleProcessText = useCallback(async () => {
    try {
      // Clear the autoSubmission timer when manually generating questions
       // Hide the button immediately after click
      setShowButton(false);

      if (autoSubmissionTimer) {
        clearInterval(autoSubmissionTimer);
        setAutoSubmissionTimer(null);
      }
      
      // Set timer paused flag to prevent new auto-timers
      setIsTimerPaused(true);
      
      const questionSettings = questionConfig;

      // Determine question type format for backend
      const questionType = questionSettings.questionTypes.includes('mixed') ? 
        'mix' : questionSettings.questionTypes.length > 1 ? 
          'mix' : questionSettings.questionTypes[0];
      
      const loadingToast = toast.loading('Generating questions...');

      const response = await axios.post(`${API_URL}/quizzes`, {
        text: selectedText,
        numQuestions: questionSettings.numQuestions,
        userId: userId,
        topic: 'General',
        subject: 'Knowledge',
        type: questionType,
        difficulty: questionSettings.difficulty,
        timeLimit: questionSettings.timeLimit
      });

      if (!response.data.quizId) {
        console.error('No quizId in API response:', response.data);
        toast.error('Server error: Missing quiz information');
        return;
      }

      // Get the quizId directly from response
    const quizIdentifier = response.data.quizId;
    
      
      setQuestions(response.data.questions);
      setQuizId(quizIdentifier);
      setShowQuestions(true);
      toast.dismiss(loadingToast);
      
      // Start timer if a time limit is set
      if (questionSettings.timeLimit > 0) {
        startQuizTimer(questionSettings.timeLimit, quizIdentifier);
      }
      
      // Clear selection and button
      window.getSelection().removeAllRanges();
      setShowButton(false);
      setSelectedText('');
    } catch (error) {
      console.error('Error processing text:', error);
      
      // Dismiss loading toast if it exists
      toast.dismiss();
      
      // Show more detailed error message
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to generate questions. Please try selecting a different portion of text.';
      
      toast.error(errorMessage, {
        duration: 5000,
        style: {
          maxWidth: '500px',
          padding: '16px',
          wordBreak: 'break-word'
        }
      });
      
      // Clear selection and button
      window.getSelection().removeAllRanges();
      setShowButton(false);
      setSelectedText('');
      
      // Make sure to reset the timer paused state on error
      setIsTimerPaused(false);
    }
}, [userId, questionConfig, selectedText,autoSubmissionTimer]);

  // Function to get text content up to current scroll position
  // Convert getVisibleText to a memoized function with useCallback
const getVisibleText = useCallback(() => {
  // Try multiple selector patterns to find text content in various PDF viewer implementations
  const textLayerElements = document.querySelectorAll(
    '.rpv-core__text-layer, .react-pdf__Page__textContent, .textLayer, .rpv-core__viewer-page-text-layer'
  );
  
  console.log(`Found ${textLayerElements.length} text layer elements`);
  
  let allText = '';
  const viewportHeight = window.innerHeight;
  const scrollPosition = window.scrollY;
  const visibleBottom = scrollPosition + viewportHeight;
  
  // Process all found text layers
  textLayerElements.forEach((textLayer, index) => {
    const rect = textLayer.getBoundingClientRect();
    const elementTop = rect.top + scrollPosition;
    const elementBottom = rect.bottom + scrollPosition;
    
    // Only consider elements that have been scrolled past or are currently visible
    if (elementBottom <= visibleBottom) {
      const pageText = textLayer.textContent || '';
      console.log(`Page ${index+1} text length: ${pageText.length} chars`);
      allText += pageText + ' ';
    }
  });
  
  // Get only content after the last read position
  const fullText = allText.trim();
  console.log(`Total extracted text: ${fullText.length} chars`);
  
  // Calculate how much is new (after lastReadPosition)
  let newContent = '';
  if (fullText.length > lastReadPosition) {
    newContent = fullText.slice(lastReadPosition).trim();
    console.log(`New content detected: ${newContent.length} chars`);
    
    // Don't truncate - use all available content
    // But still provide a preview in logs
    if (newContent.length > 100) {
      const preview = newContent.substring(0, 100);
      console.log(`Content preview: ${preview}...`);
    }

    // Basic validation - remove problematic characters
    newContent = newContent.replace(/[^\x20-\x7E\n\r\t]/g, ' ');

    // Ensure content isn't just garbage characters
    if (!/[a-zA-Z]{5,}/.test(newContent)) {
      console.log('Content appears to be malformed, skipping');
      return '';
    }
    
    return newContent;
  } else {
    console.log('No new content detected');
    return '';
  }
}, [lastReadPosition]);

  // Replace your current handleAutoSubmission function with this fixed version:
const handleAutoSubmission = useCallback(async () => {
  // Don't run if timer should be paused
  if (isTimerPaused || showQuestions || showResults) {
    console.log('Auto-submission paused - questions or results are shown');
    return;
  }
  
  const currentTime = Date.now();
  const timeSinceLastSubmission = currentTime - lastSubmissionTime;
  const FIVE_MINUTES = 5 * 60 * 1000;
  
  console.log(`Time since last check: ${Math.round(timeSinceLastSubmission/1000)}s, Need: ${FIVE_MINUTES/1000}s`);
  
  if (timeSinceLastSubmission < FIVE_MINUTES) {
    return; // Not time to check yet
  }
  
  console.log('5 minutes passed, checking for new content...');
  const newText = getVisibleText();
  
  // IMPORTANT: Set this immediately to prevent duplicate runs regardless of outcome
  setLastSubmissionTime(currentTime);
  
  // Ensure we have enough text to generate meaningful questions
  if (newText && newText.length >= TEXT_LIMITS.MIN_CHARS) {
    try {
      console.log(`Found ${newText.length} chars of new content - generating questions`);
      
      // Store toast reference properly
      const loadingToastId = toast.loading('Auto-generating questions from your reading...');
      
      const questionSettings = questionConfig;

      // Determine question type format for backend
      const questionType = questionSettings.questionTypes.includes('mixed') ? 
        'mix' : questionSettings.questionTypes.length > 1 ? 
          'mix' : questionSettings.questionTypes[0];

      const response = await axios.post(`${API_URL}/quizzes`, {
        text: newText,
        numQuestions: questionSettings.numQuestions,
        userId: userId,
        subject: 'Knowledge',
        type: questionType,
        difficulty: questionSettings.difficulty,
        topic: 'Reading Comprehension',
        timeLimit: questionSettings.timeLimit
      });

      if (!response.data.quizId) {
        console.error('No quizId in API response:', response.data);
        toast.error('Server error: Missing quiz information');
        return;
      }
      
      // Dismiss using the correct ID
      toast.dismiss(loadingToastId);
      
      // Success path - update position and show questions
      toast.success('Questions generated from your reading!');
      
      console.log(`Updating last read position from ${lastReadPosition} to ${lastReadPosition + newText.length}`);
      setLastReadPosition(prevPos => prevPos + newText.length);
      
      // Get quizId directly from response
      const quizIdentifier = response.data.quizId;
      
      setQuestions(response.data.questions);
      setQuizId(quizIdentifier);
      setShowQuestions(true);
      setIsTimerPaused(true); // Pause timer while showing questions

      if (questionSettings.timeLimit > 0) {
        // Force a small delay to ensure state updates are processed
  setTimeout(() => {
    console.log('Starting delayed timer for auto-generated questions');
    startQuizTimer(Number(questionSettings.timeLimit), quizIdentifier);
  }, 300);  // Delay of 300ms to allow state updates
      }
    } 
    catch (error) {
      console.error('Error in auto-submission:', error);
      
      // No need to dismiss a non-existent toast
      toast.error('Failed to generate questions from your reading.');
      
      // Set a longer delay before next attempt on failure
      // This prevents rapid consecutive failures
      setLastSubmissionTime(currentTime);
    }
  } else {
    console.log('Insufficient new content:', {
      contentLength: newText?.length || 0,
      minRequired: TEXT_LIMITS.MIN_CHARS,
      maxAllowed: TEXT_LIMITS.MAX_CHARS
    });
  }
}, [getVisibleText, lastReadPosition, userId, TEXT_LIMITS.MIN_CHARS, TEXT_LIMITS.MAX_CHARS, questionConfig, isTimerPaused, showQuestions, showResults]);


  // Resume timer when questions are closed
const handleCloseQuestions = () => {
  clearQuizTimer();
  setShowQuestions(false);
  
  // Only unpause if we're not processing results
  if (!isProcessingResults) {
    setIsTimerPaused(false);
  }
};

  // Clear timer function
const clearQuizTimer = useCallback(() => {
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
    setQuizTimerInterval(null);
  }
  setQuizEndTime(null);
  setRemainingTime(null);
}, [quizTimerInterval]);

// Replace your existing checkForBreakNotification function
const checkForBreakNotification = useCallback(() => {
  const today = new Date().toDateString();
  
  // Only consider scores from today
  const todayScores = recentScores.filter(score => 
    new Date(score.timestamp).toDateString() === today
  );
  
  if (todayScores.length === 0) return;
  
  // Get the required number of consecutive low scores based on past user behavior
  const requiredLowScores = notificationIgnored ? 2 : 5;
  
  // Check the most recent scores
  const recentLowScores = todayScores
    .slice(-requiredLowScores)
    .filter(score => score.percentage < 60);
    
  // Only show notification if we have enough scores and they're all below threshold
  if (recentLowScores.length >= requiredLowScores && 
      recentLowScores.length === Math.min(todayScores.length, requiredLowScores)) {
      
    // Don't show notification too frequently (minimum 30 min between notifications)
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    
    // Check for sufficient break since last notification
    if (!lastBreakTimestamp || lastBreakTimestamp < thirtyMinutesAgo) {
      setShowBreakNotification(true);
      setLastBreakTimestamp(Date.now());
      
      // Reset counter in localStorage for persistence
      localStorage.setItem(`last-break-${userId}`, Date.now().toString());
      
      // Track that notification was shown to user
      trackBreakNotificationShown();
    }
  }
}, [recentScores, notificationIgnored, lastBreakTimestamp, userId]);


// Track when a notification is shown to the user
const trackBreakNotificationShown = useCallback(async () => {
  try {
    const response = await axios.post(`${API_URL}/analytics/break-notification`, {
      userId,
      eventType: 'notification_shown',
      timestamp: Date.now()
    });
    console.log('Break notification tracked:', response.data);
  } catch (error) {
    console.error('Error tracking break notification:', error);
  }
}, [userId]);

// Track user's response to break notification
const trackBreakResponse = useCallback(async (response) => {
  try {
    const data = {
      userId,
      eventType: response === 'accepted' ? 'break_taken' : 'break_ignored',
      timestamp: Date.now()
    };
    const apiResponse = await axios.post(`${API_URL}/analytics/break-notification`, data);
    console.log('Break response tracked:', apiResponse.data);
  } catch (error) {
    console.error('Error tracking break response:', error);
  }
}, [userId]);

  // Submit handler
const handleSubmitAnswers = useCallback(async (isTimeUp = false, explicitQuizId = quizId) => {
  // Use explicitly passed quizId or fall back to state
  const submissionQuizId = explicitQuizId || quizId;
  
  console.log('Submitting answers with:', { quizId: submissionQuizId, userId, isTimeUp, remainingTime });
  
  if (!submissionQuizId || !userId) {
    console.error('Missing quiz ID or user ID');
    toast.error("Missing information. Please try again.");
    return;
  }

  // Check if there are unanswered questions
  const answeredQuestionsCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredQuestionsCount;
  
  // Show confirmation only if there are unanswered questions
  if (unansweredCount > 0 && !isTimeUp) {
    if (!window.confirm(`You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. These will be marked as "unanswered". Do you want to continue?`)) {
      return; // User canceled submission
    }
  }

  // ⭐ Close questions immediately, but keep timer paused
  setShowQuestions(false);
  setIsProcessingResults(true); // Mark that we're processing
  
  const showTimeUpMessage = isTimeUp && (!remainingTime);
  const toastId = toast.loading(showTimeUpMessage ? "Time's up! Processing answers..." : "Processing answers...");

  try {
    // Clear the quiz timer
    clearQuizTimer();

    // Calculate time taken in seconds
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    // Create formatted answers with "unanswered" for missing answers
    const formattedAnswers = {};
    questions.forEach((question, index) => {
      formattedAnswers[index] = answers[index] || "unanswered";
    });

    const response = await axios.post(`${API_URL}/quizzes/${quizId}/submit`, {
      answers: formattedAnswers,
      userId: userId,
      timeTaken: timeTaken,
    });

    toast.dismiss(toastId);
    
    // Calculate score percentage
    const scorePercentage = ((response.data.totalScore / questions.length) * 100);
    
    // Add score to recent scores
    setRecentScores(prev => {
      const newScores = [...prev, { 
        percentage: scorePercentage, 
        timestamp: Date.now(),
        quizId: quizId
      }];
      return newScores.slice(-10);
    });
    
    setEvaluationResults(response.data);
    setShowResults(true);
    checkForBreakNotification();
    
  } catch (error) {
    toast.dismiss(toastId);
    console.error('Error submitting answers:', error);
    toast.error('Failed to submit answers. Please try again.');
    setIsTimerPaused(false); // In error case, resume timer
  } finally {
    setIsProcessingResults(false); // Always clear the processing flag
  }
}, [quizId, userId, questions, answers, startTime, clearQuizTimer, checkForBreakNotification, remainingTime]);

  // Resume timer when results are closed
  const handleCloseResults = () => {
    setShowResults(false);
    setEvaluationResults(null);
    setAnswers({});
    setSelectedQuestion(null);
    setIsTimerPaused(false);  // Resume timer
    // Reset start time for next assessment
    setStartTime(Date.now());
  };

  const MarkerButton = ({ marker, onClick }) => (
    <button
      className="absolute right-0 w-8 h-8 bg-blue-500 rounded-full text-white hover:bg-blue-600 
                 transform transition-transform hover:scale-110 flex items-center justify-center
                 shadow-lg z-50"
      style={{ top: `${marker.position}px` }}
      onClick={() => onClick(marker)}
      title={`Result from ${marker.timestamp}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );

  // Save markers to localStorage when they change
  useEffect(() => {
    if (savedMarkers.length > 0) {
      localStorage.setItem(`pdf-markers-${pdfData}`, JSON.stringify(savedMarkers));
    }
  }, [savedMarkers, pdfData]);

  // Load markers when component mounts
  useEffect(() => {
    const savedMarkersData = localStorage.getItem(`pdf-markers-${pdfData}`);
    if (savedMarkersData) {
      setSavedMarkers(JSON.parse(savedMarkersData));
    }
  }, [pdfData]);

  // Create a separate function for handling save
  const handleSaveResult = useCallback(async () => {
    try {
      setIsSaving(true);
      
      const marker = {
        id: Date.now(),
        position: buttonPosition.y,
        results: evaluationResults,
        timestamp: new Date().toLocaleString()
      };

      // Update markers state using functional update
      setSavedMarkers(prev => [...prev, marker]);

      // Save to localStorage asynchronously
      await Promise.resolve(
        localStorage.setItem(
          `pdf-markers-${pdfData}`, 
          JSON.stringify([...savedMarkers, marker])
        )
      );

      handleCloseResults();
      toast.success('Result saved successfully!');
    } catch (error) {
      console.error('Error saving result:', error);
      toast.error('Failed to save result');
    } finally {
      setIsSaving(false);
    }
  }, [buttonPosition.y, evaluationResults, pdfData, savedMarkers]);

  // Delete ALL other timer-related useEffect hooks and keep only this consolidated one
useEffect(() => {
  // Clear any existing timer first
  if (autoSubmissionTimer) {
    console.log('Clearing existing timer');
    clearInterval(autoSubmissionTimer);
    setAutoSubmissionTimer(null);
  }

  // Only set up a new timer if not paused AND not showing questions/results
  if (!isTimerPaused && !showQuestions && !showResults) {
    console.log('Setting up single auto-submission timer - checks every 60 seconds');
    
    const timer = setInterval(handleAutoSubmission, 60 * 1000);
    setAutoSubmissionTimer(timer);
    
    return () => {
      console.log('Cleaning up timer on unmount');
      clearInterval(timer);
    };
  }
  
  return undefined; // Empty cleanup when no timer is created
}, [isTimerPaused, showQuestions, showResults,isProcessingResults, handleAutoSubmission]); // Add showQuestions and showResults

// Format remaining time as mm:ss
const formatTime = (ms) => {
  if (!ms) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Start quiz timer function with a completely different approach
const startQuizTimer = useCallback((timeLimit, explicitQuizId) => {
  // Clear any existing timer
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
  }
  
  // Store the quiz ID in a ref to ensure it persists
  const currentQuizId = explicitQuizId;
  console.log('Starting timer for quizId:', currentQuizId);
  
  // Calculate end time
  const endTime = Date.now() + (Number(timeLimit) * 60 * 1000);
  setQuizEndTime(endTime);
  
  // Create interval to update timer display
  const timerInterval = setInterval(() => {
    const now = Date.now();
    const timeLeft = endTime - now;
    
    setRemainingTime(timeLeft);
    
    // Auto-submit when time runs out
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      setRemainingTime(0);
      
      // Close questions immediately but keep timer paused
  setShowQuestions(false);
  setIsProcessingResults(true);
      // Use a completely different approach - direct submission with current quiz ID
      console.log('Timer expired, submitting with quizId:', currentQuizId);
      
      // Set up timeout notification
      const toastId = toast.loading("Time's up! Submitting answers...");
      
      // Create formatted answers with "unanswered" for missing answers
      const formattedAnswers = {};
      questions.forEach((question, index) => {
        formattedAnswers[index] = currentAnswersRef.current[index] || "unanswered";
      });
      
      // Calculate time taken in seconds
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      console.log("formattedAnswers", formattedAnswers);
      
      // Direct API call without going through handleSubmitAnswers
      axios.post(`${API_URL}/quizzes/${currentQuizId}/submit`, {
        answers: formattedAnswers,
        userId: userId,
        timeTaken: timeTaken,
      })
      .then(response => {
        toast.dismiss(toastId);
        
        // Calculate score percentage
        const scorePercentage = ((response.data.totalScore / questions.length) * 100);
        
        // Add score to recent scores
        setRecentScores(prev => {
          const newScores = [
            ...prev, 
            { 
              percentage: scorePercentage, 
              timestamp: Date.now(),
              quizId: currentQuizId
            }
          ];
          
          // Keep only the last 10 scores for memory efficiency
          return newScores.slice(-10);
        });
        
        setEvaluationResults(response.data);
        setShowQuestions(false);
        setShowResults(true);
        
        // Reset timer states
        setQuizTimerInterval(null);
        setQuizEndTime(null);
        setRemainingTime(null);
        
        // After processing the score, check if a break notification is needed
        checkForBreakNotification();
        setIsProcessingResults(false);
      })
      .catch(error => {
        toast.dismiss(toastId);
        console.error('Error submitting answers:', error);
        toast.error('Failed to submit answers. Please try again.');
        setIsProcessingResults(false);
      });
    }
  }, 1000);
  
  setQuizTimerInterval(timerInterval);
}, [userId, questions, startTime, checkForBreakNotification]);


// Clean up timers on unmount
useEffect(() => {
  return () => {
    if (quizTimerInterval) {
      clearInterval(quizTimerInterval);
    }
    if (autoSubmissionTimer) {
      clearInterval(autoSubmissionTimer);
    }
  };
}, [quizTimerInterval, autoSubmissionTimer]);



// Load recent scores from localStorage on component mount
useEffect(() => {
  const savedScores = localStorage.getItem(`recent-scores-${userId}`);
  if (savedScores) {
    try {
      setRecentScores(JSON.parse(savedScores));
    } catch (error) {
      console.error('Error parsing saved scores:', error);
    }
  }
}, [userId]);

// Save recent scores to localStorage when they change
useEffect(() => {
  if (recentScores.length > 0 && userId) {
    localStorage.setItem(`recent-scores-${userId}`, JSON.stringify(recentScores));
  }
}, [recentScores, userId]);

// Break notification modal
const BreakNotificationModal = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 text-yellow-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Time for a Break</h2>
        <p className="text-gray-600 mb-6">
          We've noticed your recent scores have been declining. Research shows taking a short break (30+ minutes) can improve retention and performance.
        </p>
        <div className="flex space-x-4">
          <button
            onClick={() => {
              setShowBreakNotification(false);
              setNotificationIgnored(true);
              // Store this decision in localStorage
              localStorage.setItem(`notification-ignored-${userId}`, 'true');
              // Track that user ignored the break
              trackBreakResponse('ignored');
            }}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Continue Anyway
          </button>
          <button
            onClick={() => {
              setShowBreakNotification(false);
              setNotificationIgnored(false);
              // Capture time when user decided to take a break
              const breakTime = Date.now();
              localStorage.setItem(`break-start-${userId}`, breakTime.toString());
              // Track that user took a break
              trackBreakResponse('accepted');
              // User accepted the break suggestion
              navigate('/dashboard');
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Take a Break
          </button>
        </div>
      </div>
    </div>
  </div>
);


useEffect(() => {
  // Load break notification state from localStorage
  const savedLastBreak = localStorage.getItem(`last-break-${userId}`);
  if (savedLastBreak) {
    setLastBreakTimestamp(parseInt(savedLastBreak, 10));
  }
  
  const savedNotificationIgnored = localStorage.getItem(`notification-ignored-${userId}`);
  if (savedNotificationIgnored) {
    setNotificationIgnored(savedNotificationIgnored === 'true');
  }
}, [userId]);

// Add persistence when notification state changes
useEffect(() => {
  if (notificationIgnored !== null) {
    localStorage.setItem(`notification-ignored-${userId}`, notificationIgnored.toString());
  }
}, [notificationIgnored, userId]);

// Add this with your other useEffect hooks
useEffect(() => {
  // This function should only run once on mount or when userId changes
  // We need to check if the user is returning after a break without causing infinite loops
  
  const checkForBreakReturn = () => {
    const savedTimestamp = localStorage.getItem(`last-active-${userId}`);
    if (savedTimestamp) {
      const lastActiveTime = parseInt(savedTimestamp, 10);
      const currentTime = Date.now();
      const timeAwayInMinutes = (currentTime - lastActiveTime) / (1000 * 60);
      
      // If returning after 30+ minutes, reset the notification ignored state
      if (timeAwayInMinutes >= 30 && notificationIgnored) {
        console.log(`User returning after ${Math.round(timeAwayInMinutes)} minutes - resetting notification state`);
        setNotificationIgnored(false);
      }
    }
    
    // Update the timestamp in localStorage, but not in state
    localStorage.setItem(`last-active-${userId}`, Date.now().toString());
  };
  
  // Run once on component mount
  checkForBreakReturn();
  
  // Set up event listeners to track when user leaves the page
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      localStorage.setItem(`last-active-${userId}`, Date.now().toString());
    } else {
      // When coming back to the page, check if it was a long break
      checkForBreakReturn();
    }
  };
  
  const handleBeforeUnload = () => {
    localStorage.setItem(`last-active-${userId}`, Date.now().toString());
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [userId, notificationIgnored]); 

  const currentAnswersRef = useRef({});

  // Keep the ref updated
  useEffect(() => {
    currentAnswersRef.current = answers;
  }, [answers]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/*  Joyride component */}
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
      
      {/* Toaster component */}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#363636',
            color: '#fff',
          },
           // Loading toasts will persist until manually dismissed
          loading: {
            duration: false,
          },
          // Keep durations for success/error notifications
          success: {
            duration: 3000,
            theme: {
              primary: 'green',
              secondary: 'black',
            },
          },
          error: {
            duration: 4000,
            theme: {
              primary: 'red',
              secondary: 'black',
            },
          },
        }}
      />

      {isSelecting && (
        <div className="fixed top-4 right-4 bg-blue-100 text-blue-800 px-4 py-2 rounded">
          Click to end selection
        </div>
      )}

      {/* Questions Modal */}
      {showQuestions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <h2 className="text-xl font-semibold text-gray-800 mr-4">Generated Questions</h2>
                {remainingTime !== null && (
                  <div className={`px-3 py-1 rounded-full font-mono ${
                    remainingTime < 60000 ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-blue-100 text-blue-800'
                  }`}>
                    Time: {formatTime(remainingTime)}
                  </div>
                )}
              </div>
              <button 
                onClick={handleCloseQuestions}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto pr-2">
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg transition-colors ${
                      selectedQuestion === index 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedQuestion(index)}
                  >
                    <div className="flex flex-col space-y-3">
                      <div className="flex items-start">
                        <span className="font-medium text-gray-700 mr-3">{index + 1}.</span>
                        <p className={`${selectedQuestion === index ? 'text-blue-800' : 'text-gray-800'}`}>
                          {question}
                        </p>
                      </div>
                      
                      {selectedQuestion === index && (
                        <div 
                        key={index}
                        onClick={() => {
                          // Instantly switch to new question
                          setSelectedQuestion(index === selectedQuestion ? null : index);
                        }}
                        className="cursor-pointer"
                      >
                        {/* Question content */}
                        {selectedQuestion === index && (
                          <div className="ml-8 mt-2" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              autoFocus
                              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows="4"
                              placeholder="Type your answer here..."
                              value={answers[index] || ''}
                              onChange={(e) => setAnswers(prev => ({
                                ...prev,
                                [index]: e.target.value
                              }))}
                            />
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleCloseQuestions}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmitAnswers(false, quizId)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Submit All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResults && evaluationResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-gray-800">Evaluation Results</h2>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Total Score: {((evaluationResults.totalScore/evaluationResults.evaluations.length)*100).toFixed(2)}%
                </span>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={handleSaveResult}
                  disabled={isSaving}
                  className={`px-4 py-2 ${
                    isSaving 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600'
                  } text-white rounded-lg transition-colors save-result-button`}
                >
                  {isSaving ? 'Saving...' : 'Save Result'}
                </button>
                <button 
                  onClick={handleCloseResults}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto pr-2">
              <div className="space-y-6">
                {evaluationResults.evaluations.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.status === 'correct' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-gray-700">Question {index + 1}</span>
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          result.status === 'correct'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {result.status === 'correct' 
                            ? `Correct (accuracy: ${result.accuracy}%)` 
                            : `Incorrect (accuracy: ${result.accuracy}%)`}
                        </span>
                      </div>
                      
                      
                      <p className="text-gray-700">{result.question}</p>
                      
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500">Your Answer:</p>
                          <p className="text-gray-700">{result.user_answer}</p>
                        </div>
                        
                        
                          <>
                            <div>
                              <p className="text-sm text-gray-500">Correct Answer:</p>
                              <p className="text-gray-700">{result.correct_answer}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Missing Points:</p>
                              <ul className="list-disc list-inside text-gray-700">
                                {result.missing_points.map((point, i) => (
                                  <li key={i}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          </>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseResults}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
         <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-semibold">{title || 'PDF Viewer'}</h1>
          <div className="flex space-x-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Floating Button */}
        {showButton && (
          <button
            className="fixed z-20 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg transform -translate-x-1/2 generate-button"
            style={{
              left: buttonPosition.x,
              top: buttonPosition.y,
            }}
            onClick={handleProcessText}
          >
            Generate
          </button>
        )}

        {/* PDF Viewer Container - add the class for Joyride targeting */}
        <div className="bg-white rounded-lg shadow-sm relative pdf-viewer-container" style={{ height: 'calc(100vh - 150px)' }}>
          {/* Markers */}
          <div className="absolute right-0 top-0 h-full">
            {savedMarkers.map(marker => (
              <MarkerButton
                key={marker.id}
                marker={marker}
                onClick={(marker) => {
                  setEvaluationResults(marker.results);
                  setShowResults(true);
                }}
              />
            ))}
          </div>

          {/* PDF Viewer */}
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <Viewer
              fileUrl={pdfData}
              plugins={[
                defaultLayoutPluginInstance,
                thumbnailPluginInstance,
              ]}
              defaultScale={1}
              theme={{
                theme: 'light',
              }}
              onDocumentLoad={() => {
                // Handle document load
              }}
              renderError={(error) => {
                return (
                  <div className="text-center py-8 text-red-500">
                    Failed to load PDF: {error.message}
                  </div>
                );
              }}
            />
          </Worker>
        </div>
      </div>
      {showBreakNotification && <BreakNotificationModal />}
    </div>
  );
};

export default PdfViewer;