import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, Toaster } from 'react-hot-toast';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { thumbnailPlugin } from '@react-pdf-viewer/thumbnail';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/thumbnail/lib/styles/index.css';

const PdfViewer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { pdfData, title } = location.state || {};
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
  const [sessionId, setSessionId] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [lastReadPosition, setLastReadPosition] = useState(0);
  const [autoSubmissionTimer, setAutoSubmissionTimer] = useState(null);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(Date.now());

  // Constants for text limits
  const TEXT_LIMITS = {
    MIN_CHARS: 100,
    MAX_CHARS: 1000,  // Reduced from 3000 to 1000 for better server handling
    OPTIMAL_CHARS: 500
  };

  // Create the plugins
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const thumbnailPluginInstance = thumbnailPlugin();

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
      // If clicking outside the selection, hide the button
      const selection = window.getSelection();
      if (!selection.toString().trim()) {
        setShowButton(false);
      }
    };

    const handleScroll = () => {
      setShowButton(false);
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
  }, []);

  const handleProcessText = async () => {
    console.log('Selected text:', selectedText); // Add this line to log the selected text
    try {
      const loadingToast = toast.loading('Generating questions...');
      
      const response = await axios.post('http://localhost:8000/api/assessment', {
        text: selectedText,
        numQuestions: 5,
        type: 'General',
        topic: 'Fruit'
      });
      
      setQuestions(response.data.questions);
      setSessionId(response.data.sessionId);
      setShowQuestions(true);
      toast.dismiss(loadingToast);
      
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
        duration: 5000, // Show for 5 seconds
        style: {
          maxWidth: '500px', // Allow longer error messages
          padding: '16px',
          wordBreak: 'break-word'
        }
      });
      
      // Clear selection and button
      window.getSelection().removeAllRanges();
      setShowButton(false);
      setSelectedText('');
    }
  };

  // Function to get text content up to current scroll position
  const getVisibleText = () => {
    const pdfPages = document.querySelectorAll('.react-pdf__Page');
    let visibleText = '';
    const scrollPosition = window.scrollY + window.innerHeight;

    // Debug log
    console.log('Last read position:', lastReadPosition);

    pdfPages.forEach((page) => {
      const rect = page.getBoundingClientRect();
      const pageBottom = rect.top + window.scrollY + rect.height;
      
      if (pageBottom <= scrollPosition) {
        const textLayer = page.querySelector('.react-pdf__Page__textContent');
        if (textLayer) {
          const pageText = textLayer.textContent;
          visibleText += pageText + ' ';
        }
      }
    });

    // Get only new content since last submission
    const newContent = visibleText.slice(lastReadPosition).trim();
    
    // Debug logs
    console.log('New content length:', newContent.length);
    console.log('Content preview:', newContent.slice(0, 100) + '...');

    // If content is too large, take a chunk that makes sense (end at a period)
    if (newContent.length > TEXT_LIMITS.MAX_CHARS) {
      let truncatedContent = newContent.slice(0, TEXT_LIMITS.OPTIMAL_CHARS);
      
      // Find the last period to make a clean cut
      const lastPeriodIndex = truncatedContent.lastIndexOf('.');
      if (lastPeriodIndex > TEXT_LIMITS.MIN_CHARS) {
        truncatedContent = truncatedContent.slice(0, lastPeriodIndex + 1);
      }

      console.log('Truncated content length:', truncatedContent.length);
      return truncatedContent;
    }
    
    return newContent;
  };

  // Modified auto-submission handler
  const handleAutoSubmission = async () => {
    const currentTime = Date.now();
    const timeSinceLastSubmission = currentTime - lastSubmissionTime;
    const FIVE_MINUTES = 0.5 * 60 * 1000;

    if (timeSinceLastSubmission < FIVE_MINUTES) {
      return;
    }

    const newText = getVisibleText();
    
    if (newText && 
        newText.length >= TEXT_LIMITS.MIN_CHARS && 
        newText.length <= TEXT_LIMITS.MAX_CHARS) {
      try {
        console.log('Submitting text of length:', newText.length);
        
        // Show loading toast for auto-submission
        const loadingToast = toast.loading('Auto-generating questions from your reading...');
        
        setLastSubmissionTime(currentTime);
        
        const response = await axios.post('http://localhost:8000/api/assessment', {
          text: newText,
          numQuestions: 5,
          type: 'General',
          topic: 'Fruit'
        });
        
        // Dismiss loading toast on success
        toast.dismiss(loadingToast);
        toast.success('Questions generated from your reading!');
        
        setLastReadPosition(lastReadPosition + newText.length);
        setQuestions(response.data.questions);
        setSessionId(response.data.sessionId);
        setShowQuestions(true);
        setIsTimerPaused(true);
        
        if (autoSubmissionTimer) {
          clearInterval(autoSubmissionTimer);
          setAutoSubmissionTimer(null);
        }

      } catch (error) {
        console.error('Error in auto-submission:', error);
        toast.error('Failed to generate questions from your reading. Will try again later.');
        
        // Reset timer and continue reading
        setIsTimerPaused(false);
        setLastSubmissionTime(currentTime - FIVE_MINUTES);
        
        if (autoSubmissionTimer) {
          clearInterval(autoSubmissionTimer);
        }
        const timer = setInterval(handleAutoSubmission, 60 * 1000);
        setAutoSubmissionTimer(timer);
      }
    } else {
      console.log('Text not within limits:', {
        length: newText.length,
        minRequired: TEXT_LIMITS.MIN_CHARS,
        maxAllowed: TEXT_LIMITS.MAX_CHARS
      });
    }
  };

  // Setup auto-submission timer with pause functionality
  useEffect(() => {
    if (!isTimerPaused) {
      // Clear any existing timer
      if (autoSubmissionTimer) {
        clearInterval(autoSubmissionTimer);
      }
      
      // Set new timer
      const timer = setInterval(handleAutoSubmission, 60 * 1000); // Check every minute
      setAutoSubmissionTimer(timer);

      return () => {
        if (timer) {
          clearInterval(timer);
        }
      };
    }
  }, [isTimerPaused, lastReadPosition]);

  // Modified scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (!isTimerPaused) {
        // Don't reset timer on every scroll, just ensure one exists
        if (!autoSubmissionTimer) {
          const timer = setInterval(handleAutoSubmission, 60 * 1000);
          setAutoSubmissionTimer(timer);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isTimerPaused, autoSubmissionTimer]);

  // Resume timer when questions are closed
  const handleCloseQuestions = () => {
    setShowQuestions(false);
    setIsTimerPaused(false);  // Resume timer
  };

  // Modified submit handler
  const handleSubmitAnswers = async () => {
    const toastId = toast.loading("Submitting answers...");
    try {
      const response = await axios.post(`http://localhost:8000/api/assessment/${sessionId}/submit`, {
        answers: answers
      });
      toast.dismiss(toastId);
      setEvaluationResults(response.data);
      setShowQuestions(false);
      setShowResults(true);
      // Don't resume timer yet - wait until results are closed
    } catch (error) {
      toast.dismiss(toastId);
      console.error('Error submitting answers:', error);
      alert('Failed to submit answers. Please try again.');
    }
  };

  // Resume timer when results are closed
  const handleCloseResults = () => {
    setShowResults(false);
    setEvaluationResults(null);
    setAnswers({});
    setSelectedQuestion(null);
    setIsTimerPaused(false);  // Resume timer
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Add Toaster component */}
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
              <h2 className="text-xl font-semibold text-gray-800">Generated Questions</h2>
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
                onClick={handleSubmitAnswers}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                disabled={!Object.keys(answers).length}
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
                  Total Score: {((evaluationResults.totalScore/5)*100).toFixed(2)}%
                </span>
              </div>
              <button 
                onClick={handleCloseResults}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                          {result.status === 'correct' ? 'Correct' : 'Incorrect'} ({result.accuracy}%)
                        </span>
                      </div>
                      
                      {result.status === 'wrong' && (
                        <p className="text-gray-700">{result.question}</p>
                      )}
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500">Your Answer:</p>
                          <p className="text-gray-700">{result.user_answer}</p>
                        </div>
                        
                        {result.status === 'wrong' && (
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
                        )}
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
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-semibold">{title || 'PDF Viewer'}</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Floating Button */}
        {showButton && (
          <button
            className="fixed z-20 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg transform -translate-x-1/2"
            style={{
              left: buttonPosition.x,
              top: buttonPosition.y,
            }}
            onClick={handleProcessText}
          >
            Generate
          </button>
        )}

        {/* PDF Viewer */}
        <div className="bg-white rounded-lg shadow-sm" style={{ height: 'calc(100vh - 150px)' }}>
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
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
    </div>
  );
};

export default PdfViewer;