const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const quizSchema = new Schema({
  numberOfQuestions: { type: Number, required: true }, // Total number of questions in the quiz
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Reference to the user who created the quiz
  createdAt: { type: Date, default: Date.now }, // Timestamp when the quiz was created
  difficulty: { type: String, enum: ["easy", "medium", "hard", "mixed"], required: true }, // Difficulty level of the quiz
  type: { 
    type: String, 
    enum: ["open-ended", "fill-in-the-blanks", "mcq", "msq", "mix"], 
    required: true 
  }, // Type of quiz format, including MCQ, MSQ, and mixed types
  score: { type: String }, // Grade or level for which the quiz is designed
  subject: { type: String }, // Subject category of the quiz
  topic: { type: String}, // The specific topic of the quiz
  subtopic: { type: String}, // The specific topic of the quiz
  concept: { type: String}, // The specific topic of the quiz
  content: { type: String, required: true }, // The question text
  quizTime: { type: Number, required: true }, // Total time allocated for the quiz (in minutes)
  userTime: { type: Number }, // Time taken by the user to complete the quiz
});

// Post-save middleware to update all related questions when hierarchical data changes
quizSchema.post('findOneAndUpdate', async function(doc) {
  if (!doc) return;
  
  // Get the updated fields
  const update = this.getUpdate();
  const hierarchicalFields = ['subject', 'topic', 'subtopic', 'concept', 'difficulty'];
  
  // Check if any hierarchical field was updated
  const hasHierarchicalUpdates = hierarchicalFields.some(field => 
    update.$set && update.$set[field] !== undefined
  );
  
  if (hasHierarchicalUpdates) {
    try {
      // Get the Question model - we have to require it here to avoid circular references
      const Question = mongoose.model('Question');
      
      // Build update object with only changed fields
      const updateFields = {};
      hierarchicalFields.forEach(field => {
        if (update.$set && update.$set[field] !== undefined) {
          updateFields[field] = update.$set[field];
        }
      });
      
      // Update all questions that reference this quiz
      await Question.updateMany({ quizeRef: doc._id }, { $set: updateFields });
      console.log(`Updated hierarchical fields for questions with quizeRef: ${doc._id}`);
    } catch (error) {
      console.error('Error updating related questions:', error);
    }
  }
});

module.exports = mongoose.model("Quiz", quizSchema);
