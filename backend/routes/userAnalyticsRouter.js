const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authenticate");
const AssessmentResult = require("../models/AssessmentResult");
const UserAnswer = require("../models/UserAnswer");
const Question = require("../models/Question");

// Update the save-assessment-result endpoint
router.post("/save-assessment-result", authenticateToken, async (req, res) => {
  try {
    const {
      userId,
      assessmentId,
      level,
      itemName,
      score,
      totalQuestions,
      timeTaken,
      date,
      questioninfo,
    } = req.body;

    if (!userId || !level || !itemName || score === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create a new assessment result record with simplified model
    const assessmentResult = new AssessmentResult({
      userId,
      assessmentId,
      level,
      itemName,
      score,
      totalQuestions,
      timeTaken,
      date: date || new Date(),
      questioninfo: questioninfo || [],
    });

    await assessmentResult.save();

    res.json({ success: true, assessmentResult });
  } catch (error) {
    console.error("Error saving assessment result:", error);
    res.status(500).json({ error: "Failed to save assessment result" });
  }
});

router.get("/results/latest", authenticateToken, async (req, res) => {
  try {
    const { userId, level, itemName } = req.query;

    if (!userId || !level || !itemName) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const latestResult = await AssessmentResult.findOne(
      { userId, level, itemName },
      {},
      { sort: { date: -1 } }
    );

    if (!latestResult) {
      return res.status(404).json({ error: "No assessment result found" });
    }

    res.json(latestResult);
  } catch (error) {
    console.error("Error fetching latest assessment result:", error);
    res.status(500).json({ error: "Failed to fetch latest assessment result" });
  }
});

// Get details for specific questions by IDs
router.get("/details", authenticateToken, async (req, res) => {
  try {
    const { questionIds, userId } = req.query;

    if (!questionIds) {
      return res.status(400).json({ error: "Question IDs are required" });
    }

    const idArray = questionIds.split(",");

    const questions = await Question.find({
      questionId: { $in: idArray }, userId: userId
    }).select(
      "questionId question options correctAnswer type subject topic subtopic concept"
    );

    res.json(questions);
  } catch (error) {
    console.error("Error fetching question details:", error);
    res.status(500).json({ error: "Failed to fetch question details" });
  }
});

// Get user progress across all subjects
router.get("/progress", authenticateToken, async (req, res) => {
  try {
    // Now req.user will be populated with the decoded token data
    const userId = req.user?._id || req.query.userId || "1";

    // Fetch assessments for the user
    const userAnswers = await UserAnswer.find({ userId }).populate({
      path: "quizId",
      select: "subject topic subtopic concept",
    });

    // Calculate subject scores
    const subjects = {};

    userAnswers.forEach((answer) => {
      if (!answer.quizId?.subject) return;

      const subject = answer.quizId.subject;

      if (!subjects[subject]) {
        subjects[subject] = { correct: 0, total: 0 };
      }

      subjects[subject].total++;
      if (answer.isCorrect) {
        subjects[subject].correct++;
      }
    });

    // Format data for frontend
    const skillData = Object.entries(subjects).map(([subject, data]) => ({
      subject,
      score: Math.round((data.correct / data.total) * 100) || 0,
    }));

    res.json({ skillData });
  } catch (error) {
    console.error("Error fetching user progress:", error);
    res.status(500).json({ error: "Failed to fetch progress data" });
  }
});

// Get user progress for subjects (AssessmentResult model)
router.get("/progress/subjects", authenticateToken, async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Aggregate results for subjects
    const subjectResults = await AssessmentResult.aggregate([
      { $match: { userId, level: "subject" } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: "$itemName",
          latestScore: { $first: "$score" },
          avgScore: { $avg: "$score" },
          attempts: { $sum: 1 },
          latestDate: { $first: "$date" },
        },
      },
      {
        $project: {
          name: "$_id",
          score: "$latestScore",
          avgScore: 1,
          attempts: 1,
          lastAttempt: "$latestDate",
          _id: 0,
        },
      },
    ]);

    res.json(subjectResults);
  } catch (error) {
    console.error("Error fetching subject progress:", error);
    res.status(500).json({ error: "Failed to fetch subject progress data" });
  }
});

// Get topic progress for a specific subject (AssessmentResult model)
router.get("/progress/topics/:subject", authenticateToken, async (req, res) => {
  try {
    const { subject } = req.params;
    const userId = req.user?._id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // First find Quiz records that belong to this subject
    const Quiz = require("../models/Quiz");
    const subjectTopics = await Quiz.find({
      subject: subject,
    }).distinct("topic");

    console.log(`Found ${subjectTopics.length} topics for subject ${subject}`);

    if (subjectTopics.length === 0) {
      return res.json([]);
    }

    // Now query only the assessment results for these topics
    const topicResults = await AssessmentResult.aggregate([
      {
        $match: {
          userId: String(userId),
          level: "topic",
          itemName: { $in: subjectTopics },
        },
      },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: "$itemName",
          latestScore: { $first: "$score" },
          avgScore: { $avg: "$score" },
          attempts: { $sum: 1 },
          latestDate: { $first: "$date" },
        },
      },
      {
        $project: {
          name: "$_id",
          score: "$latestScore",
          avgScore: { $round: ["$avgScore", 2] },
          attempts: 1,
          lastAttempt: "$latestDate",
          _id: 0,
        },
      },
    ]);

    console.log(
      `Found ${topicResults.length} topic results for subject ${subject}`
    );
    res.json(topicResults);
  } catch (error) {
    console.error("Error fetching topic progress:", error);
    res.status(500).json({ error: "Failed to fetch topic progress data" });
  }
});

router.get(
  "/progress/subtopics/:topic",
  authenticateToken,
  async (req, res) => {
    try {
      const topic = req.params.topic; // Use path parameter instead of query param
      const userId = req.user?._id || req.query.userId;

      console.log(`Fetching subtopics for topic:${topic}, userId:${userId}`);

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Use a more efficient approach by querying Quiz first, then fetching only relevant AssessmentResults
      const Quiz = require("../models/Quiz");
      const matchingQuizzes = await Quiz.find({
        topic: topic,
      }).distinct("subtopic");

      console.log(
        `Found ${matchingQuizzes.length} subtopics from quizzes for topic ${topic}`
      );

      if (matchingQuizzes.length === 0) {
        return res.json([]);
      }

      // Now query only the assessment results that match these subtopics
      const subtopicResults = await AssessmentResult.aggregate([
        {
          $match: {
            userId: String(userId),
            level: "subtopic",
            itemName: { $in: matchingQuizzes },
          },
        },
        { $sort: { date: -1 } },
        {
          $group: {
            _id: "$itemName",
            latestScore: { $first: "$score" },
            avgScore: { $avg: "$score" },
            attempts: { $sum: 1 },
          },
        },
        {
          $project: {
            name: "$_id",
            score: "$latestScore",
            avgScore: { $round: ["$avgScore", 2] },
            attempts: 1,
            _id: 0,
          },
        },
      ]);

      console.log(
        `Found ${subtopicResults.length} assessed subtopics that match topic ${topic}`
      );
      res.json(subtopicResults);
    } catch (error) {
      console.error("Error fetching subtopic progress:", error);
      res.status(500).json({ error: "Failed to fetch subtopic progress data" });
    }
  }
);

// Get concept progress for a specific subtopic (AssessmentResult model)
router.get(
  "/progress/concepts/:subtopic",
  authenticateToken,
  async (req, res) => {
    try {
      const subtopic = req.params.subtopic; // Use path parameter instead of query
      const userId = req.user?._id || req.query.userId;

      console.log(
        `Fetching concepts for subtopic:${subtopic}, userId:${userId}`
      );

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // First find Quiz records that connect concepts to the requested subtopic
      const Quiz = require("../models/Quiz");
      const matchingQuizzes = await Quiz.find({
        subtopic: subtopic,
      }).distinct("concept");

      console.log(
        `Found ${matchingQuizzes.length} concepts from quizzes for subtopic ${subtopic}`
      );

      if (matchingQuizzes.length === 0) {
        return res.json([]);
      }

      // Now query only the assessment results that match these concepts
      const conceptResults = await AssessmentResult.aggregate([
        {
          $match: {
            userId: String(userId),
            level: "concept",
            itemName: { $in: matchingQuizzes },
          },
        },
        { $sort: { date: -1 } },
        {
          $group: {
            _id: "$itemName",
            latestScore: { $first: "$score" },
            avgScore: { $avg: "$score" },
            attempts: { $sum: 1 },
          },
        },
        {
          $project: {
            name: "$_id",
            score: "$latestScore",
            avgScore: { $round: ["$avgScore", 2] },
            attempts: 1,
            _id: 0,
          },
        },
      ]);

      console.log(
        `Found ${conceptResults.length} assessed concepts that match subtopic ${subtopic}`
      );
      res.json(conceptResults);
    } catch (error) {
      console.error("Error fetching concept progress:", error);
      res.status(500).json({ error: "Failed to fetch concept progress data" });
    }
  }
);

