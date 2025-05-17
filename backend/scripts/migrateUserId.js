const mongoose = require('mongoose');
require('dotenv').config(); // If you use dotenv for env variables

const DB_URI = process.env.MONGODB_URI || 'your_mongodb_connection_string';

// Connect to MongoDB
mongoose.connect(DB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    runMigration();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function migrateCollection(collection, collectionName) {
  console.log(`Starting migration for ${collectionName} collection`);
  
  // 1. First handle documents with both createdBy and userId fields
  const bothFieldsResult = await collection.updateMany(
    { createdBy: { $exists: true }, userId: { $exists: true } },
    { $unset: { createdBy: "" } }
  );
  console.log(`Removed createdBy from ${bothFieldsResult.modifiedCount} ${collectionName} documents that already had userId`);
  
  // 2. For documents with only createdBy field, copy to userId then remove createdBy
  const onlyCreatedByResult = await collection.updateMany(
    { createdBy: { $exists: true }, userId: { $exists: false } },
    [
      { $set: { userId: "$createdBy" } },
      { $unset: "createdBy" }
    ]
  );
  console.log(`Migrated ${onlyCreatedByResult.modifiedCount} ${collectionName} documents from createdBy to userId`);
}

async function runMigration() {
  try {
    // Get collection references
    const db = mongoose.connection.db;
    const quizCollection = db.collection('quizzes'); // Your quiz collection name
    const questionCollection = db.collection('questions'); // Your question collection name
    
    console.log('Starting migration: standardizing on userId field');
    
    // Migrate both collections
    await migrateCollection(quizCollection, 'quiz');
    await migrateCollection(questionCollection, 'question');
    
    console.log('Migration completed successfully for all collections');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}