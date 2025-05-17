const mongoose = require('mongoose');
const Question = require('../models/Question');
require('dotenv').config(); // Load environment variables
const AssessmentResult = require('../models/AssessmentResult');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .then(async () => {
  

try {
    // 1. Find questions with unknown hierarchical fields
    const unknownQuestions = await Question.find({
      $or: [
        { subject: { $regex: /^unknown$/i } },
        { topic: { $regex: /^unknown$/i } },
        { subtopic: { $regex: /^unknown$/i } },
        { concept: { $regex: /^unknown$/i } }
      ]
    }).select('questionId');

    const unknownQuestionIds = unknownQuestions.map(q => q.questionId);
    console.log(`Found ${unknownQuestionIds.length} questions with unknown fields`);

    // 2. Find assessment results with unknown itemNames
    const unknownAssessments = await AssessmentResult.find({
      itemName: { $regex: /^unknown$/i }
    });
    
    console.log(`Found ${unknownAssessments.length} assessment results with unknown items`);

    // 3. Delete the unknown questions
    const deleteQuestionsResult = await Question.deleteMany({
      $or: [
        { subject: { $regex: /^unknown$/i } },
        { topic: { $regex: /^unknown$/i } },
        { subtopic: { $regex: /^unknown$/i } },
        { concept: { $regex: /^unknown$/i } }
      ]
    });

    // 4. Delete assessment results with unknown itemNames
    const deleteUnknownAssessmentsResult = await AssessmentResult.deleteMany({
      itemName: { $regex: /^unknown$/i }
    });

    // 5. For assessments that reference unknown questions - remove only those questions
    let modifiedAssessmentCount = 0;
    
    // Find assessments that include unknown questions
    const assessmentsWithUnknownQuestions = await AssessmentResult.find({
      'questioninfo.questionId': { $in: unknownQuestionIds }
    });
    
    for (const assessment of assessmentsWithUnknownQuestions) {
      // Filter out the unknown questions
      const originalLength = assessment.questioninfo?.length || 0;
      
      if (assessment.questioninfo && Array.isArray(assessment.questioninfo)) {
        assessment.questioninfo = assessment.questioninfo.filter(
          q => !unknownQuestionIds.includes(q.questionId)
        );
        
        if (assessment.questioninfo.length < originalLength) {
          // Update the assessment if questions were removed
          // Recalculate score if needed
          if (assessment.questioninfo.length > 0) {
            const correctCount = assessment.questioninfo.filter(q => q.status === 'correct').length;
            assessment.score = Math.round((correctCount / assessment.questioninfo.length) * 100);
            assessment.totalQuestions = assessment.questioninfo.length;
            await assessment.save();
            modifiedAssessmentCount++;
          } else {
            // If no questions left, delete the assessment
            await AssessmentResult.deleteOne({ _id: assessment._id });
          }
        }
      }
    }

    console.log('Cleanup Results:');
    console.log(`- Deleted ${deleteQuestionsResult.deletedCount} questions`);
    console.log(`- Deleted ${deleteUnknownAssessmentsResult.deletedCount} assessment results`);
    console.log(`- Modified ${modifiedAssessmentCount} assessments`);
    
  } catch (error) {
    console.error('Error cleaning up unknown data:', error);
  } finally {
    mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
  
})
.catch(err => {
  console.error('MongoDB connection error:', err);
});