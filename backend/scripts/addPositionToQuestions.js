const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const connectDB = require('../config/db');

async function revertUserFieldsMigration() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');
    
    // First, let's check what documents we have to potentially fix
    const quizDocWithBothCount = await Quiz.countDocuments({ 
      createdBy: { $exists: true }, 
      userId: { $exists: true }
    });
    
    const questionDocWithBothCount = await Question.countDocuments({ 
      createdBy: { $exists: true }, 
      userId: { $exists: true }
    });
    
    console.log(`Found ${quizDocWithBothCount} Quiz documents with both fields`);
    console.log(`Found ${questionDocWithBothCount} Question documents with both fields`);

    // Step 1: Remove userId field from Quiz documents where it was added based on createdBy
    const quizResult = await Quiz.updateMany(
      { 
        createdBy: { $exists: true }, 
        userId: { $exists: true },
        },
      { $unset: { userId: "" } }
    );

    // Step 2: Remove createdBy field from Question documents where it was added based on userId
    const questionResult = await Question.updateMany(
      { 
        createdBy: { $exists: true }, 
        userId: { $exists: true },
      },
      { $unset: { createdBy: "" } }
    );

    // Extract proper counts (MongoDB driver might return different object structures)
    const quizModified = quizResult?.modifiedCount || quizResult?.nModified || 0;
    const questionModified = questionResult?.modifiedCount || questionResult?.nModified || 0;

    console.log(`Reverted ${quizModified} Quiz documents: removed userId field`);
    console.log(`Reverted ${questionModified} Question documents: removed createdBy field`);
    
    // Log total changes
    const totalDocumentsModified = quizModified + questionModified;

    console.log(`Migration reverted: ${totalDocumentsModified} total documents modified`);
    console.log(`Quiz update result:`, JSON.stringify(quizResult));
    console.log(`Question update result:`, JSON.stringify(questionResult));
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error('Error during migration reversion:', error);
    process.exit(1);
  }
}

// Run the migration reversion
revertUserFieldsMigration();