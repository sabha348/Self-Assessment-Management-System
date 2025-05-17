import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Divider,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Chip,
} from "@mui/material";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import axios from "axios";
import InfoIcon from "@mui/icons-material/Info";
import Joyride from "react-joyride";


const SkillAnalysis = () => {
  const navigate = useNavigate(); 
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

  // Hierarchy navigation state
  const [currentLevel, setCurrentLevel] = useState("subject");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);

  // Data state
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [concepts, setConcepts] = useState([]);

  // Analytics state
  const [knowledgeGaps, setKnowledgeGaps] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const PROFICIENCY_LEVELS = {
    MASTERED: { color: "#4CAF50", label: "Mastered", range: [80, 100] },
    PROFICIENT: { color: "#8BC34A", label: "Proficient", range: [70, 79] },
    DEVELOPING: { color: "#FFC107", label: "Developing", range: [55, 69] },
    BASIC: { color: "#FF9800", label: "Basic", range: [40, 54] },
    NEEDS_WORK: { color: "#F44336", label: "Needs Work", range: [0, 39] },
  };

  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [assessmentHierarchy, setAssessmentHierarchy] = useState(null);
  const [selectedScoreType, setSelectedScoreType] = useState("current");
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [hasClickedScore, setHasClickedScore] = useState(false);

  const [historicalLoading, setHistoricalLoading] = useState(false);
   //  Joyride tour state
  const [runTour, setRunTour] = useState(false);
  const [steps] = useState([
    {
      target: '.performance-summary',
      content: 'This section shows your overall performance statistics. The Average Score shows how well you\'ve done across all assessed subjects. Mastered (80%+) shows concepts you\'ve demonstrated strong knowledge in, Developing (60-79%) shows concepts you\'re making good progress with, and Needs Work (below 40%) highlights areas requiring more attention.',
      title: 'Performance Summary',
      disableBeacon: true,
      placement: 'bottom'
    },
    {
      target: '.knowledge-gap-analysis',
      content: 'This section displays all assessed items with their performance scores. Items can be assessed directly through dedicated tests or indirectly when questions related to them appear in other assessments. Click on any score to see detailed performance information.',
      title: 'Knowledge Gap Analysis',
      placement: 'left'
    },
    {
      target: '.assessment-details',
      content: 'When you click on a score, this panel shows detailed information about that assessment. For direct assessments, you\'ll see the date, score, and content breakdown. For derived scores (calculated from questions in other tests), you\'ll see which assessments contributed to this score.',
      title: 'Assessment Details',
      placement: 'right'
    },
    {
      target: '.progress-trends',
      content: 'This chart shows your performance trends over time, displaying scores from your latest 30 assessments for the current category level. Use this to track your improvement in specific subjects, topics, subtopics, or concepts.',
      title: 'Progress Trends',
      placement: 'top'
    },
    {
    target: '.explore-new-section',
    content: 'This section shows items that haven\'t been assessed yet in the current category level. These items haven\'t been tested either directly through dedicated assessments or indirectly through related questions. Click on any item to explore it further, or use the "Start Assessment" button to immediately begin testing your knowledge in that area.',
    title: 'Explore New Content',
    placement: 'bottom'
  }
  ]);

  // Check if user has seen this tour before
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenSkillAnalysisTour');
    if (!hasSeenTour) {
      // Short delay to ensure components are rendered
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Joyride callback handler
  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if (status === 'finished' || status === 'skipped') {
      setRunTour(false);
      // Save that user has seen the tour
      localStorage.setItem('hasSeenSkillAnalysisTour', 'true');
    }
  };

  // Handle score click function
  const handleScoreClick = async (item, scoreType) => {
    setSelectedScoreType(scoreType);
    setHasClickedScore(true); // Set this to true when a score is clicked
    setAssessmentLoading(true); // Only set loading for assessment section

    try {
      const token = localStorage.getItem("token");
      const decodedToken = token ? jwtDecode(token) : null;
      const userId = decodedToken?.userId || "1";

      // Special handling for derived scores
      if (item.isDerived && scoreType === "current") {
        console.log("Fetching derived score details for:", item.name);

        // Make a new API request to get derived score details
        const response = await axios.get(
          `${API_URL}/analytics/derived-score-details`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              userId,
              level: currentLevel,
              itemName: item.name,
            },
          }
        );

        if (response.data) {
          setSelectedAssessment({
            ...item,
            isDerived: true,
            derivedDetails: response.data,
            date: new Date().toISOString(),
            level: currentLevel, // Current level since this is a derived score
          });

          // Organize assessed questions by source assessment
          const hierarchy = {};

          if (response.data.sourceAssessments) {
            response.data.sourceAssessments.forEach((source) => {
              const sourceQuestions = response.data.assessedQuestions.filter(
                (q) => q.assessmentId === source.assessmentId
              );

              if (sourceQuestions.length > 0) {
                hierarchy[source.itemName] = {
                  subtopics: {},
                  date: source.date,
                  level: source.level,
                };

                // Group questions by subtopic and concept
                sourceQuestions.forEach((q) => {
                  // Group by subtopic
                  const subtopicName = q.subtopic || "Other";
                  if (!hierarchy[source.itemName].subtopics[subtopicName]) {
                    hierarchy[source.itemName].subtopics[subtopicName] = {
                      concepts: {},
                    };
                  }

                  // Group by concept
                  const conceptName = q.concept || "General";
                  if (
                    !hierarchy[source.itemName].subtopics[subtopicName]
                      .concepts[conceptName]
                  ) {
                    hierarchy[source.itemName].subtopics[subtopicName].concepts[
                      conceptName
                    ] = {
                      questions: [],
                    };
                  }

                  // Add question
                  hierarchy[source.itemName].subtopics[subtopicName].concepts[
                    conceptName
                  ].questions.push({
                    questionId: q.questionId,
                    status: q.status,
                    assessmentDate: q.assessmentDate,
                  });
                });
              }
            });
          }

          setAssessmentHierarchy(hierarchy);
        }
      } else if (scoreType === "current") {
        // Get the latest assessment result for this item
        const itemName = item.name;
        const level = currentLevel;

        const response = await axios.get(
          `${API_URL}/analytics/results/latest`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              userId,
              level,
              itemName,
            },
          }
        );

        if (response.data) {
          const assessmentResult = response.data;
          // Store the level for use in UI rendering
          setSelectedAssessment({
            ...assessmentResult,
            level: currentLevel, // Store which level this was clicked at
          });

          if (
            assessmentResult.questioninfo &&
            assessmentResult.questioninfo.length > 0
          ) {
            const questionIds = assessmentResult.questioninfo.map(
              (q) => q.questionId
            );

            // Fetch question details
            const questionsResponse = await axios.get(
              `${API_URL}/analytics/details`,
              {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                  questionIds: questionIds.join(","),
                },
              }
            );

            if (questionsResponse.data) {
              // Process questions to build hierarchy
              const questions = questionsResponse.data;
              const hierarchy = {};

              questions.forEach((question) => {
                const questionInfo = assessmentResult.questioninfo.find(
                  (q) => q.questionId === question.questionId
                );
                const status = questionInfo ? questionInfo.status : "unknown";

                // Build different hierarchy based on current level
                switch (currentLevel) {
                  case "subject":
                    // Subject → Topic → Subtopic → Concept hierarchy
                    const subjectName = question.subject || "Uncategorized";
                    if (!hierarchy[subjectName]) {
                      hierarchy[subjectName] = { subtopics: {} };
                    }

                    const topicName = question.topic || "General";
                    if (!hierarchy[subjectName].subtopics[topicName]) {
                      hierarchy[subjectName].subtopics[topicName] = {
                        concepts: {},
                      };
                    }

                    const subtopicName = question.subtopic || "General";
                    if (
                      !hierarchy[subjectName].subtopics[topicName].concepts[
                        subtopicName
                      ]
                    ) {
                      hierarchy[subjectName].subtopics[topicName].concepts[
                        subtopicName
                      ] = { questions: [] };
                    }

                    // Add question to the hierarchy
                    hierarchy[subjectName].subtopics[topicName].concepts[
                      subtopicName
                    ].questions.push({
                      ...question,
                      status,
                    });
                    break;

                  case "topic":
                    // Topic → Subtopic → Concept hierarchy
                    const topicKey = question.topic || "Uncategorized";
                    if (!hierarchy[topicKey]) {
                      hierarchy[topicKey] = { subtopics: {} };
                    }

                    const subtopicKey = question.subtopic || "General";
                    if (!hierarchy[topicKey].subtopics[subtopicKey]) {
                      hierarchy[topicKey].subtopics[subtopicKey] = {
                        concepts: {},
                      };
                    }

                    const conceptName = question.concept || "General";
                    if (
                      !hierarchy[topicKey].subtopics[subtopicKey].concepts[
                        conceptName
                      ]
                    ) {
                      hierarchy[topicKey].subtopics[subtopicKey].concepts[
                        conceptName
                      ] = { questions: [] };
                    }

                    hierarchy[topicKey].subtopics[subtopicKey].concepts[
                      conceptName
                    ].questions.push({
                      ...question,
                      status,
                    });
                    break;

                  case "subtopic":
                    // Subtopic → Concept hierarchy
                    const subtopicOnly = question.subtopic || "Uncategorized";
                    if (!hierarchy[subtopicOnly]) {
                      hierarchy[subtopicOnly] = { subtopics: {} };
                    }

                    const conceptOnly = question.concept || "General";
                    if (!hierarchy[subtopicOnly].subtopics[conceptOnly]) {
                      hierarchy[subtopicOnly].subtopics[conceptOnly] = {
                        concepts: {},
                      };
                    }

                    // For subtopic level, we simplify by using a fixed "Questions" key
                    if (
                      !hierarchy[subtopicOnly].subtopics[conceptOnly].concepts[
                        "Questions"
                      ]
                    ) {
                      hierarchy[subtopicOnly].subtopics[conceptOnly].concepts[
                        "Questions"
                      ] = { questions: [] };
                    }

                    hierarchy[subtopicOnly].subtopics[conceptOnly].concepts[
                      "Questions"
                    ].questions.push({
                      ...question,
                      status,
                    });
                    break;

                  case "concept":
                    // Concept only hierarchy
                    const conceptLevel = question.concept || "Uncategorized";
                    if (!hierarchy[conceptLevel]) {
                      hierarchy[conceptLevel] = { subtopics: {} };
                    }

                    // For concept level, we use a fixed structure with "Details"
                    if (!hierarchy[conceptLevel].subtopics["Details"]) {
                      hierarchy[conceptLevel].subtopics["Details"] = {
                        concepts: {},
                      };
                    }

                    if (
                      !hierarchy[conceptLevel].subtopics["Details"].concepts[
                        "Questions"
                      ]
                    ) {
                      hierarchy[conceptLevel].subtopics["Details"].concepts[
                        "Questions"
                      ] = { questions: [] };
                    }

                    hierarchy[conceptLevel].subtopics["Details"].concepts[
                      "Questions"
                    ].questions.push({
                      ...question,
                      status,
                    });
                    break;
                }
              });

              setAssessmentHierarchy(hierarchy);
            }
          }
        }
      } else if (scoreType === "local") {
        // For future implementation
        setSelectedAssessment({
          message: "Local score analysis will be implemented in the future.",
        });
        setAssessmentHierarchy(null);
      } else if (scoreType === "global") {
        // For future implementation
        setSelectedAssessment({
          message: "Global score analysis will be implemented in the future.",
        });
        setAssessmentHierarchy(null);
      }
    } catch (error) {
      console.error("Error fetching assessment details:", error);
      setSelectedAssessment(null);
      setAssessmentHierarchy(null);
    } finally {
      setAssessmentLoading(false); // Only reset loading for assessment section
    }
  };

  const DerivedScoreDetails = ({ assessment }) => {
  if (!assessment?.derivedDetails) return null;

  const { derivedDetails } = assessment;
  const { 
    assessedCount, 
    correctCount, 
    totalCount, 
    sourceAssessments,
    latestAssessmentStats 
  } = derivedDetails;
  
  // Define variables needed for the text display
  const itemName = assessment.name; // Get item name from the assessment object
  
  // Find the latest assessment source
  const latestSource = latestAssessmentStats ? 
    sourceAssessments.find(source => source.assessmentId === latestAssessmentStats.assessmentId) : null;
    
  // Get questions for this latest assessment
  const sourceQuestions = latestSource ? 
    derivedDetails.assessedQuestions.filter(q => q.assessmentId === latestSource.assessmentId) : [];
  
  const assessedPercent = Math.round((assessedCount / totalCount) * 100);
  
  // Calculate score from latest assessment if available, otherwise fall back to overall score
  const displayScore = latestAssessmentStats 
    ? Math.floor((latestAssessmentStats.correctQuestions / latestAssessmentStats.totalQuestions) * 100)
    : Math.floor(assessment.score);

  return (
    <Box>
      {/* Title banner with derived score explanation */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 1,
          bgcolor: "info.light",
          color: "info.contrastText",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: 1,
        }}
      >
        <InfoIcon sx={{ mr: 1 }} />
        <Typography variant="body1" sx={{ fontWeight: "medium" }}>
          This is a derived score calculated from questions assessed in other tests
        </Typography>
      </Box>

      {/* Score summary and statistics */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 1,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
                <Typography variant="body2" paragraph>
          {latestAssessmentStats ? (
            <>
              This score is from your most recent assessment on {new Date(latestAssessmentStats.date).toLocaleDateString()}.
      Out of {latestAssessmentStats.totalQuestions} questions in the assessment, {sourceQuestions.length} belonged to {itemName} and you answered {sourceQuestions.filter(q => q.status === 'correct').length} out of {sourceQuestions.length} questions correctly.
   </>
          ) : (
            <>
              This score is calculated from questions you've answered in other
              assessments. You've answered {assessedCount} out of {totalCount}{" "}
              possible questions ({assessedPercent}%). Of those, you answered{" "}
              {correctCount} correctly, giving a score of {Math.floor(assessment.score)}%.
            </>
          )}
        </Typography>
      </Box>

      {/* Source assessments section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Source Assessment
        </Typography>

        {latestAssessmentStats ? (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Assessment</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell align="center">Date</TableCell>
                  <TableCell align="center">Score</TableCell>
                  <TableCell align="center">Questions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  // Find the latest assessment
                  const latestSource = sourceAssessments.find(
                    source => source.assessmentId === latestAssessmentStats.assessmentId
                  );
                  
                  if (!latestSource) return null;
                  
                  const sourceQuestions = derivedDetails.assessedQuestions.filter(
                    q => q.assessmentId === latestSource.assessmentId
                  );
                  
                  return (
                    <TableRow 
                      hover
                      sx={{ 
                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                        fontWeight: 'bold'
                      }}
                    >
                      <TableCell>
                        {latestSource.itemName}
                        <Chip
                          label="Latest"
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={latestSource.level}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {new Date(latestSource.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center">
                        {Math.floor(latestSource.score)}%
                      </TableCell>
                      <TableCell align="center">
                        {sourceQuestions.length}
                      </TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No source assessment found
          </Typography>
        )}
      </Box>

      {/* Content Breakdown Section - More compact version */}
{latestAssessmentStats && (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
      Content Breakdown
      {assessment.level && (
        <Typography variant="caption" sx={{ ml: 1 }}>
          ({assessment.level} level)
        </Typography>
      )}
    </Typography>

    {(() => {
      // Find the latest assessment for content breakdown
      const latestSource = sourceAssessments.find(
        source => source.assessmentId === latestAssessmentStats.assessmentId
      );
      
      if (!latestSource) return (
        <Typography variant="body2" color="text.secondary">
          No content breakdown available for this assessment
        </Typography>
      );
      
      // Filter questions related to this assessment
      const sourceQuestions = derivedDetails.assessedQuestions.filter(
        q => q.assessmentId === latestSource.assessmentId
      );
      
      // Group questions by hierarchy level for more efficient display
      const groupedQuestions = {};
      
      // Determine which field to group by based on current level
      let primaryField, secondaryField;
      switch (assessment.level) {
        case "subject":
          primaryField = "topic";
          secondaryField = "subtopic";
          break;
        case "topic":
          primaryField = "subtopic";
          secondaryField = "concept";
          break;
        case "subtopic":
          primaryField = "concept";
          secondaryField = null;
          break;
        case "concept":
          primaryField = null;
          secondaryField = null;
          break;
      }
      
      // Group questions by primary field
      sourceQuestions.forEach(q => {
        const key = primaryField ? (q[primaryField] || "General") : "Details";
        if (!groupedQuestions[key]) {
          groupedQuestions[key] = {
            questions: [],
            correct: 0,
            total: 0,
            subgroups: {}
          };
        }
        
        groupedQuestions[key].questions.push(q);
        groupedQuestions[key].total++;
        if (q.status === 'correct') groupedQuestions[key].correct++;
        
        // Further group by secondary field if applicable
        if (secondaryField) {
          const subKey = q[secondaryField] || "General";
          if (!groupedQuestions[key].subgroups[subKey]) {
            groupedQuestions[key].subgroups[subKey] = {
              questions: [],
              correct: 0,
              total: 0
            };
          }
          
          groupedQuestions[key].subgroups[subKey].questions.push(q);
          groupedQuestions[key].subgroups[subKey].total++;
          if (q.status === 'correct') groupedQuestions[key].subgroups[subKey].correct++;
        }
      });
      
      return (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{primaryField ? primaryField.charAt(0).toUpperCase() + primaryField.slice(1) : "Details"}</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="center">Questions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.keys(groupedQuestions).map(key => {
                const group = groupedQuestions[key];
                const score = group.total > 0 ? Math.floor((group.correct / group.total) * 100) : 0;
                const proficiencyColor = score >= 80 ? '#4CAF50' : score >= 60 ? '#FFC107' : '#F44336';
                
                return (
                  <React.Fragment key={key}>
                    <TableRow
                      sx={{ 
                        '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }}
                    >
                      <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                        {key}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: proficiencyColor,
                              mr: 1
                            }}
                          />
                          {score}%
                        </Box>
                      </TableCell>
                      <TableCell align="center">{group.correct}/{group.total}</TableCell>
                    </TableRow>
                    
                    {/* Show subgroups if they exist */}
                    {secondaryField && Object.keys(group.subgroups).map(subKey => {
                      const subgroup = group.subgroups[subKey];
                      const subScore = subgroup.total > 0 ? Math.floor((subgroup.correct / subgroup.total) * 100) : 0;
                      
                      return (
                        <TableRow key={`${key}-${subKey}`}>
                          <TableCell sx={{ pl: 4 }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {subKey}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{subScore}%</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{subgroup.correct}/{subgroup.total}</Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      );
    })()}
  </Box>
)}
    </Box>
  );
};
  // Get proficiency level based on score
  const getProficiencyLevel = (score) => {
    for (const [key, level] of Object.entries(PROFICIENCY_LEVELS)) {
      if (score >= level.range[0] && score <= level.range[1]) {
        return { key, ...level };
      }
    }
    return {
      key: "UNKNOWN",
      color: "#9E9E9E",
      label: "Unknown",
      range: [0, 0],
    };
  };

  const [userId, setUserId] = useState(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const decodedToken = token ? jwtDecode(token) : null;
        const userId = decodedToken?.userId;
        setUserId(userId);
      } else {
        // No token found, use default
        setUserId("1");
        console.warn("No authentication token found, using default userID");
      }
    } catch (error) {
      console.error("Error decoding token:", error);
      setUserId("1"); // Fallback
    }
  }, []);

  // Initial data load useEffect
  useEffect(() => {
    if (userId) {
      fetchContentData();
    }
  }, [userId, currentLevel, selectedSubject, selectedTopic, selectedSubtopic]);

  const fetchContentData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const decodedToken = token ? jwtDecode(token) : null;
      const userId = decodedToken?.userId || "1";

      // parent item to the query parameters based on current level
      const params = { userId };
      if (currentLevel === "topic" && selectedSubject) {
        params.parent = selectedSubject;
      } else if (currentLevel === "subtopic" && selectedTopic) {
        params.parent = selectedTopic;
      } else if (currentLevel === "concept" && selectedSubtopic) {
        params.parent = selectedSubtopic;
      }

      console.log("fetchContentData running with:", {
        currentLevel,
        selectedSubject,
        selectedTopic,
        selectedSubtopic,
        params,
      });

      console.log(
        `Fetching content analysis for ${currentLevel} level with userId: ${userId}, parent: ${
          params.parent || "none"
        }`
      );

      const response = await axios.get(
        `${API_URL}/analytics/content-analysis/${currentLevel}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );

      console.log("Content analysis response:", response.data);

      if (response.data) {
        const { assessedItems, unassessedItems } = response.data;

        // Process assessed items
        const processedAssessedItems = assessedItems.map((item) => ({
          name: item.name,
          subject: currentLevel === "subject" ? item.name : selectedSubject,
          score: item.score,
          totalQuestions: item.totalQuestions || item.questionCount,
          correctAnswers: Math.round(
            (item.score / 100) * (item.totalQuestions || item.questionCount)
          ),
          assessedCount: item.assessedCount,
          questionCount: item.questionCount,
          lastAssessed: item.lastAssessed,
          // Keep these fields for compatibility with existing code
          isDerived: item.isDerived, // preserve the flag
          localScore: null, // Will be implemented in the future
          globalScore: null, // Will be implemented in the future
          avgScore: item.score,
          attempts: 1,
        }));

        // Process unassessed items
        const processedUnassessedItems = unassessedItems.map((item) => ({
          name: item.name,
          subject: currentLevel === "subject" ? item.name : selectedSubject,
          questionCount: item.questionCount,
          isUnassessed: true,
        }));

        // Update state based on current level
        const allItems = [
          ...processedAssessedItems,
          ...processedUnassessedItems,
        ];
        switch (currentLevel) {
          case "subject":
            setSelectedAssessment(null);
            setSubjects(allItems);
            break;
          case "topic":
            setSelectedAssessment(null);
            setTopics(allItems);
            break;
          case "subtopic":
            setSelectedAssessment(null);
            setSubtopics(allItems);
            break;
          case "concept":
            setSelectedAssessment(null);
            setConcepts(allItems);
            break;
        }

        // Generate analytics based on assessed items only
        generateAnalytics(processedAssessedItems, currentLevel);
      }
    } catch (error) {
      console.error(`Error fetching ${currentLevel} data:`, error);
      setError(`Failed to load ${currentLevel} data. Please try again later.`);

      // Set empty arrays to prevent errors in UI
      switch (currentLevel) {
        case "subject":
          setSubjects([]);
          break;
        case "topic":
          setTopics([]);
          break;
        case "subtopic":
          setSubtopics([]);
          break;
        case "concept":
          setConcepts([]);
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate historical data based on current data (used as fallback)
  // 2. Modify fetchHistoricalData to use the new loading state
  // Update your fetchHistoricalData function to use the new endpoint response format
const fetchHistoricalData = async () => {
  // Store current level to check against later
  const fetchingForLevel = currentLevel;
 
  try {
    setHistoricalLoading(true);
    const token = localStorage.getItem("token");
    const decodedToken = token ? jwtDecode(token) : null;
    const userId = decodedToken?.userId || "1";

    // parent parameter if needed
    const params = { userId };
    if (currentLevel === "topic" && selectedSubject) {
      params.parent = selectedSubject;
    } else if (currentLevel === "subtopic" && selectedTopic) {
      params.parent = selectedTopic;
    } else if (currentLevel === "concept" && selectedSubtopic) {
      params.parent = selectedSubtopic;
    }

    const response = await axios.get(
      `${API_URL}/analytics/historical-scores/${currentLevel}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: params,
      }
    );

    console.log("reposne:", response.data);

    if (response.data && Array.isArray(response.data)) {
      // Format the data for the chart
      const chartData = response.data.map((item) => ({
        name: new Date(item.date).toLocaleDateString(),
        average: item.value || 0,
        assessments: item.assessments
      }));

      // If we have historical data, use it
      if (chartData.length > 0) {
        if (fetchingForLevel === currentLevel) {
        setHistoricalData(chartData);
        }
      } else {
        // Use the current average as fallback if no historical data
        if(fetchingForLevel === currentLevel){
        setHistoricalData([{
          name: new Date().toLocaleDateString(),
          average: getCurrentAverageScore(),
        }]);
      }
      }
    } else {
      // Fallback to current average
      if(fetchingForLevel === currentLevel) {
      setHistoricalData([{
        name: new Date().toLocaleDateString(),
        average: getCurrentAverageScore(),
      }]);
    }
    }
  } catch (error) {
    console.error("Error fetching historical data:", error);
    // Fallback to current average
    if(fetchingForLevel === currentLevel) {
    setHistoricalData([{
      name: new Date().toLocaleDateString(),
      average: getCurrentAverageScore(),
    }]);
    }
  } finally {
if (fetchingForLevel === currentLevel) {
      setHistoricalLoading(false);
    }  }
};

// Helper function to get current average score
const getCurrentAverageScore = () => {
  const totalCorrect = data.reduce(
    (sum, item) => sum + (Number(item.correctAnswers) || 0),
    0
  );
  const totalQuestions = data.reduce(
    (sum, item) => sum + (Number(item.totalQuestions) || 0),
    0
  );
  return totalQuestions > 0 ? Math.floor((totalCorrect / totalQuestions) * 100) : 0;
};

  // Generate analytics based on data
  const generateAnalytics = (data, level) => {
    // if (!data || data.length === 0) return;
    // Filter out unassessed items for analytics calculations
    const assessedData = data.filter((item) => !item.isUnassessed);

    if (assessedData.length === 0) {
      // If all items are unassessed, set empty values
      setKnowledgeGaps([]);
      return;
    }

    // Identify knowledge gaps (scores below 60%)
    // const gaps = assessedData.filter(item => item.score < 60)
    const gaps = assessedData
      .map((item) => ({
        ...item,
        gap: 100 - item.score,
        proficiency: getProficiencyLevel(item.score),
      }))
      .sort((a, b) => a.score - b.score);

    // Set all analytics state
    setKnowledgeGaps(gaps);

    // Include unassessed items in strengthWeakness with a special category
    const unassessedItems = data
      .filter((item) => item.isUnassessed)
      .map((item) => ({
        ...item,
        proficiency: {
          key: "UNASSESSED",
          color: "#9E9E9E",
          label: "Not Assessed",
          range: [0, 0],
        },
      }));
  };

  // Display unassessed items with a call to action
  const UnassessedItemsSection = () => {
    // Get current data based on level
    const currentData = getCurrentData();
    const unassessedItems = currentData.filter((item) => item.isUnassessed);

    if (unassessedItems.length === 0) return null;

    // Determine the appropriate context message based on current level
    let contextMessage = "";
    switch (currentLevel) {
      case "subject":
        contextMessage =
          "These subjects are available but you haven't assessed them yet.";
        break;
      case "topic":
        contextMessage = `These topics in ${selectedSubject} are available but you haven't assessed them yet.`;
        break;
      case "subtopic":
        contextMessage = `These subtopics in ${selectedTopic} are available but you haven't assessed them yet.`;
        break;
      case "concept":
        contextMessage = `These concepts in ${selectedSubtopic} are available but you haven't assessed them yet.`;
        break;
    }

    return (
      <Grid item xs={12}>
        <Paper sx={{ p: 3 }} elevation={3} className="explore-new-section">
          <Typography variant="h6" gutterBottom>
            Explore New{" "}
            {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)}s
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {contextMessage} Click to explore!
          </Typography>

          <Grid container spacing={2}>
            {unassessedItems.map((item, idx) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={idx}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: "center",
                    bgcolor: "#f5f5f5",
                    borderLeft: "4px solid #9E9E9E",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                    "&:hover": {
                      bgcolor: "#e0e0e0",
                      transform: "translateY(-2px)",
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => handleItemClick(item)}
                >
                  <Typography variant="subtitle1">{item.name}</Typography>
                  {item.questionCount > 0 && (
                    <Typography
                      variant="caption"
                      display="block"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      {item.questionCount} questions available
                    </Typography>
                  )}
                  <Chip
                    label="Start Assessment"
                    color="primary"
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartAssessment(item);
                    }}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Grid>
    );
  };
  // Function to handle starting assessments for unassessed items
  const handleStartAssessment = (item) => {
    // Default assessment configuration
    const defaultConfig = {
      numQuestions: 5,
      difficulty: "medium",
      timeLimit: 0, // No time limit
      includeSubtopics: true,
      questionTypes: ["open-ended"],
    };

    // Get the appropriate level and item name
    const assessmentLevel = currentLevel;
    const assessmentItem = item.name;

    console.log(
      `Starting assessment for ${assessmentLevel}: ${assessmentItem}`
    );

    // Navigate to the assessment page with the necessary props
    navigate("/assessment", {
      state: {
        level: assessmentLevel,
        item: assessmentItem,
        config: defaultConfig,
      },
    });
  };

  // Fetch topics when a subject is selected

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleLevelBack = () => {
    if (currentLevel === "concept") {
      setCurrentLevel("subtopic");
      setSelectedSubtopic(null);
      setHistoricalData([]);
    } else if (currentLevel === "subtopic") {
      setCurrentLevel("topic");
      setSelectedTopic(null);
      setHistoricalData([]);
    } else if (currentLevel === "topic") {
      setCurrentLevel("subject");
      setSelectedSubject(null);
      setHistoricalData([]);
    }
  };

  const handleItemClick = (item) => {
    if (currentLevel === "subject") {
      setSelectedSubject(item.subject || item.name);
      setCurrentLevel("topic");
      setHistoricalData([]);
    } else if (currentLevel === "topic") {
      setSelectedTopic(item.name);
      setCurrentLevel("subtopic");
      setHistoricalData([]);
    } else if (currentLevel === "subtopic") {
      setSelectedSubtopic(item.name);
      setCurrentLevel("concept");
      setHistoricalData([]);
    }
  };

  // Get current data based on level
  const getCurrentData = () => {
    switch (currentLevel) {
      case "topic":
        return topics;
      case "subtopic":
        return subtopics;
      case "concept":
        return concepts;
      case "subject":
      default:
        return subjects;
    }
  };

  const getCurrentLevelLabel = () => {
    switch (currentLevel) {
      case "topic":
        return `Topics in ${selectedSubject}`;
      case "subtopic":
        return `Subtopics in ${selectedTopic}`;
      case "concept":
        return `Concepts in ${selectedSubtopic}`;
      case "subject":
      default:
        return "Subjects";
    }
  };

  const data = getCurrentData();

  useEffect(() => {
    if (userId && currentLevel && data.length > 0) {
      fetchHistoricalData();
    }
  }, [
    userId,
    currentLevel,
    selectedSubject,
    selectedTopic,
    selectedSubtopic,
    data,
  ]);

  const getBreadcrumbs = () => {
    const crumbs = [
      {
        name: "Subjects",
        level: "subject",
        active: currentLevel === "subject",
      },
    ];

    if (selectedSubject) {
      crumbs.push({
        name: selectedSubject,
        level: "topic",
        active: currentLevel === "topic",
      });
    }

    if (selectedTopic) {
      crumbs.push({
        name: selectedTopic,
        level: "subtopic",
        active: currentLevel === "subtopic",
      });
    }

    if (selectedSubtopic) {
      crumbs.push({
        name: selectedSubtopic,
        level: "concept",
        active: currentLevel === "concept",
      });
    }

    return crumbs;
  };

  // Display empty state when no data is available
  const renderEmptyState = () => (
    <Box sx={{ textAlign: "center", py: 8 }}>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No skill data available yet
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Complete assessments to see your progress and skill analysis.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 4 }}
        onClick={() => navigate("/practice")}
      >
        Start Practice
      </Button>
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
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
      <Typography variant="h4" gutterBottom>
        Skill Analysis Dashboard
      </Typography>
      <Divider sx={{ mb: 4 }} />

      {/* Navigation breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        {getBreadcrumbs().map((crumb, index) => (
          <Typography
            key={index}
            color={crumb.active ? "text.primary" : "primary"}
            sx={{
              fontWeight: crumb.active ? "bold" : "normal",
              cursor: crumb.active ? "default" : "pointer",
            }}
            onClick={() => {
              if (!crumb.active) {
                setCurrentLevel(crumb.level);
                if (crumb.level === "subject") {
                  setSelectedSubject(null);
                  setSelectedTopic(null);
                  setSelectedSubtopic(null);
                } else if (crumb.level === "topic") {
                  setSelectedTopic(null);
                  setSelectedSubtopic(null);
                } else if (crumb.level === "subtopic") {
                  setSelectedSubtopic(null);
                }
              }
            }}
          >
            {crumb.name}
          </Typography>
        ))}
      </Breadcrumbs>

      {/* Back to Dashboard button - only show when at subject level */}
      {currentLevel === "subject" && (
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/dashboard")}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
      )}

      {/* Back button for other levels */}
      {currentLevel !== "subject" && (
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleLevelBack}
          sx={{ mb: 2 }}
        >
          Back to{" "}
          {currentLevel === "topic"
            ? "Subjects"
            : currentLevel === "subtopic"
            ? "Topics"
            : "Subtopics"}
        </Button>
      )}

      <Typography variant="h5" sx={{ mb: 3 }}>
        {getCurrentLevelLabel()}
      </Typography>

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        {/* <Tab label="Proficiency Analysis" />
        <Tab label="Improvement Plan" /> */}
      </Tabs>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : data.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 0 && (
            <Grid container spacing={4}>
              {/* Performance Summary Card */}
              <Grid item xs={12}>
                <Paper sx={{ p: 3, mb: 2 }} elevation={3} className="performance-summary">
                  <Typography variant="h6" gutterBottom>
                    Performance Summary
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Performance Summary Card - Average Score */}
                    <Grid item xs={12} md={3}>
                      <Box sx={{ textAlign: "center", p: 2 }}>
                        {console.log(
                          "Debug data:",
                          data
                            .filter((item) => item.score != null)
                            .map((item) => ({
                              name: item.name,
                              score: item.score,
                              correctAnswers: item.correctAnswers,
                              totalQuestions: item.totalQuestions,
                            }))
                        )}
                        <Typography variant="h3" color="primary">
                          {(() => {
                            // Get totals with proper fallbacks and type conversion
                            const totalCorrect = data.reduce(
                              (sum, item) =>
                                sum + (Number(item.correctAnswers) || 0),
                              0
                            );

                            const totalQuestions = data.reduce(
                              (sum, item) =>
                                sum + (Number(item.totalQuestions) || 0),
                              0
                            );

                            // Calculate percentage
                            return Math.floor(
                              (totalCorrect / totalQuestions) * 100
                            );
                          })()}
                          %
                        </Typography>
                        <Typography variant="subtitle1">
                          Average Score
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ textAlign: "center", p: 2 }}>
                        <Typography variant="h3" sx={{ color: "#4CAF50" }}>
                          {data.filter((item) => item.score >= 80).length}
                        </Typography>
                        <Typography variant="subtitle1">Mastered</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ textAlign: "center", p: 2 }}>
                        <Typography variant="h3" sx={{ color: "#FFC107" }}>
                          {
                            data.filter(
                              (item) => item.score >= 60 && item.score < 80
                            ).length
                          }
                        </Typography>
                        <Typography variant="subtitle1">Developing</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ textAlign: "center", p: 2 }}>
                        <Typography variant="h3" sx={{ color: "#F44336" }}>
                          {data.filter((item) => item.score < 40).length}
                        </Typography>
                        <Typography variant="subtitle1">Needs Work</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Knowledge Gap Analysis */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: 350 }} elevation={3} className="knowledge-gap-analysis">
                  <Typography variant="h6" gutterBottom>
                    Knowledge Gap Analysis
                  </Typography>
                  <Box sx={{ height: "85%", overflow: "auto" }}>
                    {knowledgeGaps.assessedItems === 0 ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                        }}
                      >
                        <CheckCircleIcon
                          sx={{ color: "success.main", mr: 1 }}
                        />
                        <Typography>
                          {currentLevel === "concept"
                            ? "No assessed concepts found for this subtopic yet."
                            : "No significant knowledge gaps detected!"}
                        </Typography>
                      </Box>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>
                                {currentLevel === "subject"
                                  ? "Subject"
                                  : currentLevel === "topic"
                                  ? "Topic"
                                  : currentLevel === "subtopic"
                                  ? "Subtopic"
                                  : "Concept"}
                              </TableCell>
                              <TableCell align="center">
                                Current Score
                              </TableCell>
                              {/* <TableCell align="center">Local Score</TableCell> */}
                              {/* <TableCell align="center">Global Score</TableCell> */}
                              <TableCell align="center">Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {knowledgeGaps.map((item, idx) => (
                              <TableRow
                                key={idx}
                                hover
                                onClick={() => handleItemClick(item)}
                                sx={{ cursor: "pointer" }}
                              >
                                <TableCell>{item.name}</TableCell>
                                <TableCell
                                  align="center"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScoreClick(item, "current");
                                  }}
                                  sx={{
                                    cursor: "pointer",
                                    "&:hover": {
                                      color: "primary.main",
                                      textDecoration: "underline",
                                    },
                                  }}
                                >
                                  <Typography>
                                    {Math.floor(item.score)}%
                                    {item.isDerived && (
                                      <Tooltip title="Score calculated from questions assessed in other tests">
                                        <InfoIcon
                                          sx={{
                                            fontSize: 16,
                                            ml: 0.5,
                                            color: "text.secondary",
                                          }}
                                        />
                                      </Tooltip>
                                    )}
                                  </Typography>
                                </TableCell>
                                {/* <TableCell
                                  align="center"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScoreClick(item, "local");
                                  }}
                                  sx={{
                                    cursor: "pointer",
                                    "&:hover": {
                                      color: "primary.main",
                                      textDecoration: "underline",
                                    },
                                  }}
                                >
                                  <Typography>
                                    {item.localScore || "-"}%
                                  </Typography>
                                </TableCell> */}
                                {/* <TableCell
                                  align="center"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScoreClick(item, "global");
                                  }}
                                  sx={{
                                    cursor: "pointer",
                                    "&:hover": {
                                      color: "primary.main",
                                      textDecoration: "underline",
                                    },
                                  }}
                                >
                                  <Typography>
                                    {item.globalScore || "-"}%
                                  </Typography>
                                </TableCell> */}
                                <TableCell align="center">
                                  <Chip
                                    icon={<WarningIcon />}
                                    label={item.proficiency.label}
                                    size="small"
                                    sx={{
                                      bgcolor: item.proficiency.color,
                                      color: "white",
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                </Paper>
              </Grid>

              {/* Assessment Details Display (Replaces Performance Radar) */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: 350 }} elevation={3} className="assessment-details">
                  {assessmentLoading ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h6" gutterBottom>
                        {!hasClickedScore
                          ? "Assessment Details"
                          : selectedScoreType === "current"
                          ? "Current Assessment Details"
                          : selectedScoreType === "local"
                          ? "Local Score Details"
                          : selectedScoreType === "global"
                          ? "Global Score Details"
                          : "Assessment Details"}
                      </Typography>
                      <Box sx={{ height: "85%", overflow: "auto" }}>
                        {!selectedAssessment ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "100%",
                            }}
                          >
                            <InfoIcon sx={{ color: "info.main", mr: 1 }} />
                            <Typography>
                              Click on a score to view details
                            </Typography>
                          </Box>
                        ) : selectedAssessment.isDerived &&
                          selectedScoreType === "current" ? (
                          // Use our new component for derived scores
                          <DerivedScoreDetails
                            assessment={selectedAssessment}
                          />
                        ) : selectedScoreType === "current" &&
                          assessmentHierarchy ? (
                          <Box>
                            {/* Enhanced Date Display */}
                            <Box
                              sx={{
                                mb: 3,
                                p: 2,
                                borderRadius: 1,
                                bgcolor: "primary.main",
                                color: "primary.contrastText",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: 1,
                              }}
                            >
                              <Typography
                                variant="h6"
                                sx={{ fontWeight: "medium" }}
                              >
                                {new Date(
                                  selectedAssessment.date
                                ).toLocaleDateString(undefined, {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Typography>
                            </Box>

                            {/* Assessment Summary */}
                            <Box
                              sx={{
                                mb: 3,
                                p: 2,
                                borderRadius: 1,
                                bgcolor: "background.paper",
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              <Typography
                                variant="subtitle1"
                                fontWeight="bold"
                                gutterBottom
                              >
                                Assessment Summary
                              </Typography>
                              <Grid container spacing={2}>
                                <Grid item xs={6}>
                                  <Box sx={{ textAlign: "center", py: 1 }}>
                                    <Typography variant="h4" color="primary">
                                      {Math.floor(selectedAssessment.score)}%
                                    </Typography>
                                    <Typography variant="body2">
                                      Overall Score
                                    </Typography>
                                  </Box>
                                </Grid>
                                <Grid item xs={6}>
                                  <Box sx={{ textAlign: "center", py: 1 }}>
                                    <Typography variant="h4" color="secondary">
                                      {selectedAssessment.questioninfo
                                        ?.length || 0}
                                    </Typography>
                                    <Typography variant="body2">
                                      Questions
                                    </Typography>
                                  </Box>
                                </Grid>
                              </Grid>
                            </Box>

                            {/* Improved Hierarchy Display */}
                            <Box sx={{ mt: 2 }}>
                              <Typography
                                variant="subtitle1"
                                fontWeight="bold"
                                gutterBottom
                              >
                                Content Breakdown
                                {selectedAssessment?.level && (
                                  <Typography variant="caption" sx={{ ml: 1 }}>
                                    ({selectedAssessment.level} level)
                                  </Typography>
                                )}
                              </Typography>

                              {Object.keys(assessmentHierarchy).map(
                                (primaryKey) => {
                                  // Calculate primary-level statistics
                                  let primaryTotal = 0;
                                  let primaryCorrect = 0;

                                  Object.keys(
                                    assessmentHierarchy[primaryKey].subtopics
                                  ).forEach((secondaryKey) => {
                                    Object.keys(
                                      assessmentHierarchy[primaryKey].subtopics[
                                        secondaryKey
                                      ].concepts
                                    ).forEach((tertiaryKey) => {
                                      const questions =
                                        assessmentHierarchy[primaryKey]
                                          .subtopics[secondaryKey].concepts[
                                          tertiaryKey
                                        ].questions;
                                      questions.forEach((q) => {
                                        primaryTotal++;
                                        if (q.status === "correct")
                                          primaryCorrect++;
                                      });
                                    });
                                  });

                                  const primaryScore =
                                    primaryTotal > 0
                                      ? Math.floor(
                                          (primaryCorrect / primaryTotal) * 100
                                        )
                                      : 0;

                                  // Determine appropriate label based on level
                                  let primaryKeyLabel = "Topic";
                                  if (selectedAssessment?.level === "subject")
                                    primaryKeyLabel = "Subject";
                                  if (selectedAssessment?.level === "subtopic")
                                    primaryKeyLabel = "Subtopic";
                                  if (selectedAssessment?.level === "concept")
                                    primaryKeyLabel = "Concept";

                                  return (
                                    <Box
                                      key={primaryKey}
                                      sx={{
                                        mb: 2,
                                        border: "1px solid",
                                        borderColor: "divider",
                                        borderRadius: 1,
                                        overflow: "hidden",
                                      }}
                                    >
                                      {/* Primary Header with Label appropriate to the level */}
                                      <Box
                                        sx={{
                                          p: 1.5,
                                          bgcolor: "primary.light",
                                          color: "primary.contrastText",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                        }}
                                      >
                                        <Typography
                                          variant="subtitle1"
                                          sx={{ fontWeight: "bold" }}
                                        >
                                          {primaryKey}
                                        </Typography>
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            bgcolor: "rgba(255,255,255,0.2)",
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: 1,
                                          }}
                                        >
                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: "bold", mr: 1 }}
                                          >
                                            {primaryScore}%
                                          </Typography>
                                          <Typography variant="caption">
                                            ({primaryCorrect}/{primaryTotal})
                                          </Typography>
                                        </Box>
                                      </Box>

                                      {/* Secondary level - not shown if concept level */}
                                      {selectedAssessment?.level !==
                                        "concept" &&
                                        Object.keys(
                                          assessmentHierarchy[primaryKey]
                                            .subtopics
                                        ).map((secondaryKey) => {
                                          // For "Details" keys at concept level, skip rendering
                                          if (
                                            selectedAssessment?.level ===
                                              "concept" &&
                                            secondaryKey === "Details"
                                          )
                                            return null;

                                          // Calculate secondary-level statistics
                                          let secondaryTotal = 0;
                                          let secondaryCorrect = 0;

                                          Object.keys(
                                            assessmentHierarchy[primaryKey]
                                              .subtopics[secondaryKey].concepts
                                          ).forEach((tertiaryKey) => {
                                            const questions =
                                              assessmentHierarchy[primaryKey]
                                                .subtopics[secondaryKey]
                                                .concepts[tertiaryKey]
                                                .questions;
                                            questions.forEach((q) => {
                                              secondaryTotal++;
                                              if (q.status === "correct")
                                                secondaryCorrect++;
                                            });
                                          });

                                          const secondaryScore =
                                            secondaryTotal > 0
                                              ? Math.floor(
                                                  (secondaryCorrect /
                                                    secondaryTotal) *
                                                    100
                                                )
                                              : 0;
                                          const proficiencyColor =
                                            secondaryScore >= 80
                                              ? "#4CAF50"
                                              : secondaryScore >= 60
                                              ? "#FFC107"
                                              : "#F44336";

                                          // Determine appropriate label based on level
                                          let secondaryKeyLabel = "Subtopic";
                                          if (
                                            selectedAssessment?.level ===
                                            "subject"
                                          )
                                            secondaryKeyLabel = "Topic";
                                          if (
                                            selectedAssessment?.level ===
                                            "subtopic"
                                          )
                                            secondaryKeyLabel = "Concept";
                                          if (
                                            selectedAssessment?.level ===
                                            "concept"
                                          )
                                            secondaryKeyLabel = "Detail";

                                          return (
                                            <Box
                                              key={secondaryKey}
                                              sx={{
                                                borderTop: "1px solid",
                                                borderColor: "divider",
                                              }}
                                            >
                                              <Box
                                                sx={{
                                                  p: 1.5,
                                                  pl: 3,
                                                  display: "flex",
                                                  justifyContent:
                                                    "space-between",
                                                  alignItems: "center",
                                                  bgcolor: "background.default",
                                                }}
                                              >
                                                <Typography
                                                  variant="subtitle2"
                                                  sx={{ fontWeight: "bold" }}
                                                >
                                                  {secondaryKey}
                                                </Typography>
                                                <Box
                                                  sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                  }}
                                                >
                                                  <Box
                                                    sx={{
                                                      width: 12,
                                                      height: 12,
                                                      borderRadius: "50%",
                                                      bgcolor: proficiencyColor,
                                                      mr: 1,
                                                    }}
                                                  />
                                                  <Typography variant="body2">
                                                    {secondaryScore}% (
                                                    {secondaryCorrect}/
                                                    {secondaryTotal})
                                                  </Typography>
                                                </Box>
                                              </Box>

                                              {/* Tertiary level - Only show for subject and topic levels */}
                                              {(selectedAssessment?.level ===
                                                "subject" ||
                                                selectedAssessment?.level ===
                                                  "topic") && (
                                                <Box
                                                  sx={{
                                                    pl: 3,
                                                    pr: 2,
                                                    pb: 1,
                                                    pt: 0.5,
                                                    bgcolor: "background.paper",
                                                  }}
                                                >
                                                  {Object.keys(
                                                    assessmentHierarchy[
                                                      primaryKey
                                                    ].subtopics[secondaryKey]
                                                      .concepts
                                                  ).map((tertiaryKey) => {
                                                    const questions =
                                                      assessmentHierarchy[
                                                        primaryKey
                                                      ].subtopics[secondaryKey]
                                                        .concepts[tertiaryKey]
                                                        .questions;
                                                    const tertiaryTotal =
                                                      questions.length;
                                                    const tertiaryCorrect =
                                                      questions.filter(
                                                        (q) =>
                                                          q.status === "correct"
                                                      ).length;
                                                    const tertiaryScore =
                                                      tertiaryTotal > 0
                                                        ? Math.floor(
                                                            (tertiaryCorrect /
                                                              tertiaryTotal) *
                                                              100
                                                          )
                                                        : 0;
                                                    const conceptScoreNum =
                                                      parseFloat(tertiaryScore);

                                                    // Determine appropriate label based on level
                                                    let tertiaryKeyLabel =
                                                      "Concept";
                                                    if (
                                                      selectedAssessment?.level ===
                                                      "subject"
                                                    )
                                                      tertiaryKeyLabel =
                                                        "Subtopic";

                                                    return (
                                                      <Box
                                                        key={tertiaryKey}
                                                        sx={{
                                                          display: "flex",
                                                          justifyContent:
                                                            "space-between",
                                                          alignItems: "center",
                                                          py: 0.75,
                                                          borderBottom:
                                                            "1px dashed",
                                                          borderColor:
                                                            "divider",
                                                          "&:last-child": {
                                                            borderBottom:
                                                              "none",
                                                          },
                                                        }}
                                                      >
                                                        <Typography
                                                          variant="body2"
                                                          sx={{
                                                            fontStyle: "italic",
                                                            color:
                                                              "text.secondary",
                                                          }}
                                                        >
                                                          {tertiaryKey}
                                                        </Typography>
                                                        <Box
                                                          sx={{
                                                            display: "flex",
                                                            alignItems:
                                                              "center",
                                                            bgcolor:
                                                              conceptScoreNum >=
                                                              80
                                                                ? "#E8F5E9"
                                                                : conceptScoreNum >=
                                                                  60
                                                                ? "#FFF8E1"
                                                                : "#FFEBEE",
                                                            px: 1,
                                                            py: 0.5,
                                                            borderRadius: 0.5,
                                                          }}
                                                        >
                                                          <Typography
                                                            variant="caption"
                                                            sx={{
                                                              fontWeight:
                                                                "medium",
                                                              color:
                                                                conceptScoreNum >=
                                                                80
                                                                  ? "#2E7D32"
                                                                  : conceptScoreNum >=
                                                                    60
                                                                  ? "#F57F17"
                                                                  : "#C62828",
                                                            }}
                                                          >
                                                            {tertiaryCorrect}/
                                                            {tertiaryTotal}{" "}
                                                            Questions
                                                          </Typography>
                                                        </Box>
                                                      </Box>
                                                    );
                                                  })}
                                                </Box>
                                              )}
                                            </Box>
                                          );
                                        })}
                                    </Box>
                                  );
                                }
                              )}
                            </Box>
                          </Box>
                        ) : selectedScoreType === "local" ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "100%",
                            }}
                          >
                            <Typography>
                              Local score analysis will be implemented in the
                              future.
                            </Typography>
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "100%",
                            }}
                          >
                            <Typography>
                              Global score analysis will be implemented in the
                              future.
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </>
                  )}
                </Paper>
              </Grid>

              {/* Progress Trends */}
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }} elevation={3} className="progress-trends">
                  <Typography variant="h6" gutterBottom>
                    Progress Over Time
                  </Typography>
                  {historicalLoading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 4 }}
                    >
                      <CircularProgress size={30} />
                    </Box>
                  ) : historicalData.length > 0 ? (
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historicalData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => {
                              // Format date to be more compact if too many points
                              if (historicalData.length > 10) {
                                const date = new Date(value);
                                return `${
                                  date.getMonth() + 1
                                }/${date.getDate()}`;
                              }
                              return value;
                            }}
                          />
                          <YAxis domain={[0, 100]} />
                          <RechartsTooltip
                            formatter={(value) => [
                              `${value}%`,
                              "Average Score",
                            ]}
                            labelFormatter={(label) => `Date: ${label}`}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="average"
                            name="Average Score"
                            stroke="#8884d8"
                            fill="#8884d820"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 4 }}
                    >
                      <Typography color="text.secondary">
                        No historical data available yet. Complete more
                        assessments over time to track your progress.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Unassessed Items Section */}
              <UnassessedItemsSection />
            </Grid>
          )}
        </>
      )}
    </Container>
  );
};

export default SkillAnalysis;

