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
    const timeout = setTimeout(() => {
      pythonProcess.kill();
      reject(new Error("Process timed out after 120 seconds"));
    }, 120000);

    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });
    console.log("Output data:", outputData);

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
        reject(new Error(`Failed to parse Python output: ${e.message}`));
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

    
    let questions = await runPythonProcess("evaluate_answers.py", [
      text,
      numQuestions.toString(),
    ]);

    // Remove unwanted characters and split the string into an array
    let Formatted_questions = questions
        // Remove hyphens
        .replace(/\-/g,'')
        .split('\n')
        .map(question => question.trim())
        .filter(question => question !== ''); // Filter out empty strings

    // // Send only questions to client
    // res.json({ sessionId, questions: Formatted_questions });

    // generate actual answers to questions
    // const correct_answers = await runPythonProcess("correct_answers.py", [
    //   text,
    //   questions,
    // ]);
    // console.log("Correct answers:", correct_answers);

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
      const results = await runPythonProcess("evaluate_answers.py", [
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