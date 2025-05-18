const mongoose = require("mongoose");
const Quiz = require("../models/Quiz");
const Question = require("../models/Question");
const { runPythonProcess } = require("../utils/pythonRunner");
const UserAnswer = require("../models/UserAnswer");

// Get all unique subjects from quizzes for the logged-in user
const getSubjects = async (req, res) => {
  try {
    const userId = req.user.userId; // Get user ID from authenticated token
    console.log(`Fetching subjects for user ${userId}`);

    // Filter quizzes by userId or where userId includes the current user
    const subjects = await Quiz.distinct("subject", {
      $or: [{ userId: userId }],
    });

    // Filter out null, undefined, or empty subjects
    const validSubjects = subjects.filter(
      (subject) => subject && subject !== "Unknown" && subject.trim() !== ""
    );

    res.json({ subjects: validSubjects });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
};

// Get topics by subject for the logged-in user
const getTopicsBySubject = async (req, res) => {
  try {
    const { subject } = req.params;
    const userId = req.user.userId; // Get user ID from authenticated token

    console.log(
      `Looking for topics under subject: "${subject}" for user ${userId}`
    );

    // Use case-insensitive regex for the subject and filter by user
    const topics = await Quiz.distinct("topic", {
      subject: { $regex: new RegExp(subject, "i") },
      $or: [{ userId: userId }],
    });

    console.log(
      `Found ${topics.length} topics for subject "${subject}" for user ${userId}`
    );

    // Filter out null, undefined, or empty topics
    const validTopics = topics.filter(
      (topic) => topic && topic !== "Unknown" && topic.trim() !== ""
    );

    res.json({ topics: validTopics });
  } catch (error) {
    console.error(
      `Error fetching topics for subject ${req.params.subject}:`,
      error
    );
    res.status(500).json({ error: "Failed to fetch topics" });
  }
};

// Get subtopics by topic for the logged-in user
const getSubtopicsByTopic = async (req, res) => {
  try {
    const { topic } = req.params;
    const userId = req.user.userId; // Get user ID from authenticated token

    const subtopics = await Quiz.distinct("subtopic", {
      topic: { $regex: new RegExp(topic, "i") },
      $or: [{ userId: userId }],
    });

    // Filter out null, undefined, or empty subtopics
    const validSubtopics = subtopics.filter(
      (subtopic) => subtopic && subtopic !== "Unknown" && subtopic.trim() !== ""
    );

    res.json({ subtopics: validSubtopics });
  } catch (error) {
    console.error(
      `Error fetching subtopics for topic ${req.params.topic}:`,
      error
    );
    res.status(500).json({ error: "Failed to fetch subtopics" });
  }
};

// Get concepts by subtopic for the logged-in user
const getConceptsBySubtopic = async (req, res) => {
  try {
    const { subtopic } = req.params;
    const userId = req.user.userId; // Get user ID from authenticated token

    const concepts = await Quiz.distinct("concept", {
      subtopic: { $regex: new RegExp(subtopic, "i") },
      $or: [{ userId: userId }],
    });

    // Filter out null, undefined, or empty concepts
    const validConcepts = concepts.filter(
      (concept) => concept && concept !== "Unknown" && concept.trim() !== ""
    );

    res.json({ concepts: validConcepts });
  } catch (error) {
    console.error(
      `Error fetching concepts for subtopic ${req.params.subtopic}:`,
      error
    );
    res.status(500).json({ error: "Failed to fetch concepts" });
  }
};

// Helper function to get questions with assessment history consideration
async function getQuestionsWithHistory(
  query,
  userId,
  numQuestions,
  considerHistory = true
) {
  if (!considerHistory) {
    // Just return questions without considering history
    return await Question.find(query)
      .select(
        "question options correctAnswer questionId quizeRef type topic subtopic concept"
      )
      .limit(numQuestions)
      .exec();
  }

  // Get the assessment history
  const AssessmentResult = mongoose.model("AssessmentResult");

  // Get assessment records for this user
  const assessmentResults = await AssessmentResult.find({
    userId: userId,
  });

  // Create a map of questionId => {attempts, incorrect count}
  const questionStats = {};

  // Process all assessment results to build our stats map
  assessmentResults.forEach((result) => {
    if (result.questioninfo && Array.isArray(result.questioninfo)) {
      result.questioninfo.forEach((info) => {
        if (!questionStats[info.questionId]) {
          questionStats[info.questionId] = {
            attempts: 0,
            incorrectCount: 0,
          };
        }

        // Add the attempts
        questionStats[info.questionId].attempts += info.attempts || 1;

        // Count incorrect/partial answers
        if (info.status === "incorrect" || info.status === "partial") {
          questionStats[info.questionId].incorrectCount += 1;
        }
      });
    }
  });

  // Get all questions matching the query
  const allMatchingQuestions = await Question.find(query)
    .select(
      "question options correctAnswer questionId quizeRef type topic subtopic concept"
    )
    .exec();

  // Separate questions into never asked vs previously asked
  const neverAskedQuestions = [];
  const previouslyAskedQuestions = [];

  allMatchingQuestions.forEach((question) => {
    if (!questionStats[question.questionId]) {
      neverAskedQuestions.push(question);
    } else {
      // Add stats to the question object for sorting
      question._stats = questionStats[question.questionId];
      previouslyAskedQuestions.push(question);
    }
  });

  console.log(
    `Found ${neverAskedQuestions.length} never asked questions and ${previouslyAskedQuestions.length} previously asked questions`
  );

  // Sort previously asked questions by attempts (ascending) and then by incorrect rate (descending)
  previouslyAskedQuestions.sort((a, b) => {
    // First compare by attempts
    if (a._stats.attempts !== b._stats.attempts) {
      return a._stats.attempts - b._stats.attempts; // Ascending by attempts
    }

    // If attempts are equal, compare by incorrect count
    const aIncorrectRate = a._stats.incorrectCount / a._stats.attempts;
    const bIncorrectRate = b._stats.incorrectCount / b._stats.attempts;
    return bIncorrectRate - aIncorrectRate; // Descending by incorrect rate
  });

  // Combine never asked questions first, then previously asked questions
  const finalQuestions = [
    ...neverAskedQuestions,
    ...previouslyAskedQuestions,
  ].slice(0, numQuestions);

  // Remove the _stats property before returning
  finalQuestions.forEach((question) => {
    delete question._stats;
  });

  return finalQuestions;
}

// Update each of the getQuestions methods to use our new helper function
// Here's how to update getQuestionsBySubject:

const getQuestionsBySubject = async (req, res) => {
  try {
    const { subject } = req.params;
    const {
      numQuestions,
      difficulty,
      questionTypes,
      selectedItems,
      considerHistory = "true",
    } = req.query;
    const userId = req.user.userId;

    console.log(
      `Fetching questions for subject "${subject}" with params:`,
      req.query
    );

    // Base query
    const questionQuery = {
      subject: { $regex: `^${subject}$`, $options: "i" },
      userId: userId,
    };

    // Add difficulty filter
    if (difficulty && difficulty !== "mixed") {
      questionQuery.difficulty = difficulty;
    }

    // Add question type filter
    if (questionTypes && questionTypes.split(",").length > 0) {
      const types = questionTypes.split(",");
      questionQuery.type = { $in: types };
    }

    // Filter by selected topics if provided
    if (selectedItems && selectedItems.trim() !== "") {
      const items = selectedItems
        .split(",")
        .map((item) => decodeURIComponent(item.trim()));
      if (items.length > 0) {
        console.log(`Filtering by topics: ${items.join(", ")}`);
        questionQuery.topic = { $in: items, $ne: null };
      }
    }

    // Use our new helper function to get questions with history consideration
    const questions = await getQuestionsWithHistory(
      questionQuery,
      userId,
      numQuestions ? parseInt(numQuestions) : 10,
      considerHistory === "true"
    );

    console.log(`Found ${questions.length} questions for subject "${subject}"`);

    res.json({
      count: questions.length,
      subject,
      questions,
    });
  } catch (error) {
    console.error(
      `Error fetching questions for subject "${req.params.subject}":`,
      error
    );
    res.status(500).json({
      error: `Failed to fetch questions: ${error.message}`,
      subject: req.params.subject,
    });
  }
};

const getQuestionsByTopic = async (req, res) => {
  try {
    const { topic } = req.params;
    const {
      numQuestions,
      difficulty,
      questionTypes,
      selectedItems,
      considerHistory = "true",
    } = req.query;
    const userId = req.user.userId; // Get user ID from authenticated token

    console.log(
      `Fetching questions for topic "${topic}" with params:`,
      req.query
    );

    // Log all available subtopics for the topic in the database
    const availableSubtopics = await Question.distinct("subtopic", {
      topic: { $regex: `^${topic}$`, $options: "i" },
    });
    console.log(
      `Available subtopics for topic "${topic}":`,
      availableSubtopics
    );

    // Base query
    const questionQuery = {
      topic: { $regex: `^${topic}$`, $options: "i" }, // Exact topic match
      userId: userId, // Simplified from $or
    };

    // Add difficulty filter
    if (difficulty && difficulty !== "mixed") {
      questionQuery.difficulty = difficulty;
    }

    // Add question type filter
    if (questionTypes && questionTypes.split(",").length > 0) {
      const types = questionTypes.split(",");
      questionQuery.type = { $in: types };
    }

    // Filter by selected subtopics if provided
    if (selectedItems && selectedItems.trim() !== "") {
      const items = selectedItems
        .split(",")
        .map((item) => decodeURIComponent(item.trim()));
      if (items.length > 0) {
        console.log(`Filtering by subtopics: ${items.join(", ")}`);
        // Use $in for exact subtopic matching, exclude covering null/undefined
        questionQuery.subtopic = { $in: items, $ne: null };
        console.log("Subtopic filter:", JSON.stringify(questionQuery.subtopic));
      }
    } else {
      console.log("No subtopics provided; fetching all questions for topic.");
    }

    // Use our new helper function to get questions with history consideration
    const questions = await getQuestionsWithHistory(
      questionQuery,
      userId,
      numQuestions ? parseInt(numQuestions) : 10,
      considerHistory === "true"
    );

    console.log(`Found ${questions.length} questions for topic "${topic}"`);

    res.json({
      count: questions.length,
      topic,
      questions,
    });
  } catch (error) {
    console.error(
      `Error fetching questions for topic "${req.params.topic}":`,
      error
    );
    res.status(500).json({
      error: `Failed to fetch questions: ${error.message}`,
      topic: req.params.topic,
    });
  }
};

const getQuestionsBySubtopic = async (req, res) => {
  try {
    const { subtopic } = req.params;
    const {
      numQuestions,
      difficulty,
      questionTypes,
      selectedItems,
      considerHistory = "true",
    } = req.query;
    const userId = req.user.userId; // Get user ID from authenticated token

    console.log(
      `Fetching questions for subtopic "${subtopic}" with params:`,
      req.query
    );

    // Log all available concepts for the subtopic in the database
    const availableConcepts = await Question.distinct("concept", {
      subtopic: { $regex: `^${subtopic}$`, $options: "i" },
    });
    console.log(
      `Available concepts for subtopic "${subtopic}":`,
      availableConcepts
    );

    // Base query
    const questionQuery = {
      subtopic: { $regex: `^${subtopic}$`, $options: "i" }, // Exact subtopic match
      userId: userId, // Simplified from $or
    };

    // Add difficulty filter
    if (difficulty && difficulty !== "mixed") {
      questionQuery.difficulty = difficulty;
    }

    // Add question type filter
    if (questionTypes && questionTypes.split(",").length > 0) {
      const types = questionTypes.split(",");
      questionQuery.type = { $in: types };
    }

    // Filter by selected concepts if provided
    if (selectedItems && selectedItems.trim() !== "") {
      const items = selectedItems
        .split(",")
        .map((item) => decodeURIComponent(item.trim()));
      if (items.length > 0) {
        console.log(`Filtering by concepts: ${items.join(", ")}`);
        // Use $in for exact concept matching, exclude null/undefined
        questionQuery.concept = { $in: items, $ne: null };
        console.log("Concept filter:", JSON.stringify(questionQuery.concept));
      }
    } else {
      console.log("No concepts provided; fetching all questions for subtopic.");
    }

    // Use our new helper function to get questions with history consideration
    const questions = await getQuestionsWithHistory(
      questionQuery,
      userId,
      numQuestions ? parseInt(numQuestions) : 10,
      considerHistory === "true"
    );

    console.log(
      `Found ${questions.length} questions for subtopic "${subtopic}"`
    );

    res.json({
      count: questions.length,
      subtopic,
      questions,
    });
  } catch (error) {
    console.error(
      `Error fetching questions for subtopic "${req.params.subtopic}":`,
      error
    );
    res.status(500).json({
      error: `Failed to fetch questions: ${error.message}`,
      subtopic: req.params.subtopic,
    });
  }
};

const getQuestionsByConcept = async (req, res) => {
  try {
    const { concept } = req.params;
    const {
      numQuestions,
      difficulty,
      questionTypes,
      includeSubItems,
      considerHistory = "true",
    } = req.query;
    const userId = req.user.userId; // Get user ID from authenticated token

    console.log(
      "Looking for concept:",
      concept,
      "with params:",
      req.query,
      "for user:",
      userId
    );

    // Build the query
    let questionQuery = {
      $or: [{ userId: userId }],
    };

    if (includeSubItems === "true") {
      // Fetch the concept's details to get subtopic and topic
      const conceptInfo = await Quiz.findOne({
        concept: {
          $regex: new RegExp(
            concept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i"
          ),
        },
        $or: [{ userId: userId }],
      });

      if (conceptInfo) {
        // Query will match questions with same topic and subtopic
        questionQuery.$and = [
          {
            $or: [
              // Exact concept match
              {
                concept: {
                  $regex: new RegExp(
                    concept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                    "i"
                  ),
                },
              },
              // Same subtopic
              { subtopic: conceptInfo.subtopic },
            ],
          },
        ];
      } else {
        questionQuery.$and = [
          {
            concept: {
              $regex: new RegExp(
                concept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i"
              ),
            },
          },
        ];
      }
    } else {
      // Just match the exact concept
      questionQuery.$and = [
        {
          concept: {
            $regex: new RegExp(
              concept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i"
            ),
          },
        },
      ];
    }

    // Add difficulty filter if provided
    if (difficulty && difficulty !== "mixed") {
      questionQuery.difficulty = difficulty;
    }

    // Add question type filter if provided
    if (questionTypes && questionTypes.split(",").length > 0) {
      const types = questionTypes.split(",");
      questionQuery.type = { $in: types };
    }

    // Use our new helper function to get questions with history consideration
    const questions = await getQuestionsWithHistory(
      questionQuery,
      userId,
      numQuestions ? parseInt(numQuestions) : 10,
      considerHistory === "true"
    );

    console.log(`Found ${questions.length} questions for concept "${concept}"`);

    res.json({
      count: questions.length,
      concept,
      questions,
    });
  } catch (error) {
    console.error(
      `Error fetching questions for concept "${req.params.concept}":`,
      error
    );
    res.status(500).json({
      error: `Failed to fetch questions: ${error.message}`,
      concept: req.params.concept,
    });
  }
};

// Unified category rename function with transaction support
// Only allow users to rename their own categories
const renameCategory = async (req, res) => {
  // Start session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { categoryType } = req.params;
    const { oldName, newName, parentCategory, parentValue } = req.body;
    const userId = req.user.userId; // Get user ID from authenticated token

    // Validate inputs
    if (!oldName || !newName) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        error: "Both oldName and newName are required parameters",
      });
    }

    // Validate category type
    const validCategories = ["subject", "topic", "subtopic", "concept"];
    if (!validCategories.includes(categoryType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        error: `Invalid category type. Must be one of: ${validCategories.join(
          ", "
        )}`,
      });
    }

    console.log(
      `Renaming ${categoryType} from '${oldName}' to '${newName}' for user ${userId}`
    );

    // Build initial query with exact match and user filter
    const query = {
      [categoryType]: oldName,
      userId: userId,
    };

    // Add parent category constraint if provided
    if (parentCategory && parentValue) {
      query[parentCategory] = parentValue;
    }

    console.log("Exact match query:", JSON.stringify(query));

    // Update with exact match first
    const quizResult = await Quiz.updateMany(
      query,
      { $set: { [categoryType]: newName } },
      { session }
    );

    const questionResult = await Question.updateMany(
      query,
      { $set: { [categoryType]: newName } },
      { session }
    );

    // Also update AssessmentResult where level matches the category type and itemName matches oldName
    const AssessmentResult = mongoose.model("AssessmentResult");
    const assessmentResult = await AssessmentResult.updateMany(
      {
        level: categoryType,
        itemName: oldName,
        userId: userId, // Ensure we only update the user's own records
      },
      { $set: { itemName: newName } },
      { session }
    );

    console.log("Exact match results:", {
      quizMatch: quizResult.matchedCount,
      quizModified: quizResult.modifiedCount,
      questionMatch: questionResult.matchedCount,
      questionModified: questionResult.modifiedCount,
      assessmentMatch: assessmentResult.matchedCount,
      assessmentModified: assessmentResult.modifiedCount,
    });

    // If exact match didn't find anything, try case-insensitive match
    if (
      quizResult.matchedCount === 0 &&
      questionResult.matchedCount === 0 &&
      assessmentResult.matchedCount === 0
    ) {
      // Create properly escaped regex patterns, still filtering by userId
      const regexQuery = {
        [categoryType]: new RegExp(oldName, "i"),
        userId: userId,
      };

      // Add parent constraint to regex query if provided
      if (parentCategory && parentValue) {
        regexQuery[parentCategory] = new RegExp(parentValue, "i");
      }

      console.log(
        "Regex query:",
        JSON.stringify(regexQuery, (key, value) =>
          value instanceof RegExp ? value.toString() : value
        )
      );

      const quizRegexResult = await Quiz.updateMany(
        regexQuery,
        { $set: { [categoryType]: newName } },
        { session }
      );

      const questionRegexResult = await Question.updateMany(
        regexQuery,
        { $set: { [categoryType]: newName } },
        { session }
      );

      const assessmentRegexQuery = {
        level: categoryType,
        itemName: new RegExp(oldName, "i"),
        userId: userId,
      };

      const assessmentRegexResult = await AssessmentResult.updateMany(
        assessmentRegexQuery,
        { $set: { itemName: newName } },
        { session }
      );

      console.log("Regex results:", {
        quizMatch: quizRegexResult.matchedCount,
        quizModified: quizRegexResult.modifiedCount,
        questionMatch: questionRegexResult.matchedCount,
        questionModified: questionRegexResult.modifiedCount,
        assessmentMatch: assessmentRegexResult.matchedCount,
        assessmentModified: assessmentRegexResult.modifiedCount,
      });

      // Update our results with regex results
      if (
        quizRegexResult.matchedCount > 0 ||
        questionRegexResult.matchedCount > 0 ||
        assessmentRegexResult.matchedCount > 0
      ) {
        quizResult.matchedCount = quizRegexResult.matchedCount;
        quizResult.modifiedCount = quizRegexResult.modifiedCount;
        questionResult.matchedCount = questionRegexResult.matchedCount;
        questionResult.modifiedCount = questionRegexResult.modifiedCount;
        assessmentResult.matchedCount = assessmentRegexResult.matchedCount;
        assessmentResult.modifiedCount = assessmentRegexResult.modifiedCount;
      }
    }
    // Try to update TopicMastery if applicable, filtering by userId
    let topicMasteryResult = { matchedCount: 0, modifiedCount: 0 };
    if (categoryType === "subject" || categoryType === "topic") {
      try {
        const TopicMastery = mongoose.model("TopicMastery");
        topicMasteryResult = await TopicMastery.updateMany(
          { [categoryType]: oldName, userId: userId },
          { $set: { [categoryType]: newName } },
          { session }
        );
      } catch (err) {
        console.log(`TopicMastery update skipped: ${err.message}`);
      }
    }

    // Check if any documents were found and updated
    if (
      quizResult.matchedCount === 0 &&
      questionResult.matchedCount === 0 &&
      topicMasteryResult.matchedCount === 0
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        error: `No documents found with ${categoryType} '${oldName}' that belong to you`,
        suggestion: `You can only rename your own content`,
      });
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: `${
        categoryType.charAt(0).toUpperCase() + categoryType.slice(1)
      } '${oldName}' renamed to '${newName}'`,
      newName,
      stats: {
        quizDocumentsMatched: quizResult.matchedCount,
        quizDocumentsModified: quizResult.modifiedCount,
        questionDocumentsMatched: questionResult.matchedCount,
        questionDocumentsModified: questionResult.modifiedCount,
        topicMasteryDocumentsModified: topicMasteryResult.modifiedCount || 0,
        assessmentResultDocumentsMatched: assessmentResult.matchedCount,
        assessmentResultDocumentsModified: assessmentResult.modifiedCount,
      },
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error(`Error renaming ${req.params.categoryType}:`, error);
    res.status(500).json({
      error: `Failed to rename ${req.params.categoryType}: ${error.message}`,
    });
  }
};

