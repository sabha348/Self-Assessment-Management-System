import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container, Box, Paper, Typography, Button, LinearProgress,
  Radio, RadioGroup, FormControlLabel, FormControl, TextField,
  Divider, Card, CardContent, Chip, Alert, CircularProgress // Added CircularProgress
} from '@mui/material';

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

// Simple Results Display component
const ResultsDisplay = ({ results, onFinish }) => (
  <Box>
    <Typography variant="h5" gutterBottom>Assessment Results</Typography>
    <Typography variant="h6" color="primary" gutterBottom>
      Score: {results.score}%
    </Typography>
    <Button variant="contained" onClick={onFinish}>
      Back to Practice
    </Button>
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

  useEffect(() => {
    // Fetch appropriate questions based on level and item
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        
        let endpoint;
        if (level === 'concept') {
          endpoint = `/api/quizzes/questions/concept/${encodeURIComponent(item)}`;
        } else if (level === 'subtopic') {
          endpoint = `/api/quizzes/questions/subtopic/${encodeURIComponent(item)}`;
        } else if (level === 'topic') {
          endpoint = `/api/quizzes/questions/topic/${encodeURIComponent(item)}`;
        } else { // subject
          endpoint = `/api/quizzes/questions/subject/${encodeURIComponent(item)}`;
        }
        
        // Add query params for configuration
        endpoint += `?numQuestions=${config.numQuestions}&difficulty=${config.difficulty}`;
        
        if (config.includeSubtopics) {
          endpoint += '&includeSubItems=true';
        } else if (config.includedItems && config.includedItems.length > 0) {
          // Add selected items as query parameter when not including all
          const itemsParam = config.includedItems.map(encodeURIComponent).join(',');
          endpoint += `&selectedItems=${itemsParam}`;
        }
        
        // Add question types parameter
        if (config.questionTypes && config.questionTypes.length > 0) {
          endpoint += `&questionTypes=${config.questionTypes.join(',')}`;
        }
        
        console.log('Fetching questions from endpoint:', endpoint);
        
        const response = await axios.get(`http://localhost:8000${endpoint}`);
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

  // Add the missing handleSubmit function
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Prepare answers for submission
      const formattedAnswers = {};
      questions.forEach((question, index) => {
        if (answers[index]) {
          formattedAnswers[index] = answers[index];
        }
      });
      
      // Get quiz ID from the first question or use a default
      const quizId = questions[0]?.quizeRef || 'default';
      const userId = localStorage.getItem('userId') || '1'; // Replace with actual user ID retrieval
      
      const response = await axios.post(`http://localhost:8000/api/assessment/${quizId}/submit`, {
        answers: formattedAnswers,
        userId: userId,
        timeTaken: Math.floor(config.timeLimit * 60 - timeRemaining),
      });
      
      setResults({
        score: response.data.totalScore * 100, // Convert to percentage
        evaluations: response.data.evaluations,
        correctAnswers: response.data.evaluations.filter(e => e.status === "correct").length,
        totalQuestions: questions.length
      });
      
      setAssessmentComplete(true);
      
      // Update topic mastery data
      if (level === 'topic') {
        try {
          // Try API first
          await axios.post('http://localhost:8000/api/users/update-mastery', {
            userId: localStorage.getItem('userId') || '1',
            topic: item,
            score: response.data.totalScore * 100
          }).catch(error => {
            console.error("API update failed, using localStorage fallback:", error);
            
            // Fallback to localStorage if API fails
            const storedMastery = JSON.parse(localStorage.getItem('topicMastery') || '{}');
            storedMastery[item] = response.data.totalScore * 100;
            localStorage.setItem('topicMastery', JSON.stringify(storedMastery));
          });
        } catch (error) {
          console.error("Failed to update mastery:", error);
        }
      }
    } catch (error) {
      console.error("Error submitting assessment:", error);
      setError("Failed to submit your assessment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Assessment header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {item} Assessment
        </Typography>
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
          value={((currentQuestionIndex) / questions.length) * 100}
          sx={{ mt: 2, height: 8, borderRadius: 4 }}
        />
      </Box>
      
      {/* Question display */}
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
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Question {currentQuestionIndex + 1}
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              {questions[currentQuestionIndex]?.question}
            </Typography>
            
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
              onClick={handleSubmit}
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