// Get performance trends
router.get(
  "/performance-trends/:level/:item",
  authenticateToken,
  async (req, res) => {
    try {
      const { level, item } = req.params;
      const userId = req.user?._id || req.query.userId;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Get chronological assessment results for trend analysis
      const results = await AssessmentResult.find({
        userId,
        level,
        itemName: item,
      })
        .sort({ date: 1 })
        .select("score date timeTaken");

      res.json(results);
    } catch (error) {
      console.error("Error fetching performance trends:", error);
      res.status(500).json({ error: "Failed to fetch performance trend data" });
    }
  }
);

// Get assessment results
router.get("/results", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId || "1";
    const level = req.query.level; // Optional filter by level

    let query = { userId };
    if (level) {
      query.level = level;
    }

    const results = await AssessmentResult.find(query).sort({ date: -1 });
    res.json(results);
  } catch (error) {
    console.error("Error fetching assessment results:", error);
    res.status(500).json({ error: "Failed to fetch assessment results" });
  }
});

const BreakEvent = require("../models/BreakEvent");

// Record break notification events
router.post("/break-notification", authenticateToken, async (req, res) => {
  try {
    const { userId, eventType, timestamp } = req.body;

    // Validate input
    if (!userId || !eventType) {
      return res
        .status(400)
        .json({ error: "Missing required fields (userId or eventType)" });
    }

    if (
      !["notification_shown", "break_taken", "break_ignored"].includes(
        eventType
      )
    ) {
      return res.status(400).json({ error: "Invalid event type" });
    }

    // Create a new break event record
    const breakEvent = new BreakEvent({
      userId,
      eventType,
      timestamp: timestamp || Date.now(),
    });

    await breakEvent.save();

    res.status(201).json({ success: true, event: breakEvent });
  } catch (error) {
    console.error("Error storing break notification event:", error);
    res.status(500).json({ error: "Failed to store break notification event" });
  }
});

// Get break notification statistics
router.get("/break-statistics", authenticateToken, async (req, res) => {
  try {
    // Get userId from token or query parameter
    const userId = req.user?._id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Count notifications shown
    const notificationsShown = await BreakEvent.countDocuments({
      userId,
      eventType: "notification_shown",
    });

    // Count breaks taken
    const breaksTaken = await BreakEvent.countDocuments({
      userId,
      eventType: "break_taken",
    });

    // Count breaks ignored
    const breaksIgnored = await BreakEvent.countDocuments({
      userId,
      eventType: "break_ignored",
    });

    // Generate weekly trend data (last 4 weeks)
    const weeklyTrend = await generateWeeklyBreakTrend(userId);

    res.json({
      notificationsShown,
      breaksTaken,
      breaksIgnored,
      weeklyTrend,
    });
  } catch (error) {
    console.error("Error fetching break statistics:", error);
    res.status(500).json({ error: "Failed to fetch break statistics" });
  }
});

// Get detailed break events for a specific time period
router.get("/break-events", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId;
    const { startDate, endDate, eventType } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Build query filter
    const filter = { userId };

    // Add date range if provided
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    // Add event type filter if provided
    if (eventType) {
      filter.eventType = eventType;
    }

    // Get events
    const events = await BreakEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(100); // Limit to prevent large responses

    res.json(events);
  } catch (error) {
    console.error("Error fetching break events:", error);
    res.status(500).json({ error: "Failed to fetch break events" });
  }
});

// Helper function to generate weekly break trend data
async function generateWeeklyBreakTrend(userId) {
  // Get current date and date 4 weeks ago
  const now = new Date();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  // Query all events in the last 4 weeks
  const events = await BreakEvent.find({
    userId,
    timestamp: { $gte: fourWeeksAgo, $lte: now },
  });

  // Group events by week
  const weeklyData = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7 * (i + 1));

    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - 7 * i);

    // Filter events for this week
    const weekEvents = events.filter(
      (event) => event.timestamp >= weekStart && event.timestamp < weekEnd
    );

    weeklyData.unshift({
      week: `Week ${4 - i}`,
      notificationsShown: weekEvents.filter(
        (e) => e.eventType === "notification_shown"
      ).length,
      breaksTaken: weekEvents.filter((e) => e.eventType === "break_taken")
        .length,
      breaksIgnored: weekEvents.filter((e) => e.eventType === "break_ignored")
        .length,
    });
  }

  return weeklyData;
}

// Get break trend insights for a user
router.get("/break-insights", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get overall statistics
    const notificationsShown = await BreakEvent.countDocuments({
      userId,
      eventType: "notification_shown",
    });

    const breaksTaken = await BreakEvent.countDocuments({
      userId,
      eventType: "break_taken",
    });

    // Calculate acceptance rate
    const acceptanceRate =
      notificationsShown > 0
        ? Math.round((breaksTaken / notificationsShown) * 100)
        : 0;

    // Get assessment results before and after breaks to analyze impact
    // This requires coordination with the AssessmentResult model
    // For simplicity, we'll skip this part for now

    res.json({
      totalNotifications: notificationsShown,
      breaksTaken,
      acceptanceRate,
      insight: generateInsightMessage(acceptanceRate, notificationsShown),
    });
  } catch (error) {
    console.error("Error generating break insights:", error);
    res.status(500).json({ error: "Failed to generate break insights" });
  }
});

// Helper function to generate insight message based on user behavior
function generateInsightMessage(acceptanceRate, totalNotifications) {
  if (totalNotifications === 0) {
    return "You haven't received any break notifications yet. This suggests you're maintaining good focus during study sessions.";
  }

  if (acceptanceRate >= 70) {
    return "You're effectively utilizing break recommendations, which helps prevent burnout and improve long-term retention.";
  } else if (acceptanceRate >= 30) {
    return "You're taking some recommended breaks, but consider taking more to optimize your learning efficiency.";
  } else {
    return "Consider taking more of the recommended breaks. Research shows regular breaks improve retention and prevent cognitive fatigue.";
  }
}