// Unified category delete function with transaction support
// Only allow users to delete their own categories
const deleteCategory = async (req, res) => {
  // Start session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { categoryType, name } = req.params;
    const { parentCategory, parentValue } = req.query;
    const userId = req.user.userId; // Get user ID from authenticated token

    // Validate category type
    const validCategories = ["subject", "topic", "subtopic", "concept"];
    if (!validCategories.includes(categoryType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        error: `Invalid category type. Must be one of: ${validCategories.join(
          ", "
        )}`,
      });
    }

    console.log(`Deleting ${categoryType}: '${name}' for user ${userId}`);

    // Build query with exact match and user filter
    const query = {
      [categoryType]: name,
      userId: userId, // Only allow deleting user's own items
    };

    // Add parent category constraint if provided
    if (parentCategory && parentValue) {
      query[parentCategory] = parentValue;
    }

    // Find questions to delete
    const questionsToDelete = await Question.find(query).select(
      "_id questionId"
    );
    const questionIds = questionsToDelete.map((q) => q.questionId);

    // Delete questions
    const questionResult = await Question.deleteMany(query, { session });

    // Delete quizzes with no remaining questions
    const quizResult = await Quiz.deleteMany(query, { session });

    // Delete associated AssessmentResult entries
    const AssessmentResult = mongoose.model("AssessmentResult");

    // 1. Delete assessment results for this specific category
    const categoryAssessmentResult = await AssessmentResult.deleteMany(
      {
        level: categoryType,
        itemName: name,
        userId: userId,
      },
      { session }
    );

    // 2. Remove question info entries from AssessmentResults that reference deleted questions
    // First find any AssessmentResult documents that contain these questions
    const assessmentResultsToUpdate = await AssessmentResult.find({
      userId: userId,
      "questioninfo.questionId": { $in: questionIds },
    });

    // For each found document, update it to remove the question references
    const updatePromises = assessmentResultsToUpdate.map(async (result) => {
      // Filter out the question info for deleted questions
      const updatedQuestionInfo = result.questioninfo.filter(
        (info) => !questionIds.includes(info.questionId)
      );

      // If no questions left, delete the entire assessment result
      if (updatedQuestionInfo.length === 0) {
        return AssessmentResult.deleteOne({ _id: result._id }, { session });
      } else {
        // Otherwise update the assessment with remaining questions
        // Also recalculate the score based on remaining questions
        const correctAnswers = updatedQuestionInfo.filter(
          (q) => q.status === "correct"
        ).length;
        const newTotalQuestions = updatedQuestionInfo.length;
        const newScore =
          newTotalQuestions > 0
            ? (correctAnswers / newTotalQuestions) * 100
            : 0;

        return AssessmentResult.updateOne(
          { _id: result._id },
          {
            $set: {
              questioninfo: updatedQuestionInfo,
              score: newScore,
              totalQuestions: newTotalQuestions,
            },
          },
          { session }
        );
      }
    });

    // Wait for all updates to complete
    const assessmentUpdates = await Promise.all(updatePromises);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: `Successfully deleted ${categoryType}: '${name}'`,
      stats: {
        questionsDeleted: questionResult.deletedCount,
        quizzesDeleted: quizResult.deletedCount,
        questionIds: questionIds,
        assessmentResultsDeleted: categoryAssessmentResult.deletedCount,
        assessmentResultsUpdated: assessmentUpdates.length,
      },
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error(`Error deleting ${req.params.categoryType}:`, error);
    res.status(500).json({
      error: `Failed to delete ${req.params.categoryType}: ${error.message}`,
    });
  }
};
// Delete a question by ID
const deleteQuestion = async (req, res) => {
  // Start session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { questionId } = req.params;
    const userId = req.user.userId;

    // Find the question first to verify ownership
    const question = await Question.findOne({ questionId, userId });

    if (!question) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        error: "Question not found or you do not have permission to delete it",
      });
    }

    // Delete the question
    const result = await Question.deleteOne(
      { questionId, userId },
      { session }
    );

    if (result.deletedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Failed to delete question" });
    }

    // Get associated quiz reference if it exists
    const quizRef = question.quizeRef;

    // Check if we need to update the associated quiz's numberOfQuestions
    if (quizRef) {
      await Quiz.updateOne(
        { _id: quizRef },
        { $inc: { numberOfQuestions: -1 } },
        { session }
      );

      // If quiz has no questions left, delete it
      const remainingQuestions = await Question.countDocuments({ quizeRef : quizRef });
      if (remainingQuestions === 0) {
        await Quiz.deleteOne({ _id: quizRef }, { session });
      }
    }

    // Update AssessmentResult documents
    const AssessmentResult = mongoose.model("AssessmentResult");

    // Find assessment results that contain this question
    const assessmentResultsToUpdate = await AssessmentResult.find({
      userId: userId,
      "questioninfo.questionId": questionId,
    });

    // Process each assessment result
    const updatePromises = assessmentResultsToUpdate.map(async (result) => {
      // Filter out the deleted question info
      const updatedQuestionInfo = result.questioninfo.filter(
        (info) => info.questionId !== questionId
      );

      // If no questions left, delete the entire assessment result
      if (updatedQuestionInfo.length === 0) {
        return AssessmentResult.deleteOne({ _id: result._id }, { session });
      } else {
        // Otherwise update the assessment with remaining questions
        // Also recalculate the score based on remaining questions
        const correctAnswers = updatedQuestionInfo.filter(
          (q) => q.status === "correct"
        ).length;
        const newTotalQuestions = updatedQuestionInfo.length;
        const newScore =
          newTotalQuestions > 0
            ? (correctAnswers / newTotalQuestions) * 100
            : 0;

        return AssessmentResult.updateOne(
          { _id: result._id },
          {
            $set: {
              questioninfo: updatedQuestionInfo,
              score: newScore,
              totalQuestions: newTotalQuestions,
            },
          },
          { session }
        );
      }
    });

    // Wait for all updates to complete
    const assessmentUpdates = await Promise.all(updatePromises);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: "Question deleted successfully",
      questionId,
      stats: {
        assessmentResultsUpdated: assessmentUpdates.length,
      },
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Error deleting question:", error);
    res.status(500).json({
      error: `Failed to delete question: ${error.message}`,
    });
  }
};
// Update a question by ID
const updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { question: questionText, options, correctAnswer } = req.body;
    const userId = req.user.userId;

    // Find the question first to verify ownership
    const existingQuestion = await Question.findOne({ questionId, userId });

    if (!existingQuestion) {
      return res.status(404).json({
        error: "Question not found or you do not have permission to edit it",
      });
    }

    // Update the question fields
    const updateData = {};
    if (questionText) updateData.question = questionText;
    if (correctAnswer) updateData.correctAnswer = correctAnswer;
    if (options) updateData.options = options;

    const result = await Question.updateOne(
      { questionId, userId },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: "No changes made to question" });
    }

    // Return the updated question
    const updatedQuestion = await Question.findOne({
      questionId,
      userId,
    }).select("question options correctAnswer questionId quizeRef type");

    res.json({
      success: true,
      message: "Question updated successfully",
      question: updatedQuestion,
    });
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({
      error: `Failed to update question: ${error.message}`,
    });
  }
};

