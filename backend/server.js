const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Question = require("./models/question");
require('dotenv').config();
const authRoutes = require("./routes/auth");
const uri = process.env.MONGODB_URI;
const userRoutes = require('./routes/userRouter');
const connectDB = require('./config/db');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

connectDB();


// Helper function to run Python process
function runPythonProcess(scriptName, args) {
  return new Promise((resolve, reject) => {
    console.log(`Executing Python script: ${scriptName} with args:`, args);

    const pythonProcess = spawn("python", [scriptName, ...args]);
    let outputData = "";
    let errorData = "";

    // Set timeout for process
    let timeout = 12000;
    const timeoutId = setTimeout(() => {
      pythonProcess.kill();
      reject(new Error(`Process timed out after ${timeout/1000} seconds`));
    }, timeout);

    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error("Python stderr:", data.toString());
      errorData += data.toString();
    });

    pythonProcess.on("error", (error) => {
      console.error("Failed to start Python process:", error);
      clearTimeout(timeout);
      reject(error);
    });

    pythonProcess.on("close", (code) => {
      clearTimeout(timeout);
      console.log(`Python process exited with code ${code}`);

      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorData}`));
        return;
      }

      try {
        resolve(outputData);
      } catch (e) {
        console.error("Output that failed to parse:", outputData);
        reject(new Error(`Failed to parse Python output or did not receive data on stdout: ${e.message}`));
      }
    });
  });
}

// Endpoint to initiate assessment
app.post("/api/assessment", async (req, res) => {
  try {
    const { text, numQuestions = 5, type = 'General', topic = 'Fruit' } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Input text is required" });
    }

    // Generate a unique session ID
    const sessionId = Date.now().toString();
    
    // let questionsString = await runPythonProcess("questions.py", [
    //   text,
    //   numQuestions.toString(),
    // ]);

   let questionsString = `["- What is the speaker's name?", "- What does the speaker introduce themselves with?", "- What are the last three words the speaker says?", "- How many words does the speaker use to introduce themselves?", "- What is the first letter of the speaker's name?"]`;
   // Parse the questions string into an array
   let questionsArray = JSON.parse(questionsString);
    // Remove the '-' from each question
   questionsArray = questionsArray.map(question => question.replace(/^-\s*/, ''));

    // Send only questions to client
   res.json({ sessionId, questions: questionsArray });

    // generate actual answers to questions
    const correct_answers_String = await runPythonProcess("correct_answers.py", [
      text,
      JSON.stringify(questionsArray), // Convert the array to a JSON string    
      ]);

    let correct_answers_Array = JSON.parse(correct_answers_String);
    console.log("Correct answers:", correct_answers_Array);

    // Save questions to the database
    // await saveQuestions(Formatted_questions, 'Q');
  }
  catch (error) {
    console.error("Server error:", error);
    // res.status(500).json({
    //   error: "Server error",
    //   details: error.message,
    // });
  }
});

// Function to save questions to the database
async function saveQuestions(Formatted_questions, prefix = 'Q') {
  try {
    // Iterate over the array and save each question 
    for (let index = 0; index < Formatted_questions.length; index++) {
      const q = Formatted_questions[index];
      const newQuestion = new Question({
        qid: `${prefix}${index + 1}`,
        type: 'General',
        topic: 'Fruit',
        question: q
      });
      await newQuestion.save();
    }
  } catch (err) {
    console.log(err);
    throw new Error(`Failed to save generated questions: ${err.message}`);
  }
}

// Endpoint to submit answers
app.post("/api/assessment/:sessionId/submit", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Answers array is required" });
    }

    console.log(assessmentResults);
    const assessment = assessmentResults.get(sessionId);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment session not found" });
    }

    try {
      const evalData = {
        questions: assessment.questions,
        answers,
      };
      console.log("Evaluation data:", evalData);
      const results = await runPythonProcess("questions.py", [
        JSON.stringify(evalData),
      ]);

      // Clean up session data
      assessmentResults.delete(sessionId);
      res.json(results);
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
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.listen(port, () => {
  console.log(`Assessment server running on port ${port}`);
});

// mongoose
//   .connect(
//     uri
//   )
//   .then(() => {
//     app.listen(5000, () => {
//       console.log("Database connected and server running on port 5000");
//     });
//   })
//   .catch((err) => {
//     console.log(err);
//   });


app.use('api/auth',authRoutes);

app.use('/user',userRoutes);