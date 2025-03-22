import React, { useState, useEffect } from 'react';
import { 
  Container, Grid, Paper, Typography, Box, 
  Tabs, Tab, Divider, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel,
  Breadcrumbs, Link, Button
} from '@mui/material';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import axios from 'axios';

const SkillAnalysis = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // Hierarchy navigation state
  const [currentLevel, setCurrentLevel] = useState('subject'); // subject, topic, subtopic, concept
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  
  // Data state
  const [userData, setUserData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [concepts, setConcepts] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Fetch initial subject level data
  useEffect(() => {
    const fetchUserProgress = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:8000/user/progress', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setUserData(response.data);
        setSubjects(response.data?.skillData || sampleSubjectData);
        setError(null);
      } catch (error) {
        console.error('Error fetching user progress:', error);
        setSubjects(sampleSubjectData);
        setError('Failed to load your skill data. Using sample data.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProgress();
  }, []);
  
  // Fetch topics when a subject is selected
  useEffect(() => {
    if (selectedSubject && currentLevel === 'topic') {
      fetchTopics(selectedSubject);
    }
  }, [selectedSubject, currentLevel]);
  
  // Fetch subtopics when a topic is selected
  useEffect(() => {
    if (selectedTopic && currentLevel === 'subtopic') {
      fetchSubtopics(selectedTopic);
    }
  }, [selectedTopic, currentLevel]);
  
  // Fetch concepts when a subtopic is selected
  useEffect(() => {
    if (selectedSubtopic && currentLevel === 'concept') {
      fetchConcepts(selectedSubtopic);
    }
  }, [selectedSubtopic, currentLevel]);
  
  const fetchTopics = async (subject) => {
    try {
      setLoading(true);
      // Try API first
      try {
        const response = await axios.get(`http://localhost:8000/api/users/progress/topics/${encodeURIComponent(subject)}`);
        if (response.data && response.data.length > 0) {
          setTopics(response.data);
          return;
        }
      } catch (apiError) {
        console.error('API error, using sample data:', apiError);
      }
      
      // Fallback to localStorage data
      const storedMastery = localStorage.getItem('topicMastery');
      if (storedMastery) {
        const allTopicProgress = JSON.parse(storedMastery);
        // Transform to expected format
        const formattedData = Object.entries(allTopicProgress).map(([name, score]) => ({
          name,
          score
        }));
        setTopics(formattedData);
      } else {
        // Use sample data as last resort
        setTopics(sampleTopicData);
      }
    } catch (error) {
      console.error('Error fetching topic progress:', error);
      setTopics(sampleTopicData);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSubtopics = async (topic) => {
    // Similar implementation to fetchTopics
    setSubtopics(sampleSubtopicData);
    setLoading(false);
  };
  
  const fetchConcepts = async (subtopic) => {
    // Similar implementation to fetchTopics
    setConcepts(sampleConceptData);
    setLoading(false);
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  const handleLevelBack = () => {
    if (currentLevel === 'concept') {
      setCurrentLevel('subtopic');
      setSelectedSubtopic(null);
    } else if (currentLevel === 'subtopic') {
      setCurrentLevel('topic');
      setSelectedTopic(null);
    } else if (currentLevel === 'topic') {
      setCurrentLevel('subject');
      setSelectedSubject(null);
    }
  };
  
  const handleItemClick = (item) => {
    if (currentLevel === 'subject') {
      setSelectedSubject(item.subject || item.name);
      setCurrentLevel('topic');
    } else if (currentLevel === 'topic') {
      setSelectedTopic(item.name);
      setCurrentLevel('subtopic');
    } else if (currentLevel === 'subtopic') {
      setSelectedSubtopic(item.name);
      setCurrentLevel('concept');
    }
  };
  
  // Sample data for different levels
  const sampleSubjectData = [
    { subject: 'Math', score: 80 },
    { subject: 'Physics', score: 65 },
    { subject: 'Chemistry', score: 90 },
    { subject: 'Biology', score: 75 },
    { subject: 'Computer Science', score: 95 }
  ];
  
  const sampleTopicData = [
    { name: 'Calculus', score: 75 },
    { name: 'Algebra', score: 85 },
    { name: 'Geometry', score: 60 },
    { name: 'Trigonometry', score: 90 }
  ];
  
  const sampleSubtopicData = [
    { name: 'Derivatives', score: 80 },
    { name: 'Integrals', score: 70 },
    { name: 'Limits', score: 85 },
    { name: 'Applications', score: 65 }
  ];
  
  const sampleConceptData = [
    { name: 'Power Rule', score: 95 },
    { name: 'Chain Rule', score: 85 },
    { name: 'Product Rule', score: 75 },
    { name: 'Quotient Rule', score: 80 }
  ];
  
  // Get current data based on level
  const getCurrentData = () => {
    switch(currentLevel) {
      case 'topic':
        return topics;
      case 'subtopic':
        return subtopics;
      case 'concept':
        return concepts;
      case 'subject':
      default:
        return subjects;
    }
  };
  
  const getCurrentLevelLabel = () => {
    switch(currentLevel) {
      case 'topic': return `Topics in ${selectedSubject}`;
      case 'subtopic': return `Subtopics in ${selectedTopic}`;
      case 'concept': return `Concepts in ${selectedSubtopic}`;
      case 'subject': default: return 'Subjects';
    }
  };
  
  const data = getCurrentData();
  
  const getBreadcrumbs = () => {
    const crumbs = [
      { name: 'Subjects', level: 'subject', active: currentLevel === 'subject' }
    ];
    
    if (selectedSubject) {
      crumbs.push({ 
        name: selectedSubject, 
        level: 'topic', 
        active: currentLevel === 'topic' 
      });
    }
    
    if (selectedTopic) {
      crumbs.push({ 
        name: selectedTopic, 
        level: 'subtopic',
        active: currentLevel === 'subtopic' 
      });
    }
    
    if (selectedSubtopic) {
      crumbs.push({ 
        name: selectedSubtopic, 
        level: 'concept',
        active: currentLevel === 'concept' 
      });
    }
    
    return crumbs;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Skill Analysis Dashboard</Typography>
      <Divider sx={{ mb: 4 }} />
      
      {/* Navigation breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        {getBreadcrumbs().map((crumb, index) => (
          <Typography
            key={index}
            color={crumb.active ? 'text.primary' : 'primary'}
            sx={{ 
              fontWeight: crumb.active ? 'bold' : 'normal',
              cursor: crumb.active ? 'default' : 'pointer'
            }}
            onClick={() => {
              if (!crumb.active) {
                setCurrentLevel(crumb.level);
                if (crumb.level === 'subject') {
                  setSelectedSubject(null);
                  setSelectedTopic(null);
                  setSelectedSubtopic(null);
                } else if (crumb.level === 'topic') {
                  setSelectedTopic(null);
                  setSelectedSubtopic(null);
                } else if (crumb.level === 'subtopic') {
                  setSelectedSubtopic(null);
                }
              }
            }}
          >
            {crumb.name}
          </Typography>
        ))}
      </Breadcrumbs>
      
      {/* Back button */}
      {currentLevel !== 'subject' && (
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={handleLevelBack} 
          sx={{ mb: 2 }}
        >
          Back to {currentLevel === 'topic' ? 'Subjects' : 
                   currentLevel === 'subtopic' ? 'Topics' : 'Subtopics'}
        </Button>
      )}
      
      <Typography variant="h5" sx={{ mb: 3 }}>{getCurrentLevelLabel()}</Typography>
      
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Progress" />
        <Tab label="Recommendations" />
      </Tabs>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
      ) : (
        <>
          {activeTab === 0 && (
            <Grid container spacing={4}>
              {/* Radar Chart */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: 350 }} elevation={3}>
                  <Typography variant="h6" gutterBottom>{getCurrentLevelLabel()} Performance</Typography>
                  <ResponsiveContainer width="100%" height="85%">
                    <RadarChart outerRadius={90} data={data}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey={currentLevel === 'subject' ? "subject" : "name"} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar 
                        name="Score" 
                        dataKey="score" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.6} 
                      />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              
              {/* Bar Chart */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: 350 }} elevation={3}>
                  <Typography variant="h6" gutterBottom>Performance Overview</Typography>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={currentLevel === 'subject' ? "subject" : "name"} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        dataKey="score" 
                        fill="#82ca9d" 
                        name="Score (%)" 
                        onClick={handleItemClick}
                        cursor="pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              
              {/* Pie Chart */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: 350 }} elevation={3}>
                  <Typography variant="h6" gutterBottom>Mastery Distribution</Typography>
                  <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                      <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, subject, score }) => `${name || subject}: ${score}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="score"
                        nameKey={currentLevel === 'subject' ? "subject" : "name"}
                        onClick={handleItemClick}
                        cursor="pointer"
                      >
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              
              {/* Strength/Weakness Analysis */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: 350 }} elevation={3}>
                  <Typography variant="h6" gutterBottom>Strength & Weakness Analysis</Typography>
                  <Box sx={{ height: "85%", overflow: "auto", mt: 2 }}>
                    {data.sort((a, b) => b.score - a.score).map((item, index) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          mb: 2, 
                          p: 1, 
                          borderLeft: `4px solid ${item.score > 80 ? 'green' : item.score > 60 ? 'orange' : 'red'}`,
                          bgcolor: 'background.paper',
                          boxShadow: 1,
                          borderRadius: 1,
                          cursor: 'pointer'
                        }}
                        onClick={() => handleItemClick(item)}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1">
                            {item.subject || item.name}
                          </Typography>
                          <Typography 
                            variant="subtitle1" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: item.score > 80 ? 'success.main' : item.score > 60 ? 'warning.main' : 'error.main'
                            }}
                          >
                            {item.score}%
                          </Typography>
                        </Box>
                        <Box sx={{ width: '100%', mt: 1 }}>
                          <Box 
                            sx={{ 
                              height: 8, 
                              width: `${item.score}%`, 
                              bgcolor: item.score > 80 ? 'success.main' : item.score > 60 ? 'warning.main' : 'error.main',
                              borderRadius: 5
                            }} 
                          />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>Progress Over Time</Typography>
              {/* Progress tracking charts would go here */}
              <Alert severity="info">
                Progress tracking over time feature coming soon!
              </Alert>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>Personalized Recommendations</Typography>
              <Grid container spacing={3}>
                {data
                  .sort((a, b) => a.score - b.score)
                  .slice(0, 3)
                  .map((item, index) => (
                    <Grid item xs={12} md={4} key={index}>
                      <Paper 
                        sx={{ 
                          p: 2, 
                          borderLeft: '4px solid red',
                          height: '100%',
                        }}
                      >
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>
                          Improve your {item.subject || item.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Current mastery: {item.score}%
                        </Typography>
                        <Button 
                          variant="outlined" 
                          color="primary"
                          onClick={() => handleItemClick(item)}
                        >
                          Practice Now
                        </Button>
                      </Paper>
                    </Grid>
                  ))}
              </Grid>
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default SkillAnalysis;