const submitAssessment = async (req, res) => {
  console.log("Received request to submit answers without quiz ID");
  try {
    const { answers, userId, timeTaken, includeUnanswered } = req.body;

    if (!answers || !userId) {
      return res
        .status(400)
        .json({ error: "Answers and user ID are required" });
    }

    // Extract question IDs from each question in the frontend state
    const questionIds = [];
    const formattedAnswers = {};

    // The frontend will need to send the question IDs for each answer
    const questionPromises = Object.keys(answers).map(async (index) => {
      const answer = answers[index];
      // Skip processing if answer is unanswered and we're not including unanswered
      if (answer === "__UNANSWERED__" && !includeUnanswered) {
        return null;
      }

      // Get the question from the database using its ID
      // We'll assume the frontend sends the questions array
      const question = await Question.findOne({
        questionId: req.body.questionIds[index],
        userId: userId,
      });
      if (!question) {
        console.log(
          `Question with ID ${req.body.questionIds[index]} not found`
        );
        return null;
      }

      return {
        question,
        userAnswer: answer,
        index,
      };
    });

    // Wait for all question lookups to complete
    const questionsData = (await Promise.all(questionPromises)).filter(
      (item) => item !== null
    );

    if (questionsData.length === 0) {
      return res.status(404).json({ error: "No valid questions found" });
    }

    // Format data for evaluation
    let questionTexts = [];
    let userAnswersData = [];
    let correctAnswersData = [];

    questionsData.forEach((item) => {
      questionTexts.push(item.question.question);
      userAnswersData.push(item.userAnswer);
      correctAnswersData.push(
        item.question.correctAnswer || "No answer available"
      );
    });

    // Prepare evaluation data
    const evalData = {
      answers: userAnswersData,
      correct_answers: correctAnswersData,
    };

    // Evaluate answers using Python script
    try {
      const results = await runPythonProcess(
        "./python_scripts/evaluate_answers.py",
        [JSON.stringify(evalData)]
      );

      // Store user answers and evaluation results
      const userAnswerPromises = [];
      let totalScore = 0;

      for (let i = 0; i < results.evaluations.length; i++) {
        const evaluation = results.evaluations[i];
        const item = questionsData[i];

        if (item) {
          // Save user answer to database
          const userAnswer = new UserAnswer({
            userId,
            questionId: item.question.questionId,
            userAnswer: evaluation.user_answer,
            accuracy: evaluation.accuracy,
            quizId: item.question.quizeRef,
            missingPoint: evaluation.missing_points || [],
            isCorrect: evaluation.is_correct,
            timeTaken: timeTaken ? timeTaken / questionsData.length : null,
          });

          userAnswerPromises.push(userAnswer.save());
          if (evaluation.is_correct) {
            totalScore += 1;
          }
        }
      }

      // Wait for all user answers to be saved
      await Promise.all(userAnswerPromises);

      // Format results for frontend
      const formattedResults = results.evaluations.map((evaluation, index) => ({
        questionId: questionsData[index].question.questionId,
        status: evaluation.is_correct ? "correct" : "wrong",
        accuracy: evaluation.accuracy,
        user_answer: evaluation.user_answer,
        correct_answer: evaluation.correct_answer,
        question: questionTexts[index],
        ...(evaluation.is_correct
          ? {}
          : {
              missing_points: evaluation.missing_points || [],
            }),
      }));

      res.json({
        evaluations: formattedResults,
        totalScore: totalScore,
      });
    } catch (error) {
      console.error("Error evaluating answers:", error);
      res.status(500).json({
        error: "Evaluation process failed",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

module.exports = {
  getSubjects,
  getTopicsBySubject,
  getSubtopicsByTopic,
  getConceptsBySubtopic,
  getQuestionsByConcept,
  getQuestionsBySubject,
  getQuestionsByTopic,
  getQuestionsBySubtopic,
  renameCategory,
  deleteCategory,
  deleteQuestion,
  updateQuestion,
  submitAssessment,
};