// Get assessed and unassessed content for knowledge gap analysis
router.get("/content-analysis/:level", authenticateToken, async (req, res) => {
  try {
    const { level } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!["subject", "topic", "subtopic", "concept"].includes(level)) {
      return res.status(400).json({
        error: "Invalid level. Must be one of: subject, topic, subtopic, concept",
      });
    }

    console.log(`Performing content analysis for ${level} level, user ${userId}`);

    // Handle subject level analysis with new approach
    if (level === "subject") {
  // Step 1: Get all distinct subject names from the Question model
  const allSubjectNames = await Question.distinct("subject", { userId: userId });  
  // Filter out empty/unknown subjects
  const validSubjects = allSubjectNames.filter(
    subject => subject && subject.toLowerCase() !== "unknown" && subject.trim() !== ""
  );
  
  console.log(`Found ${validSubjects.length} distinct subjects in the database`);

  // Step 2: Get all assessments for this user at subject level, sorted by date (newest first)
  const allAssessments = await AssessmentResult.find({
    userId,
    level: "subject"
  }).sort({ date: -1 });

  console.log(`Found ${allAssessments.length} subject-level assessments for user ${userId}`);

  // Step 3: Process each subject to determine if assessed and calculate scores
  const assessedItems = [];
  const unassessedItems = [];

  // Track which subjects we've processed
  const processedSubjects = new Set();

  // Process each valid subject
  for (const subjectName of validSubjects) {
    // Count total questions available for this subject (for metrics)
    const questionCount = await Question.countDocuments({ subject: subjectName, userId: userId });
    
    // Skip if no questions available
    if (questionCount === 0) continue;

    let subjectData = {
      name: subjectName,
      questionCount,
      assessedCount: 0,
      assessedPercentage: 0
    };
    
    // Look through all assessments for the latest one that has data on this subject
    let foundAssessment = false;
    
    for (const assessment of allAssessments) {
      // Skip already processed subjects
      if (processedSubjects.has(subjectName)) continue;
      
      // Case 1: This is a direct subject assessment for this subject
      if (assessment.itemName === subjectName) {
        const correct = assessment.questioninfo?.reduce((sum, q) => 
          q.status === "correct" ? sum + 1 : sum, 0) || 0;
          
        const total = assessment.questioninfo?.length || 0;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        subjectData = {
          ...subjectData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDirect: true,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(subjectData);
        processedSubjects.add(subjectName);
        foundAssessment = true;
        break;
      }
      
      // Case 2: This is an assessment that might contain this subject
      else if (assessment.questioninfo && assessment.questioninfo.length > 0) {
        // Get all questions in this assessment
        const assessmentQuestionIds = assessment.questioninfo.map(q => q.questionId);
        
        // Find which questions in this assessment belong to our subject
        const subjectQuestions = await Question.find({
          questionId: { $in: assessmentQuestionIds },
          subject: subjectName,
          userId: userId
        }).select('questionId');
        
        const subjectQuestionIds = new Set(subjectQuestions.map(q => q.questionId));
        
        // If no questions for this subject in this assessment, continue to next assessment
        if (subjectQuestionIds.size === 0) {
          continue;
        }
        
        // Count correct answers for this subject's questions
        const relevantQuestions = assessment.questioninfo.filter(q => 
          subjectQuestionIds.has(q.questionId)
        );
        
        const total = relevantQuestions.length;
        const correct = relevantQuestions.filter(q => q.status === "correct").length;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        subjectData = {
          ...subjectData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDerived: true,
          derivedFrom: assessment.itemName || "General Assessment",
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(subjectData);
        processedSubjects.add(subjectName);
        foundAssessment = true;
        break;
      }
    }
    
    // If no assessment found for this subject, it's unassessed
    if (!foundAssessment) {
      unassessedItems.push(subjectData);
    }
  }

  // Sort assessed items by score (ascending) to show knowledge gaps first
  assessedItems.sort((a, b) => a.score - b.score);
  
  console.log(`Found ${assessedItems.length} assessed subjects and ${unassessedItems.length} unassessed subjects`);
  
  return res.json({
    assessedItems,
    unassessedItems,
  });
}// Example for topic level - apply same approach to all levels
else if (level === "topic") {
  const { parent } = req.query; // This should be the parent subject name
  
  if (!parent) {
    return res.status(400).json({ error: "Parent subject is required for topic analysis" });
  }
  
  // Step 1: Get all distinct topic names from the Question model that belong to the parent subject
  const allTopicNames = await Question.find({ subject: parent, userId: userId }).distinct("topic");

  // Filter out empty/unknown topics
  const validTopics = allTopicNames.filter(
    topic => topic && topic.toLowerCase() !== "unknown" && topic.trim() !== ""
  );
  
  console.log(`Found ${validTopics.length} distinct topics for subject ${parent}`);
  
  // Step 2: Get ALL assessments that might contain information about these topics
  // Combine direct topic assessments and indirect subject assessments
  const directAssessments = await AssessmentResult.find({
    userId,
    level: "topic",
    itemName: { $in: validTopics }
  }).sort({ date: -1 });
  
  const indirectAssessments = await AssessmentResult.find({
    userId,
    level: "subject",
    itemName: parent
  }).sort({ date: -1 });
  
  // Combine all assessments and sort by date (newest first)
  const allAssessments = [...directAssessments, ...indirectAssessments]
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  console.log(`Found ${allAssessments.length} total assessments that might contain topic data for user ${userId}`);
  
  // Step 3: Process each topic to determine if assessed and calculate scores
  const assessedItems = [];
  const unassessedItems = [];
  
  // Track which topics we've processed
  const processedTopics = new Set();
  
  // Process each valid topic
  for (const topicName of validTopics) {
    // Count total questions available for this topic (for metrics)
    const questionCount = await Question.countDocuments({ subject: parent, topic: topicName, userId: userId });
    
    // Skip if no questions available
    if (questionCount === 0) continue;
    
    let topicData = {
      name: topicName,
      questionCount,
      assessedCount: 0,
      assessedPercentage: 0
    };
    
    // Look through all assessments for the latest one that has data on this topic
    let foundAssessment = false;
    
    for (const assessment of allAssessments) {
      // Skip already processed topics
      if (processedTopics.has(topicName)) continue;
      
      // Case 1: This is a direct topic assessment for this topic
      if (assessment.level === "topic" && assessment.itemName === topicName) {
        const correct = assessment.questioninfo?.reduce((sum, q) => 
          q.status === "correct" ? sum + 1 : sum, 0) || 0;
          
        const total = assessment.questioninfo?.length || 0;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        topicData = {
          ...topicData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDirect: true,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(topicData);
        processedTopics.add(topicName);
        foundAssessment = true;
        break;
      }
      
      // Case 2: This is a subject assessment that might contain this topic
      else if (assessment.level === "subject" && assessment.questioninfo && assessment.questioninfo.length > 0) {
        // Get all questions in this assessment
        const assessmentQuestionIds = assessment.questioninfo.map(q => q.questionId);
        
        // Find which questions in this assessment belong to our topic
        const topicQuestions = await Question.find({
          questionId: { $in: assessmentQuestionIds },
          subject: parent,
          topic: topicName,
          userId: userId
        }).select('questionId');
        
        const topicQuestionIds = new Set(topicQuestions.map(q => q.questionId));
        
        // If no questions for this topic in this assessment, continue to next assessment
        if (topicQuestionIds.size === 0) {
          continue;
        }
        
        // Count correct answers for this topic's questions
        const relevantQuestions = assessment.questioninfo.filter(q => 
          topicQuestionIds.has(q.questionId)
        );
        
        const total = relevantQuestions.length;
        const correct = relevantQuestions.filter(q => q.status === "correct").length;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        topicData = {
          ...topicData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDerived: true,
          derivedFrom: assessment.itemName || "Subject Assessment",
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(topicData);
        processedTopics.add(topicName);
        foundAssessment = true;
        break;
      }
    }
    
    // If no assessment found for this topic, it's unassessed
    if (!foundAssessment) {
      unassessedItems.push(topicData);
    }
  }
  
  // Sort assessed items by score (ascending) to show knowledge gaps first
  assessedItems.sort((a, b) => a.score - b.score);
  
  console.log(`Found ${assessedItems.length} assessed topics and ${unassessedItems.length} unassessed topics`);
  
  return res.json({
    assessedItems,
    unassessedItems,
  });
}
else if (level === "subtopic") {
  const { parent } = req.query; // This should be the parent topic name
  
  if (!parent) {
    return res.status(400).json({ error: "Parent topic is required for subtopic analysis" });
  }
  
  // Step 1: Get all distinct subtopic names under parent topic
  const allSubtopicNames = await Question.find({ topic: parent, userId: userId }).distinct("subtopic");

  // Filter out empty/unknown subtopics
  const validSubtopics = allSubtopicNames.filter(
    subtopic => subtopic && subtopic.toLowerCase() !== "unknown" && subtopic.trim() !== ""
  );
  
  console.log(`Found ${validSubtopics.length} distinct subtopics for topic ${parent}`);
  
  // Find the parent subject for this topic (needed for subject-level indirect assessments)
  const parentSubjectInfo = await Question.findOne({ topic: parent, userId: userId }).select("subject").lean();
  const parentSubject = parentSubjectInfo?.subject;
  
  // Step 2: Get all relevant assessments for this user, sorted by date (newest first)
  
  // Direct subtopic assessments
  const directAssessments = await AssessmentResult.find({
    userId,
    level: "subtopic",
    itemName: { $in: validSubtopics }
  }).sort({ date: -1 });
  
  // Indirect topic-level assessments
  const topicAssessments = await AssessmentResult.find({
    userId,
    level: "topic",
    itemName: parent
  }).sort({ date: -1 });
  
  // Indirect subject-level assessments (if we know the parent subject)
  let subjectAssessments = [];
  if (parentSubject) {
    subjectAssessments = await AssessmentResult.find({
      userId,
      level: "subject",
      itemName: parentSubject
    }).sort({ date: -1 });
  }
  
  // Combine all assessments and sort by date (newest first)
  const allAssessments = [...directAssessments, ...topicAssessments, ...subjectAssessments]
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  console.log(
    `Found ${allAssessments.length} total assessments that might contain subtopic data for user ${userId}`
  );
  
  // Step 3: Process each subtopic to determine if assessed and calculate scores
  const assessedItems = [];
  const unassessedItems = [];
  
  // Track which subtopics we've processed
  const processedSubtopics = new Set();
  
  // Process each valid subtopic
  for (const subtopicName of validSubtopics) {
    // Count total questions available for this subtopic (for metrics)
    const questionCount = await Question.countDocuments({ 
      topic: parent, 
      subtopic: subtopicName,
      userId: userId
    });
    
    // Skip if no questions available
    if (questionCount === 0) continue;
    
    // Base subtopic data
    let subtopicData = {
      name: subtopicName,
      questionCount,
      assessedCount: 0,
      assessedPercentage: 0
    };
    
    // Look through all assessments for the latest one that has data on this subtopic
    let foundAssessment = false;
    
    for (const assessment of allAssessments) {
      // Skip already processed subtopics
      if (processedSubtopics.has(subtopicName)) continue;
      
      // Case 1: This is a direct subtopic assessment for this subtopic
      if (assessment.level === "subtopic" && assessment.itemName === subtopicName) {
        const correct = assessment.questioninfo?.reduce((sum, q) => 
          q.status === "correct" ? sum + 1 : sum, 0) || 0;
          
        const total = assessment.questioninfo?.length || 0;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        subtopicData = {
          ...subtopicData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDirect: true,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(subtopicData);
        processedSubtopics.add(subtopicName);
        foundAssessment = true;
        break;
      }
      
      // Case 2: This is a topic assessment that might contain this subtopic
      else if (assessment.level === "topic" && assessment.itemName === parent 
               && assessment.questioninfo && assessment.questioninfo.length > 0) {
        // Get all questions in this assessment
        const assessmentQuestionIds = assessment.questioninfo.map(q => q.questionId);
        
        // Find which questions in this assessment belong to our subtopic
        const subtopicQuestions = await Question.find({
          questionId: { $in: assessmentQuestionIds },
          topic: parent,
          subtopic: subtopicName,
          userId: userId
        }).select('questionId');
        
        const subtopicQuestionIds = new Set(subtopicQuestions.map(q => q.questionId));
        
        // If no questions for this subtopic in this assessment, continue to next assessment
        if (subtopicQuestionIds.size === 0) continue;
        
        // Count correct answers for this subtopic's questions
        const relevantQuestions = assessment.questioninfo.filter(q => 
          subtopicQuestionIds.has(q.questionId)
        );
        
        const total = relevantQuestions.length;
        const correct = relevantQuestions.filter(q => q.status === "correct").length;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        subtopicData = {
          ...subtopicData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDerived: true,
          derivedFrom: `Topic Assessment: ${assessment.itemName}`,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(subtopicData);
        processedSubtopics.add(subtopicName);
        foundAssessment = true;
        break;
      }
      
      // Case 3: This is a subject assessment that might contain this subtopic
      else if (assessment.level === "subject" && assessment.itemName === parentSubject 
               && assessment.questioninfo && assessment.questioninfo.length > 0) {
        // Get all questions in this assessment
        const assessmentQuestionIds = assessment.questioninfo.map(q => q.questionId);
        
        // Find which questions in this assessment belong to our subtopic
        const subtopicQuestions = await Question.find({
          questionId: { $in: assessmentQuestionIds },
          topic: parent,
          subtopic: subtopicName,
          userId: userId
        }).select('questionId');
        
        const subtopicQuestionIds = new Set(subtopicQuestions.map(q => q.questionId));
        
        // If no questions for this subtopic in this assessment, continue to next assessment
        if (subtopicQuestionIds.size === 0) continue;
        
        // Count correct answers for this subtopic's questions
        const relevantQuestions = assessment.questioninfo.filter(q => 
          subtopicQuestionIds.has(q.questionId)
        );
        
        const total = relevantQuestions.length;
        const correct = relevantQuestions.filter(q => q.status === "correct").length;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        subtopicData = {
          ...subtopicData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDerived: true,
          derivedFrom: `Subject Assessment: ${assessment.itemName}`,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(subtopicData);
        processedSubtopics.add(subtopicName);
        foundAssessment = true;
        break;
      }
    }
    
    // If no assessment found for this subtopic, it's unassessed
    if (!foundAssessment) {
      unassessedItems.push(subtopicData);
    }
  }
  
  // Sort assessed items by score (ascending) to show knowledge gaps first
  assessedItems.sort((a, b) => a.score - b.score);
  
  console.log(`Found ${assessedItems.length} assessed subtopics and ${unassessedItems.length} unassessed subtopics`);
  
  return res.json({
    assessedItems,
    unassessedItems,
  });
}
else if (level === "concept") {
  const { parent } = req.query; // This should be the parent subtopic name
  
  if (!parent) {
    return res.status(400).json({ error: "Parent subtopic is required for concept analysis" });
  }
  
  // Step 1: Get all distinct concept names under parent subtopic
  const allConceptNames = await Question.find({ subtopic: parent, userId: userId }).distinct("concept");

  // Filter out empty/unknown concepts
  const validConcepts = allConceptNames.filter(
    concept => concept && concept.toLowerCase() !== "unknown" && concept.trim() !== ""
  );
  
  console.log(`Found ${validConcepts.length} distinct concepts for subtopic ${parent}`);
  
  if (validConcepts.length === 0) {
    return res.json({
      assessedItems: [],
      unassessedItems: []
    });
  }
  
  // Find the parent topic and subject for this subtopic (needed for indirect assessments)
  const parentInfo = await Question.findOne({ subtopic: parent, userId: userId })
    .select("topic subject")
    .lean();
  
  const topicName = parentInfo?.topic;
  const subjectName = parentInfo?.subject;
  
  console.log(`Parent hierarchy: subtopic=${parent}, topic=${topicName || "unknown"}, subject=${subjectName || "unknown"}`);
  
  // Step 2: Get all relevant assessments for this user, sorted by date (newest first)
  
  // Direct concept assessments
  const conceptAssessments = await AssessmentResult.find({
    userId,
    level: "concept",
    itemName: { $in: validConcepts }
  }).sort({ date: -1 });
  
  // Indirect subtopic-level assessments
  const subtopicAssessments = await AssessmentResult.find({
    userId,
    level: "subtopic",
    itemName: parent
  }).sort({ date: -1 });
  
  // Indirect topic-level assessments (if we know the topic)
  let topicAssessments = [];
  if (topicName) {
    topicAssessments = await AssessmentResult.find({
      userId,
      level: "topic",
      itemName: topicName
    }).sort({ date: -1 });
  }
  
  // Indirect subject-level assessments (if we know the subject)
  let subjectAssessments = [];
  if (subjectName) {
    subjectAssessments = await AssessmentResult.find({
      userId,
      level: "subject",
      itemName: subjectName
    }).sort({ date: -1 });
  }
  
  // Combine all assessments and sort by date (newest first)
  const allAssessments = [
    ...conceptAssessments,
    ...subtopicAssessments,
    ...topicAssessments,
    ...subjectAssessments
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  console.log(
    `Found ${allAssessments.length} total assessments that might contain concept data for user ${userId}`
  );
  
  // Step 3: Process each concept to determine if assessed and calculate scores
  const assessedItems = [];
  const unassessedItems = [];
  
  // Track which concepts we've processed
  const processedConcepts = new Set();
  
  // Process each valid concept
  for (const conceptName of validConcepts) {
    // Count total questions available for this concept (for metrics)
    const questionCount = await Question.countDocuments({ 
      subtopic: parent, 
      concept: conceptName,
      userId: userId
    });
    
    // Skip if no questions available
    if (questionCount === 0) continue;
    
    // Base concept data
    let conceptData = {
      name: conceptName,
      questionCount,
      assessedCount: 0,
      assessedPercentage: 0
    };
    
    // Look through all assessments for the latest one that has data on this concept
    let foundAssessment = false;
    
    for (const assessment of allAssessments) {
      // Skip already processed concepts
      if (processedConcepts.has(conceptName)) continue;
      
      // Case 1: This is a direct concept assessment for this concept
      if (assessment.level === "concept" && assessment.itemName === conceptName) {
        const correct = assessment.questioninfo?.reduce((sum, q) => 
          q.status === "correct" ? sum + 1 : sum, 0) || 0;
          
        const total = assessment.questioninfo?.length || 0;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        conceptData = {
          ...conceptData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDirect: true,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(conceptData);
        processedConcepts.add(conceptName);
        foundAssessment = true;
        break;
      }
      
      // Case 2: This is a subtopic assessment that might contain this concept
      else if (assessment.level === "subtopic" && assessment.itemName === parent 
               && assessment.questioninfo && assessment.questioninfo.length > 0) {
        // Get all questions in this assessment
        const assessmentQuestionIds = assessment.questioninfo.map(q => q.questionId);
        
        // Find which questions in this assessment belong to our concept
        const conceptQuestions = await Question.find({
          questionId: { $in: assessmentQuestionIds },
          subtopic: parent,
          concept: conceptName,
          userId: userId
        }).select('questionId');
        
        const conceptQuestionIds = new Set(conceptQuestions.map(q => q.questionId));
        
        // If no questions for this concept in this assessment, continue to next assessment
        if (conceptQuestionIds.size === 0) continue;
        
        // Count correct answers for this concept's questions
        const relevantQuestions = assessment.questioninfo.filter(q => 
          conceptQuestionIds.has(q.questionId)
        );
        
        const total = relevantQuestions.length;
        const correct = relevantQuestions.filter(q => q.status === "correct").length;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        conceptData = {
          ...conceptData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDerived: true,
          derivedFrom: `Subtopic Assessment: ${assessment.itemName}`,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(conceptData);
        processedConcepts.add(conceptName);
        foundAssessment = true;
        break;
      }
      
      // Case 3: This is a topic assessment that might contain this concept
      else if (assessment.level === "topic" && assessment.itemName === topicName
               && assessment.questioninfo && assessment.questioninfo.length > 0) {
        // Get all questions in this assessment
        const assessmentQuestionIds = assessment.questioninfo.map(q => q.questionId);
        
        // Find which questions in this assessment belong to our concept
        const conceptQuestions = await Question.find({
          questionId: { $in: assessmentQuestionIds },
          subtopic: parent,
          concept: conceptName,
          userId: userId
        }).select('questionId');
        
        const conceptQuestionIds = new Set(conceptQuestions.map(q => q.questionId));
        
        // If no questions for this concept in this assessment, continue to next assessment
        if (conceptQuestionIds.size === 0) continue;
        
        // Count correct answers for this concept's questions
        const relevantQuestions = assessment.questioninfo.filter(q => 
          conceptQuestionIds.has(q.questionId)
        );
        
        const total = relevantQuestions.length;
        const correct = relevantQuestions.filter(q => q.status === "correct").length;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        conceptData = {
          ...conceptData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDerived: true,
          derivedFrom: `Topic Assessment: ${assessment.itemName}`,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(conceptData);
        processedConcepts.add(conceptName);
        foundAssessment = true;
        break;
      }
      
      // Case 4: This is a subject assessment that might contain this concept
      else if (assessment.level === "subject" && assessment.itemName === subjectName
               && assessment.questioninfo && assessment.questioninfo.length > 0) {
        // Get all questions in this assessment
        const assessmentQuestionIds = assessment.questioninfo.map(q => q.questionId);
        
        // Find which questions in this assessment belong to our concept
        const conceptQuestions = await Question.find({
          questionId: { $in: assessmentQuestionIds },
          subject: subjectName,
          topic: topicName,
          subtopic: parent,
          concept: conceptName,
          userId: userId
        }).select('questionId');
        
        const conceptQuestionIds = new Set(conceptQuestions.map(q => q.questionId));
        
        // If no questions for this concept in this assessment, continue to next assessment
        if (conceptQuestionIds.size === 0) continue;
        
        // Count correct answers for this concept's questions
        const relevantQuestions = assessment.questioninfo.filter(q => 
          conceptQuestionIds.has(q.questionId)
        );
        
        const total = relevantQuestions.length;
        const correct = relevantQuestions.filter(q => q.status === "correct").length;
        
        // Calculate score
        const score = total > 0 ? Math.floor((correct / total) * 100) : 0;
        
        conceptData = {
          ...conceptData,
          score,
          totalQuestions: total,
          correctQuestions: correct,
          lastAssessed: assessment.date,
          isDerived: true,
          derivedFrom: `Subject Assessment: ${assessment.itemName}`,
          proficiency: getProficiencyLevel(score)
        };
        
        assessedItems.push(conceptData);
        processedConcepts.add(conceptName);
        foundAssessment = true;
        break;
      }
    }
    
    // If no assessment found for this concept, it's unassessed
    if (!foundAssessment) {
      unassessedItems.push(conceptData);
    }
  }
  
  // Sort assessed items by score (ascending) to show knowledge gaps first
  assessedItems.sort((a, b) => a.score - b.score);
  
  console.log(`Found ${assessedItems.length} assessed concepts and ${unassessedItems.length} unassessed concepts`);
  
  return res.json({
    assessedItems,
    unassessedItems,
  });
}
    else {
      return res.json({
        assessedItems: [],
        unassessedItems: [],
      });
    }
  } catch (error) {
    console.error("Error analyzing content:", error);
    res.status(500).json({ error: "Failed to analyze content" });
  }
});

// Helper function for proficiency levels
function getProficiencyLevel(score) {
  if (score >= 80) return { level: "Mastered", color: "#4CAF50" };
  if (score >= 70) return { level: "Proficient", color: "#8BC34A" };
  if (score >= 55) return { level: "Developing", color: "#FFC107" };
  if (score >= 40) return { level: "Basic", color: "#FF9800" };
  return { level: "Needs Work", color: "#F44336" };
}

// Get details about derived scores
router.get("/derived-score-details", authenticateToken, async (req, res) => {
  try {
    const { userId, level, itemName } = req.query;

    if (!userId || !level || !itemName) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Step 1: Get all questions for this item
    const questionQuery = {};
    questionQuery[level] = itemName;

    const itemQuestions = await Question.find(questionQuery, { userId: userId }).select(
      "questionId subject topic subtopic concept"
    );
    const questionIds = itemQuestions.map((q) => q.questionId);

    const allAssessments = await AssessmentResult.find({
      userId,
      "questioninfo.questionId": { $in: questionIds },
    }).sort({ date: -1 }); // Sort by date descending (newest first)

    // If you only need the single latest assessment:
    const latestAssessment =
      allAssessments.length > 0 ? allAssessments[0] : null;

    // Step 3: Extract the assessed questions for this item
    const assessedQuestions = [];
    const sourceAssessments = [];
    const sourceAssessmentsMap = new Map();

    allAssessments.forEach((assessment) => {
      if (!assessment.questioninfo) return;

      const relevantQuestions = assessment.questioninfo.filter((q) =>
        questionIds.includes(q.questionId)
      );

      if (relevantQuestions.length > 0) {
        // Add this as a source assessment if not already added
        if (!sourceAssessmentsMap.has(assessment._id.toString())) {
          sourceAssessmentsMap.set(assessment._id.toString(), true);
          sourceAssessments.push({
            assessmentId: assessment._id,
            itemName: assessment.itemName,
            level: assessment.level,
            date: assessment.date,
            score: assessment.score,
          });
        }

        // Add the questions with details to our list
        relevantQuestions.forEach((q) => {
          const questionData = itemQuestions.find(
            (iq) => iq.questionId === q.questionId
          );
          assessedQuestions.push({
            questionId: q.questionId,
            status: q.status,
            attempts: q.attempts,
            assessmentId: assessment._id,
            assessmentItemName: assessment.itemName,
            assessmentLevel: assessment.level,
            assessmentDate: assessment.date,
            subject: questionData?.subject,
            topic: questionData?.topic,
            subtopic: questionData?.subtopic,
            concept: questionData?.concept,
          });
        });
      }
    });

    // Step 4: Calculate statistics
    const assessedCount = assessedQuestions.length;
    const correctCount = assessedQuestions.filter(
      (q) => q.status === "correct"
    ).length;
    const totalCount = questionIds.length;

    // Extract statistics from the latest assessment for derived score display
    let latestAssessmentStats = null;
    if (latestAssessment && latestAssessment.questioninfo) {
      // Count total and correctly answered questions in this assessment
      const totalQuestions = latestAssessment.questioninfo.length;
      const correctQuestions = latestAssessment.questioninfo.filter(
        (q) => q.status === "correct"
      ).length;

      // Create a stats object to send to the frontend
      latestAssessmentStats = {
        assessmentId: latestAssessment._id,
        itemName: latestAssessment.itemName,
        level: latestAssessment.level,
        date: latestAssessment.date,
        score: latestAssessment.score,
        totalQuestions,
        correctQuestions,
        // Include these in the response data below
      };
    }

    // Build and return the result
    const result = {
      assessedCount,
      correctCount,
      totalCount,
      assessedQuestions,
      sourceAssessments,
      latestAssessmentStats,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching derived score details:", error);
    res.status(500).json({ error: "Failed to fetch derived score details" });
  }
});

// Get historical assessment data for progress charts
router.get("/historical-scores/:level", authenticateToken, async (req, res) => {
  try {
    const { level } = req.params;
    const { userId, parent } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!["subject", "topic", "subtopic", "concept"].includes(level)) {
      return res.status(400).json({
        error: "Invalid level. Must be one of: subject, topic, subtopic, concept"
      });
    }

    // Special handling for subject level
    if (level === "subject") {
      console.log(`Calculating historical subject averages for user ${userId}`);
      
      // Store historical averages
      const historicalScores = [];
      
      // First get all assessment IDs sorted by date (newest first)
      const allAssessmentIds = await AssessmentResult.find({ 
        userId, 
        level: "subject"
      })
      .sort({ date: -1 })
      .select('_id')
      .lean();
      
      const assessmentIdArray = allAssessmentIds.map(a => a._id);
      
      let skipCount = 0;
        
      // Generate up to 30 historical data points
      for (let i = 0; i < 30; i++) {
        // Skip the i+1 most recent assessments
        
        if (skipCount > assessmentIdArray.length) {
          break; // No more assessments to process
        }
        
        // Get all assessment results excluding the skipCount most recent ones
        const allAssessments = await AssessmentResult.find({ 
          userId, 
          level: "subject",
          _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude the most recent skipCount assessments
        }).sort({ date: -1 });
        
        if (allAssessments.length === 0) {
          break; // No more data to process
        }

        // Get all distinct subject names
        const distinctSubjects = [...new Set(allAssessments.map(a => a.itemName))];
        console.log(`Iteration ${i}: Found ${distinctSubjects.length} distinct subjects after excluding ${skipCount} assessments`);
        
        // Find the most recent assessment for each subject
        const latestAssessments = [];
        
        for (const subjectName of distinctSubjects) {
          // Find most recent assessment for this subject
          const recentAssessment = allAssessments.find(a => 
            a.itemName === subjectName
          );
          
          if (recentAssessment) {
            latestAssessments.push(recentAssessment);
          }
        }
        
        // If no more assessments found for any subject, we're done
        if (latestAssessments.length === 0) {
          break;
        }
        
        // Calculate the average score across subjects
        let totalCorrect = 0;
        let totalQuestions = 0;
        
        latestAssessments.forEach(assessment => {
          const correct = assessment.questioninfo?.reduce((sum, q) => 
            q.status === "correct" ? sum + 1 : sum, 0) || 0;
            
          const total = assessment.questioninfo?.length || 0;
          
          totalCorrect += correct;
          totalQuestions += total;
        });
        
        // Calculate average score
        const averageScore = totalQuestions > 0 
          ? Math.floor((totalCorrect / totalQuestions) * 100) 
          : 0;
        
        // Use the date of the most recent assessment in this batch
        const latestDate = new Date(Math.max(
          ...latestAssessments.map(a => new Date(a.date).getTime())
        ));
        
        historicalScores.push({
          date: latestDate,
          value: averageScore,
          subjectCount: latestAssessments.length,
          totalQuestions: totalQuestions,
          excludedCount: skipCount
        });
        skipCount += 1; // Increment skip count for next iteration
      }
      
      // Sort historical scores by date (oldest to newest)
      historicalScores.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log(`Generated ${historicalScores.length} historical average data points`);
      return res.json(historicalScores);
    } 
    else if (level === "topic" && parent) {
      console.log(`Calculating historical topic averages for user ${userId} under subject ${parent}`);
      
      // Store historical averages
      const historicalScores = [];

      // Step 1: Find all topics under parent subject using Question model
      const Question = require("../models/Question");
      const allTopics = await Question.find({ subject: parent, userId: userId })
        .distinct("topic");

      // Filter out empty or "unknown" topics
      const validTopics = allTopics.filter(topic => 
        topic && topic.toLowerCase() !== "unknown" && topic.trim() !== ""
      );
      
      console.log(`Found ${validTopics.length} topics under subject ${parent}`);
      
      if (validTopics.length === 0) {
        return res.json([]);
      }
      
      // Get all assessment IDs sorted by date (newest first)
      // We need both direct topic assessments AND subject assessments containing these topics
      const allDirectAssessmentIds = await AssessmentResult.find({ 
        userId, 
        level: "topic",
        itemName: { $in: validTopics }
      })
      .sort({ date: -1 })
      .select('_id')
      .lean();
      
      // Also get subject-level assessments for the parent subject
      const allParentAssessmentIds = await AssessmentResult.find({ 
        userId, 
        level: "subject",
        itemName: parent
      })
      .sort({ date: -1 })
      .select('_id')
      .lean();
      
      // Combine and sort all assessment IDs by date
      const allAssessmentIds = [...allDirectAssessmentIds, ...allParentAssessmentIds];
      
      // Sort by date (newest first)
      // Need to handle the sorting differently since we can't use await in a sort callback
      const assessmentDates = {};
      for (const id of allAssessmentIds) {
        const assessment = await AssessmentResult.findById(id._id);
        assessmentDates[id._id] = assessment.date;
      }
      
      allAssessmentIds.sort((a, b) => {
        return new Date(assessmentDates[b._id]) - new Date(assessmentDates[a._id]);
      });
      
      const assessmentIdArray = allAssessmentIds.map(a => a._id);

      let skipCount = 0;
      // Generate up to 30 historical data points
      for (let i = 0; i < 30; i++) {
        
        
        if (skipCount > assessmentIdArray.length) {
          break; // No more assessments to process
        }
        
        // Get all direct topic assessment results excluding the skipCount most recent ones
        const directAssessments = await AssessmentResult.find({ 
          userId, 
          level: "topic",
          itemName: { $in: validTopics },
          _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
        }).sort({ date: -1 });
        
        // Get all subject-level assessments for the parent subject
        const parentAssessments = await AssessmentResult.find({ 
          userId, 
          level: "subject",
          itemName: parent,
          _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
        }).sort({ date: -1 });
        
        // Combine all available assessments
        const allAssessments = [...directAssessments, ...parentAssessments];
        
        // Sort by date (newest first)
        allAssessments.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (allAssessments.length === 0) {
          break; // No more data to process
        }
        
        // Track topics we've already processed
        const processedTopics = new Set();
        
        // Store topic assessment data
        const topicData = {};
        
        // Initialize each topic with 0 counts
        validTopics.forEach(topic => {
          topicData[topic] = { correct: 0, total: 0 };
        });
        
        // Process each assessment to find topic data
        for (const assessment of allAssessments) {
          // If it's a direct topic assessment
          if (assessment.level === "topic" && validTopics.includes(assessment.itemName)) {
            const topicName = assessment.itemName;
            
            // Skip if we already processed this topic
            if (processedTopics.has(topicName)) continue;
            
            // Mark topic as processed
            processedTopics.add(topicName);
            
            // Count correct answers
            const correct = assessment.questioninfo?.reduce((sum, q) => 
              q.status === "correct" ? sum + 1 : sum, 0) || 0;
              
            const total = assessment.questioninfo?.length || 0;
            
            topicData[topicName] = { correct, total };
          }
          // If it's a subject assessment, we need to determine which topics were assessed
          else if (assessment.level === "subject" && assessment.itemName === parent) {
            // For each question in this assessment
            for (const questionInfo of (assessment.questioninfo || [])) {
              // Lookup the question to determine its topic
              const question = await Question.findOne({ questionId: questionInfo.questionId, userId: userId })
                .select("topic");
                
              if (!question || !question.topic) continue;
              
              const topicName = question.topic;
              
              // Skip if not one of our valid topics or already processed
              if (!validTopics.includes(topicName) || processedTopics.has(topicName)) continue;
              
              // Count topic questions in this assessment
              const topicQuestions = await Promise.all(assessment.questioninfo.map(async q => {
                const questionTopic = await Question.findOne({ questionId: q.questionId, userId: userId })
                  .select("topic");
                return questionTopic && questionTopic.topic === topicName ? q : null;
              }));
              
              const filteredQuestions = topicQuestions.filter(q => q !== null);
              
              const topicTotal = filteredQuestions.length;
              const topicCorrect = filteredQuestions.filter(q => q.status === "correct").length;
              
              // If topic found in this assessment, mark as processed
              if (topicTotal > 0) {
                processedTopics.add(topicName);
                topicData[topicName] = { correct: topicCorrect, total: topicTotal };
              }
            }
          }
          
          // If all topics processed, we're done with this batch
          if (processedTopics.size === validTopics.length) {
            break;
          }
        }
        
        // Calculate the average score across topics
        let totalCorrect = 0;
        let totalQuestions = 0;
        
        Object.values(topicData).forEach(data => {
          totalCorrect += data.correct;
          totalQuestions += data.total;
        });
        
        // Calculate average score
        const averageScore = totalQuestions > 0 
          ? Math.floor((totalCorrect / totalQuestions) * 100) 
          : 0;
        
        // Use the date of the most recent assessment in this batch
        const latestDate = allAssessments.length > 0 ? allAssessments[0].date : new Date();
        
        historicalScores.push({
          date: latestDate,
          value: averageScore,
          topicCount: Object.keys(topicData).filter(t => topicData[t].total > 0).length,
          totalQuestions: totalQuestions,
          excludedCount: skipCount
        });
        skipCount++;
      }
      
      // Sort historical scores by date (oldest to newest)
      historicalScores.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log(`Generated ${historicalScores.length} historical average data points for topics`);
      return res.json(historicalScores);
    }
    else if (level === "subtopic" && parent) {
  console.log(`Calculating historical subtopic averages for user ${userId} under topic ${parent}`);
  
  // Store historical averages
  const historicalScores = [];
  
  // Step 1: Find all subtopics under parent topic using Question model
  const Question = require("../models/Question");
  const allSubtopics = await Question.find({ topic: parent, userId: userId })
    .distinct("subtopic");

  // Filter out empty or "unknown" subtopics
  const validSubtopics = allSubtopics.filter(subtopic => 
    subtopic && subtopic.toLowerCase() !== "unknown" && subtopic.trim() !== ""
  );
  
  console.log(`Found ${validSubtopics.length} subtopics under topic ${parent}`);
  
  if (validSubtopics.length === 0) {
    return res.json([]);
  }
  
  // Find the parent subject for this topic
  const parentSubject = await Question.findOne({ topic: parent, userId: userId })
    .select("subject")
    .lean();
  
  const subjectName = parentSubject?.subject;
  console.log(`Parent subject for topic ${parent}: ${subjectName || "unknown"}`);
  
  // Get all assessment IDs sorted by date (newest first)
  // We need to get assessments from three levels: subject, topic, and direct subtopic
  
  // 1. Direct subtopic assessments
  const subtopicAssessmentIds = await AssessmentResult.find({ 
    userId, 
    level: "subtopic",
    itemName: { $in: validSubtopics }
  })
  .sort({ date: -1 })
  .select('_id')
  .lean();
  
  // 2. Parent topic assessments
  const topicAssessmentIds = await AssessmentResult.find({ 
    userId, 
    level: "topic",
    itemName: parent
  })
  .sort({ date: -1 })
  .select('_id')
  .lean();
  
  // 3. Subject-level assessments if we know the subject
  let subjectAssessmentIds = [];
  if (subjectName) {
    subjectAssessmentIds = await AssessmentResult.find({ 
      userId, 
      level: "subject",
      itemName: subjectName
    })
    .sort({ date: -1 })
    .select('_id')
    .lean();
  }
  
  // Combine and sort all assessment IDs by date
  const allAssessmentIds = [
    ...subtopicAssessmentIds, 
    ...topicAssessmentIds, 
    ...subjectAssessmentIds
  ];
  
  // Sort by date (newest first)
  const assessmentDates = {};
  for (const id of allAssessmentIds) {
    const assessment = await AssessmentResult.findById(id._id);
    assessmentDates[id._id] = assessment.date;
  }
  
  allAssessmentIds.sort((a, b) => {
    return new Date(assessmentDates[b._id]) - new Date(assessmentDates[a._id]);
  });
  
  const assessmentIdArray = allAssessmentIds.map(a => a._id);

  let skipCount = 0;
  // Generate up to 30 historical data points
  for (let i = 0; i < 30; i++) {
    if (skipCount > assessmentIdArray.length) {
      break; // No more assessments to process
    }
    
    // Get all direct subtopic assessment results excluding the skipCount most recent ones
    const subtopicAssessments = await AssessmentResult.find({ 
      userId, 
      level: "subtopic",
      itemName: { $in: validSubtopics },
      _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
    }).sort({ date: -1 });
    
    // Get all topic-level assessments for the parent topic
    const topicAssessments = await AssessmentResult.find({ 
      userId, 
      level: "topic",
      itemName: parent,
      _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
    }).sort({ date: -1 });
    
    // Get all subject-level assessments if we know the subject
    let subjectAssessments = [];
    if (subjectName) {
      subjectAssessments = await AssessmentResult.find({ 
        userId, 
        level: "subject",
        itemName: subjectName,
        _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
      }).sort({ date: -1 });
    }
    
    // Combine all available assessments
    const allAssessments = [
      ...subtopicAssessments, 
      ...topicAssessments, 
      ...subjectAssessments
    ];
    
    // Sort by date (newest first)
    allAssessments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (allAssessments.length === 0) {
      break; // No more data to process
    }
    
    // Track subtopics we've already processed
    const processedSubtopics = new Set();
    
    // Store subtopic assessment data
    const subtopicData = {};
    
    // Initialize each subtopic with 0 counts
    validSubtopics.forEach(subtopic => {
      subtopicData[subtopic] = { correct: 0, total: 0 };
    });
    
    // Process each assessment to find subtopic data
    for (const assessment of allAssessments) {
      // Case 1: Direct subtopic assessment
      if (assessment.level === "subtopic" && validSubtopics.includes(assessment.itemName)) {
        const subtopicName = assessment.itemName;
        
        // Skip if we already processed this subtopic
        if (processedSubtopics.has(subtopicName)) continue;
        
        // Mark subtopic as processed
        processedSubtopics.add(subtopicName);
        
        // Count correct answers
        const correct = assessment.questioninfo?.reduce((sum, q) => 
          q.status === "correct" ? sum + 1 : sum, 0) || 0;
          
        const total = assessment.questioninfo?.length || 0;
        
        subtopicData[subtopicName] = { correct, total };
      }
      // Case 2: Topic assessment that might contain our subtopics
      else if (assessment.level === "topic" && assessment.itemName === parent) {
        // For each question in this assessment
        for (const questionInfo of (assessment.questioninfo || [])) {
          // Lookup the question to determine its subtopic
          const question = await Question.findOne({ questionId: questionInfo.questionId, userId: userId })
            .select("subtopic");
            
          if (!question || !question.subtopic) continue;
          
          const subtopicName = question.subtopic;
          
          // Skip if not one of our valid subtopics or already processed
          if (!validSubtopics.includes(subtopicName) || processedSubtopics.has(subtopicName)) continue;
          
          // Count subtopic questions in this assessment
          const subtopicQuestions = await Promise.all(assessment.questioninfo.map(async q => {
            const questionSubtopic = await Question.findOne({ questionId: q.questionId, userId: userId })
              .select("subtopic");
            return questionSubtopic && questionSubtopic.subtopic === subtopicName ? q : null;
          }));
          
          const filteredQuestions = subtopicQuestions.filter(q => q !== null);
          
          const subtopicTotal = filteredQuestions.length;
          const subtopicCorrect = filteredQuestions.filter(q => q.status === "correct").length;
          
          // If subtopic found in this assessment, mark as processed
          if (subtopicTotal > 0) {
            processedSubtopics.add(subtopicName);
            subtopicData[subtopicName] = { correct: subtopicCorrect, total: subtopicTotal };
          }
        }
      }
      // Case 3: Subject assessment that might contain our subtopics
      else if (assessment.level === "subject" && assessment.itemName === subjectName) {
        // For each question in this assessment
        for (const questionInfo of (assessment.questioninfo || [])) {
          // Lookup the question to determine its topic and subtopic
          const question = await Question.findOne({ questionId: questionInfo.questionId , userId: userId})
            .select("topic subtopic");
            
          // Only process if the question belongs to our parent topic and has a subtopic
          if (!question || question.topic !== parent || !question.subtopic) continue;
          
          const subtopicName = question.subtopic;
          
          // Skip if not one of our valid subtopics or already processed
          if (!validSubtopics.includes(subtopicName) || processedSubtopics.has(subtopicName)) continue;
          
          // Count subtopic questions in this assessment
          const subtopicQuestions = await Promise.all(assessment.questioninfo.map(async q => {
            const questionData = await Question.findOne({ questionId: q.questionId, userId: userId })
              .select("topic subtopic");
            return questionData && 
                   questionData.topic === parent && 
                   questionData.subtopic === subtopicName ? q : null;
          }));
          
          const filteredQuestions = subtopicQuestions.filter(q => q !== null);
          
          const subtopicTotal = filteredQuestions.length;
          const subtopicCorrect = filteredQuestions.filter(q => q.status === "correct").length;
          
          // If subtopic found in this assessment, mark as processed
          if (subtopicTotal > 0) {
            processedSubtopics.add(subtopicName);
            subtopicData[subtopicName] = { correct: subtopicCorrect, total: subtopicTotal };
          }
        }
      }
      
      // If all subtopics processed, we're done with this batch
      if (processedSubtopics.size === validSubtopics.length) {
        break;
      }
    }
    
    // Calculate the average score across subtopics
    let totalCorrect = 0;
    let totalQuestions = 0;
    
    Object.values(subtopicData).forEach(data => {
      totalCorrect += data.correct;
      totalQuestions += data.total;
    });
    
    // Calculate average score
    const averageScore = totalQuestions > 0 
      ? Math.floor((totalCorrect / totalQuestions) * 100) 
      : 0;
    
    // Use the date of the most recent assessment in this batch
    const latestDate = allAssessments.length > 0 ? allAssessments[0].date : new Date();
    
    historicalScores.push({
      date: latestDate,
      value: averageScore,
      subtopicCount: Object.keys(subtopicData).filter(t => subtopicData[t].total > 0).length,
      totalQuestions: totalQuestions,
      excludedCount: skipCount
    });
    skipCount++;
  }
  
  // Sort historical scores by date (oldest to newest)
  historicalScores.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  console.log(`Generated ${historicalScores.length} historical average data points for subtopics`);
  return res.json(historicalScores);
}
else if (level === "concept" && parent) {
  console.log(`Calculating historical concept averages for user ${userId} under subtopic ${parent}`);
  
  // Store historical averages
  const historicalScores = [];
  
  // Step 1: Find all concepts under parent subtopic using Question model
  const Question = require("../models/Question");
  const allConcepts = await Question.find({ subtopic: parent, userId: userId })
    .distinct("concept");

  // Filter out empty or "unknown" concepts
  const validConcepts = allConcepts.filter(concept => 
    concept && concept.toLowerCase() !== "unknown" && concept.trim() !== ""
  );
  
  console.log(`Found ${validConcepts.length} concepts under subtopic ${parent}`);
  
  if (validConcepts.length === 0) {
    return res.json([]);
  }
  
  // Find the parent topic and subject for this subtopic
  const parentInfo = await Question.findOne({ subtopic: parent, userId: userId })
    .select("topic subject")
    .lean();
  
  const topicName = parentInfo?.topic;
  const subjectName = parentInfo?.subject;
  
  console.log(`Parent topic: ${topicName || "unknown"}, Subject: ${subjectName || "unknown"}`);
  
  // Get all assessment IDs sorted by date (newest first)
  // We need to get assessments from four levels: subject, topic, subtopic, and direct concept
  
  // 1. Direct concept assessments
  const conceptAssessmentIds = await AssessmentResult.find({ 
    userId, 
    level: "concept",
    itemName: { $in: validConcepts }
  })
  .sort({ date: -1 })
  .select('_id')
  .lean();
  
  // 2. Parent subtopic assessments
  const subtopicAssessmentIds = await AssessmentResult.find({ 
    userId, 
    level: "subtopic",
    itemName: parent
  })
  .sort({ date: -1 })
  .select('_id')
  .lean();
  
  // 3. Grandparent topic assessments (if available)
  let topicAssessmentIds = [];
  if (topicName) {
    topicAssessmentIds = await AssessmentResult.find({ 
      userId, 
      level: "topic",
      itemName: topicName
    })
    .sort({ date: -1 })
    .select('_id')
    .lean();
  }
  
  // 4. Great-grandparent subject assessments (if available)
  let subjectAssessmentIds = [];
  if (subjectName) {
    subjectAssessmentIds = await AssessmentResult.find({ 
      userId, 
      level: "subject",
      itemName: subjectName
    })
    .sort({ date: -1 })
    .select('_id')
    .lean();
  }
  
  // Combine and sort all assessment IDs by date
  const allAssessmentIds = [
    ...conceptAssessmentIds, 
    ...subtopicAssessmentIds, 
    ...topicAssessmentIds,
    ...subjectAssessmentIds
  ];
  
  // Sort by date (newest first)
  const assessmentDates = {};
  for (const id of allAssessmentIds) {
    const assessment = await AssessmentResult.findById(id._id);
    assessmentDates[id._id] = assessment.date;
  }
  
  allAssessmentIds.sort((a, b) => {
    return new Date(assessmentDates[b._id]) - new Date(assessmentDates[a._id]);
  });
  
  const assessmentIdArray = allAssessmentIds.map(a => a._id);

  let skipCount = 0;
  // Generate up to 30 historical data points
  for (let i = 0; i < 30; i++) {
    if (skipCount > assessmentIdArray.length) {
      break; // No more assessments to process
    }
    
    // Get all direct concept assessment results excluding the skipCount most recent ones
    const conceptAssessments = await AssessmentResult.find({ 
      userId, 
      level: "concept",
      itemName: { $in: validConcepts },
      _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
    }).sort({ date: -1 });
    
    // Get all subtopic-level assessments for the parent subtopic
    const subtopicAssessments = await AssessmentResult.find({ 
      userId, 
      level: "subtopic",
      itemName: parent,
      _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
    }).sort({ date: -1 });
    
    // Get all topic-level assessments if we know the topic
    let topicAssessments = [];
    if (topicName) {
      topicAssessments = await AssessmentResult.find({ 
        userId, 
        level: "topic",
        itemName: topicName,
        _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
      }).sort({ date: -1 });
    }
    
    // Get all subject-level assessments if we know the subject
    let subjectAssessments = [];
    if (subjectName) {
      subjectAssessments = await AssessmentResult.find({ 
        userId, 
        level: "subject",
        itemName: subjectName,
        _id: { $nin: assessmentIdArray.slice(0, skipCount) } // Exclude recent
      }).sort({ date: -1 });
    }
    
    // Combine all available assessments
    const allAssessments = [
      ...conceptAssessments, 
      ...subtopicAssessments, 
      ...topicAssessments,
      ...subjectAssessments
    ];
    
    // Sort by date (newest first)
    allAssessments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (allAssessments.length === 0) {
      break; // No more data to process
    }
    
    // Track concepts we've already processed
    const processedConcepts = new Set();
    
    // Store concept assessment data
    const conceptData = {};
    
    // Initialize each concept with 0 counts
    validConcepts.forEach(concept => {
      conceptData[concept] = { correct: 0, total: 0 };
    });
    
    // Process each assessment to find concept data
    for (const assessment of allAssessments) {
      // Case 1: Direct concept assessment
      if (assessment.level === "concept" && validConcepts.includes(assessment.itemName)) {
        const conceptName = assessment.itemName;
        
        // Skip if we already processed this concept
        if (processedConcepts.has(conceptName)) continue;
        
        // Mark concept as processed
        processedConcepts.add(conceptName);
        
        // Count correct answers
        const correct = assessment.questioninfo?.reduce((sum, q) => 
          q.status === "correct" ? sum + 1 : sum, 0) || 0;
          
        const total = assessment.questioninfo?.length || 0;
        
        conceptData[conceptName] = { correct, total };
      }
      // Case 2: Subtopic assessment that might contain our concepts
      else if (assessment.level === "subtopic" && assessment.itemName === parent) {
        // For each question in this assessment
        for (const questionInfo of (assessment.questioninfo || [])) {
          // Lookup the question to determine its concept
          const question = await Question.findOne({ questionId: questionInfo.questionId, userId: userId })
            .select("concept");
            
          if (!question || !question.concept) continue;
          
          const conceptName = question.concept;
          
          // Skip if not one of our valid concepts or already processed
          if (!validConcepts.includes(conceptName) || processedConcepts.has(conceptName)) continue;
          
          // Count concept questions in this assessment
          const conceptQuestions = await Promise.all(assessment.questioninfo.map(async q => {
            const questionConcept = await Question.findOne({ questionId: q.questionId, userId: userId })
              .select("concept");
            return questionConcept && questionConcept.concept === conceptName ? q : null;
          }));
          
          const filteredQuestions = conceptQuestions.filter(q => q !== null);
          
          const conceptTotal = filteredQuestions.length;
          const conceptCorrect = filteredQuestions.filter(q => q.status === "correct").length;
          
          // If concept found in this assessment, mark as processed
          if (conceptTotal > 0) {
            processedConcepts.add(conceptName);
            conceptData[conceptName] = { correct: conceptCorrect, total: conceptTotal };
          }
        }
      }
      // Case 3: Topic assessment that might contain our concepts
      else if (assessment.level === "topic" && assessment.itemName === topicName) {
        // For each question in this assessment
        for (const questionInfo of (assessment.questioninfo || [])) {
          // Lookup the question to determine its subtopic and concept
          const question = await Question.findOne({ questionId: questionInfo.questionId, userId: userId })
            .select("subtopic concept");
            
          // Only process if the question belongs to our parent subtopic and has a concept
          if (!question || question.subtopic !== parent || !question.concept) continue;
          
          const conceptName = question.concept;
          
          // Skip if not one of our valid concepts or already processed
          if (!validConcepts.includes(conceptName) || processedConcepts.has(conceptName)) continue;
          
          // Count concept questions in this assessment
          const conceptQuestions = await Promise.all(assessment.questioninfo.map(async q => {
            const questionData = await Question.findOne({ questionId: q.questionId, userId: userId })
              .select("subtopic concept");
            return questionData && 
                   questionData.subtopic === parent && 
                   questionData.concept === conceptName ? q : null;
          }));
          
          const filteredQuestions = conceptQuestions.filter(q => q !== null);
          
          const conceptTotal = filteredQuestions.length;
          const conceptCorrect = filteredQuestions.filter(q => q.status === "correct").length;
          
          // If concept found in this assessment, mark as processed
          if (conceptTotal > 0) {
            processedConcepts.add(conceptName);
            conceptData[conceptName] = { correct: conceptCorrect, total: conceptTotal };
          }
        }
      }
      // Case 4: Subject assessment that might contain our concepts
      else if (assessment.level === "subject" && assessment.itemName === subjectName) {
        // For each question in this assessment
        for (const questionInfo of (assessment.questioninfo || [])) {
          // Lookup the question to determine its topic, subtopic, and concept
          const question = await Question.findOne({ questionId: questionInfo.questionId, userId: userId })
            .select("topic subtopic concept");
            
          // Only process if the question belongs to our hierarchy and has a concept
          if (!question || question.topic !== topicName || question.subtopic !== parent || !question.concept) continue;
          
          const conceptName = question.concept;
          
          // Skip if not one of our valid concepts or already processed
          if (!validConcepts.includes(conceptName) || processedConcepts.has(conceptName)) continue;
          
          // Count concept questions in this assessment
          const conceptQuestions = await Promise.all(assessment.questioninfo.map(async q => {
            const questionData = await Question.findOne({ questionId: q.questionId, userId: userId })
              .select("topic subtopic concept");
            return questionData && 
                   questionData.topic === topicName &&
                   questionData.subtopic === parent && 
                   questionData.concept === conceptName ? q : null;
          }));
          
          const filteredQuestions = conceptQuestions.filter(q => q !== null);
          
          const conceptTotal = filteredQuestions.length;
          const conceptCorrect = filteredQuestions.filter(q => q.status === "correct").length;
          
          // If concept found in this assessment, mark as processed
          if (conceptTotal > 0) {
            processedConcepts.add(conceptName);
            conceptData[conceptName] = { correct: conceptCorrect, total: conceptTotal };
          }
        }
      }
      
      // If all concepts processed, we're done with this batch
      if (processedConcepts.size === validConcepts.length) {
        break;
      }
    }
    
    // Calculate the average score across concepts
    let totalCorrect = 0;
    let totalQuestions = 0;
    
    Object.values(conceptData).forEach(data => {
      totalCorrect += data.correct;
      totalQuestions += data.total;
    });
    
    // Calculate average score
    const averageScore = totalQuestions > 0 
      ? Math.floor((totalCorrect / totalQuestions) * 100) 
      : 0;
    
    // Use the date of the most recent assessment in this batch
    const latestDate = allAssessments.length > 0 ? allAssessments[0].date : new Date();
    
    historicalScores.push({
      date: latestDate,
      value: averageScore,
      conceptCount: Object.keys(conceptData).filter(t => conceptData[t].total > 0).length,
      totalQuestions: totalQuestions,
      excludedCount: skipCount
    });
    skipCount++;
  }
  
  // Sort historical scores by date (oldest to newest)
  historicalScores.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  console.log(`Generated ${historicalScores.length} historical average data points for concepts`);
  return res.json(historicalScores);
}
  } catch (error) {
    console.error("Error calculating historical scores:", error);
    res.status(500).json({ error: "Failed to calculate historical scores" });
  }
});

module.exports = router;
