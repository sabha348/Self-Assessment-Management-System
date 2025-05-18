import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import {
  Container, Box, Paper, Typography, Button, LinearProgress,
  Radio, RadioGroup, FormControlLabel, FormControl, TextField,
  Divider, Card, CardContent, Chip, Alert, CircularProgress, IconButton // Added CircularProgress
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
// Temporary Timer component until you create one
const Timer = ({ initialTime, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  
  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <Typography variant="h6" color="primary">
      Time: {formatTime(timeLeft)}
    </Typography>
  );
};

// Replace the simple ResultsDisplay component with this enhanced version
const ResultsDisplay = ({ results, onFinish }) => (
  <Box>
    {/* <Typography variant="h5" gutterBottom>Assessment Results</Typography> */}
    
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" color="primary">
          Score: {results.score.toFixed(1)}%
        </Typography>
        <Box>
          <Chip 
            label={`${results.correctAnswers} of ${results.totalQuestions} correct`} 
            color={results.score >= 70 ? "success" : results.score >= 50 ? "warning" : "error"}
            sx={{ mr: 1 }}
          />
          {results.unansweredCount > 0 && (
            <Chip 
              label={`${results.unansweredCount} unanswered`} 
              color="default"
              variant="outlined"
            />
          )}
        </Box>
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      <Typography variant="h6" gutterBottom>Question Review:</Typography>
      {results.evaluations.map((evaluation, index) => (
        <Paper 
          key={index}
          sx={{ 
            p: 2, 
            mb: 2, 
            borderLeft: '4px solid',
            borderColor: evaluation.status === 'correct' ? 'success.main' : 
                          evaluation.status === 'unanswered' ? 'grey.500' : 'error.main'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" gutterBottom>{`Question ${index + 1}`}</Typography>
            {evaluation.status === 'unanswered' && (
              <Chip 
                label="Not Answered" 
                size="small"
                color="default"
                sx={{ mb: 1 }}
              />
            )}
          </Box>
          
          <Typography variant="body2" gutterBottom>{evaluation.question}</Typography>
          
          <Box sx={{ mt: 1 }}>
            {evaluation.status === 'unanswered' ? (
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                You did not provide an answer for this question.
              </Typography>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary">Your answer:</Typography>
                <Typography variant="body2">{evaluation.user_answer || "<No answer provided>"}</Typography>
              </>
            )}
            
            {evaluation.status !== 'correct' && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Correct answer:
                </Typography>
                <Typography variant="body2" color="success.main">
                  {evaluation.correct_answer}
                </Typography>
                
                {evaluation.missing_points && evaluation.missing_points.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {evaluation.status === 'unanswered' ? 'Key points:' : 'You missed:'}
                    </Typography>
                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                      {evaluation.missing_points.map((point, i) => (
                        <li key={i}><Typography variant="body2">{point}</Typography></li>
                      ))}
                    </ul>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Paper>
      ))}
    </Paper>
    
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Button variant="outlined" onClick={onFinish}>
        Back to Practice
      </Button>
      <Button variant="contained" color="primary" onClick={() => window.print()}>
        Print Results
      </Button>
    </Box>
  </Box>
);

const Assessment = () => {
  // State variables
  const location = useLocation();
  const navigate = useNavigate();
  const { level, item, config } = location.state || {};
  
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(config?.timeLimit * 60 || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const [results, setResults] = useState(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState({});

  useEffect(() => {
    // Fetch appropriate questions based on level and item
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        
        let endpoint;
        if (level === 'concept') {
          endpoint = `/assessment/questions/concept/${encodeURIComponent(item)}`;
        } else if (level === 'subtopic') {
          endpoint = `/assessment/questions/subtopic/${encodeURIComponent(item)}`;
        } else if (level === 'topic') {
          endpoint = `/assessment/questions/topic/${encodeURIComponent(item)}`;
        } else { // subject
          endpoint = `/assessment/questions/subject/${encodeURIComponent(item)}`;
        }
        
        // Add query params for configuration
        endpoint += `?numQuestions=${config.numQuestions}&difficulty=${config.difficulty}`;
        
        if (config.includeSubtopics) {
          endpoint += '&includeSubItems=true';
        } else if (config.selectedItems && config.selectedItems.length > 0) {
          // Add selected items as query parameter when not including all
          const itemsParam = config.selectedItems.map(encodeURIComponent).join(',');
          endpoint += `&selectedItems=${itemsParam}`;
        }
        
        // Add question types parameter
        if (config.questionTypes && config.questionTypes.length > 0) {
          endpoint += `&questionTypes=${config.questionTypes.join(',')}`;
        }
        
        // Add parameter to consider assessment history
        endpoint += `&considerHistory=${config.considerHistory !== false ? 'true' : 'false'}`;
        
        console.log('Fetching questions from endpoint:', endpoint);

        const response = await axios.get(`${API_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        // The response structure might be different depending on the endpoint
        // Make sure we handle all possible structures
        if (response.data.questions && Array.isArray(response.data.questions)) {
          setQuestions(response.data.questions);
        } else {
          setQuestions([]);
          setError("No questions available for this assessment");
        }
      } catch (err) {
        setError(`Failed to load questions: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestions();
  }, [level, item, config]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Prepare answers for submission - include ALL questions
      const formattedAnswers = {};
      const questionIdsMap = {};
      
      questions.forEach((question, index) => {
        // Include all questions in submission, with explicit "unanswered" marker for empty ones
        formattedAnswers[index] = answers[index] || "__UNANSWERED__";
        questionIdsMap[index] = question.questionId; // Add the questionId mapping
      });
      
      // Get token for authentication
      const token = localStorage.getItem('token');
      let headers = {};
      let userId = '1'; // Default fallback
  
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        
        // Extract userId from JWT token
        try {
          const decodedToken = jwtDecode(token);
          userId = decodedToken?.userId || '1';
          console.log("Using userId from token:", userId);
        } catch (error) {
          console.error("Error decoding token:", error);
        }
      }
      
      const response = await axios.post(`${API_URL}/assessment/submit`, {
        answers: formattedAnswers,
        questionIds: questionIdsMap, // Include the question IDs mapping
        userId: userId, 
        timeTaken: Math.floor(config.timeLimit * 60 - timeRemaining),
        includeUnanswered: true 
      }, { headers });
      
      // Process response...
      setResults({
        score: (response.data.totalScore / questions.length) * 100,
        evaluations: response.data.evaluations,
        correctAnswers: response.data.evaluations.filter(e => e.status === "correct").length,
        totalQuestions: questions.length,
        unansweredCount: Object.values(formattedAnswers).filter(a => a === "__UNANSWERED__").length
      });
      
      setAssessmentComplete(true);
      
    // Create questioninfo for the simplified model
    const questioninfo = response.data.evaluations.map(evaluation => ({
      questionId: evaluation.questionId,
      status: evaluation.status === "wrong" ? "incorrect" : 
              evaluation.status === "unanswered" ? "unanswered" : evaluation.status,
      attempts: 1 // Default to 1 attempt for new assessments
    }));
    
    // Store assessment results in the simplified model
    try {
      await axios.post(`${API_URL}/analytics/save-assessment-result`, {
        userId: userId,
        level: level,
        itemName: item,
        score: (response.data.totalScore / questions.length) * 100,
        totalQuestions: questions.length,
        timeTaken: Math.floor(config.timeLimit * 60 - timeRemaining),
        date: new Date().toISOString(),
        questioninfo: questioninfo
      }, { headers });
    } catch (error) {
      console.error("Failed to save assessment results:", error);
    }
  } catch (error) {
    console.error("Error submitting assessment:", error);
    setError("Failed to submit your assessment. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
};

  // Modify the submit button to use this function
  const confirmSubmit = () => {
    // Check if all questions have been answered
    const answeredCount = Object.keys(answers).length;
    const unansweredCount = questions.length - answeredCount;
    
    if (unansweredCount > 0) {
      const confirmSubmission = window.confirm(
        `You have ${unansweredCount} unanswered questions. Are you sure you want to submit?`
      );
      if (!confirmSubmission) return;
    } else {
      const confirmSubmission = window.confirm(
        "Are you sure you want to submit your assessment?"
      );
      if (!confirmSubmission) return;
    }
    
    handleSubmit();
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Assessment header - conditionally render parts based on assessment status */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {assessmentComplete ? `${item} Assessment Results` : `${item} Assessment`}
        </Typography>
        
        {/* Only show progress tracking elements when assessment is in progress */}
        {!assessmentComplete && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Chip
                label={`${currentQuestionIndex + 1} of ${questions.length} questions`}
                color="primary"
                variant="outlined"
              />
              {config.timeLimit > 0 && (
                <Timer 
                  initialTime={config.timeLimit * 60} 
                  onTimeUp={handleSubmit}
                />
              )}
            </Box>
            
            <LinearProgress 
              variant="determinate" 
              value={((currentQuestionIndex + 1) / questions.length) * 100}
              sx={{ mt: 2, height: 8, borderRadius: 4 }}
            />
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
              {questions.map((_, idx) => (
                <Chip
                  key={idx}
                  label={idx + 1}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  color={currentQuestionIndex === idx ? "primary" : 
                         answers[idx] ? "success" : 
                         flaggedQuestions[idx] ? "warning" : "default"}
                  variant={currentQuestionIndex === idx ? "filled" : "outlined"}
                  sx={{ 
                    minWidth: '36px', 
                    cursor: 'pointer',
                    position: 'relative',
                    '&::after': !answers[idx] && {
                      content: '""',
                      position: 'absolute',
                      top: '3px',
                      right: '3px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: flaggedQuestions[idx] ? 'warning.main' : 'error.light',
                      opacity: 0.8
                    }
                  }}
                />
              ))}
            </Box>
          </>
        )}
      </Box>
      
      {/* Question display or results display */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading your assessment...</Typography>
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>
      ) : questions.length === 0 ? (
        <Alert severity="warning">
          No questions available for this assessment. Try selecting a different topic or configuration.
        </Alert>
      ) : assessmentComplete ? (
        <ResultsDisplay results={results} onFinish={() => navigate('/practice')} />
      ) : (
        <Card sx={{ mb: 4, boxShadow: 3, borderRadius: 2 }}>
          <CardContent sx={{ p: 4, position: 'relative' }}>
            <Typography variant="h6" gutterBottom>
              Question {currentQuestionIndex + 1}
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              {questions[currentQuestionIndex]?.question}
            </Typography>
            
            <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
              <IconButton 
                color={flaggedQuestions[currentQuestionIndex] ? "error" : "default"}
                onClick={() => setFlaggedQuestions(prev => ({
                  ...prev,
                  [currentQuestionIndex]: !prev[currentQuestionIndex]
                }))}
              >
                <FlagIcon />
              </IconButton>
            </Box>
            
            {/* Answer section - based on question type */}
            {(questions[currentQuestionIndex]?.type === 'multiple-choice' || 
              questions[currentQuestionIndex]?.type === 'true-false' ||
              (questions[currentQuestionIndex]?.options && questions[currentQuestionIndex].options.length > 0)) ? (
              <FormControl component="fieldset" fullWidth>
                <RadioGroup
                  value={answers[currentQuestionIndex] || ''}
                  onChange={(e) => {
                    setAnswers({
                      ...answers,
                      [currentQuestionIndex]: e.target.value
                    });
                  }}
                >
                  {questions[currentQuestionIndex].options && questions[currentQuestionIndex].options.map((option, idx) => (
                    <FormControlLabel 
                      key={idx}
                      value={option}
                      control={<Radio />}
                      label={option}
                      sx={{ mb: 1 }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            ) : (
              <TextField
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                placeholder="Type your answer here..."
                value={answers[currentQuestionIndex] || ''}
                onChange={(e) => {
                  setAnswers({
                    ...answers,
                    [currentQuestionIndex]: e.target.value
                  });
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Navigation buttons */}
      {!loading && !assessmentComplete && questions.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            variant="outlined"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
          >
            Previous
          </Button>
          
          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              variant="contained"
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={confirmSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
            </Button>
          )}
        </Box>
      )}
    </Container>
  );
};

export default Assessment;