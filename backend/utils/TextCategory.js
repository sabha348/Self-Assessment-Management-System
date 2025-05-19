require('dotenv').config();
const CategoryStandardizer = require('./CategoryStandardizer');

// Default result structure
const DEFAULT_RESULT = {
  Subject: "Unknown",
  Topic: "Unknown",
  Subtopic: "Unknown",
  Concept: "Unknown"
};

// Common subject areas to encourage consistency
const COMMON_SUBJECTS = [
  "Computer Science", "Information Technology", "Mathematics", "Physics", "Chemistry", 
  "Biology", "Medicine", "Business Administration", "Economics", "Psychology", 
  "Sociology", "Political Science", "History", "Literature", "Philosophy", 
  "Engineering", "Environmental Science", "Law", "Linguistics", "Education"
];

// Google Generative AI API configuration from environment variables
const API_KEY = process.env.GOOGLE_API_KEY;
const API_ENDPOINT = process.env.GOOGLE_AI_ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash";

async function categorizeText(text, userId) {
  // Check if text is provided and API key is available
  if (!text || text.trim() === "") {
    console.warn("Empty text provided for categorization");
    return DEFAULT_RESULT;
  }

  if (!API_KEY) {
    console.error("Missing Google AI API key in environment variables");
    return DEFAULT_RESULT;
  }

  // Enhanced prompt with disambiguation guidelines and examples
  const prompt = `
    You are an expert educational content classifier specializing in precise, unambiguous categorization.
    
    Analyze the following text and categorize it into specific, non-ambiguous categories:
    - Subject: The precise academic field (be specific, e.g., "Computer Science" not just "Computing")
    - Topic: A specific area within the subject (e.g., "Computer Networks" not just "Networks")
    - Subtopic: A specific area within the topic (e.g., "Network Protocols" not just "Protocols")
    - Concept: A specific idea or technique within the subtopic (e.g., "TCP/IP" not just "Protocols")

    Rules for precise categorization:
    1. ALWAYS use the most specific terminology available for the academic context.
    2. AVOID ambiguous terms that could belong to multiple domains:
       - Use "Computer Networks" instead of just "Networks"
       - Use "Business Ethics" instead of just "Ethics"
       - Use "Linear Algebra" instead of just "Algebra"
    3. Choose from these common subject areas when applicable: ${COMMON_SUBJECTS.join(', ')}
    4. If unsure about specificity, add a domain qualifier (e.g., "Computer Science: Algorithms")
    5. Assign categories hierarchically: Subject > Topic > Subtopic > Concept.
    6. If a level is unclear, stop there and mark subsequent levels as "Unknown".
    7. Return the result in this exact format, with each category on a new line:
       Subject: [subject]
       Topic: [topic]
       Subtopic: [subtopic]
       Concept: [concept]

    Disambiguation examples:
    • For "TCP/IP protocol stack" → Subject: Computer Science, Topic: Computer Networks, Subtopic: Network Architecture, Concept: TCP/IP Protocol Suite
    • For "market segmentation strategies" → Subject: Business Administration, Topic: Marketing, Subtopic: Market Strategy, Concept: Market Segmentation
    • For "mitosis and cell division" → Subject: Biology, Topic: Cell Biology, Subtopic: Cell Reproduction, Concept: Mitosis

    Text: "${text}"
  `;

  try {
    // Call Google Generative AI API
    const response = await fetch(`${API_ENDPOINT}:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.2 // Even lower temperature for more deterministic output
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // More robust response parsing
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 
      "Subject: Unknown\nTopic: Unknown\nSubtopic: Unknown\nConcept: Unknown";
    
    // Parse the response
    const parsedResponse = parseResponse(resultText);
    
    // Standardize each category against the database if userId is provided
    if (userId) {
      for (const category of ['Subject', 'Topic', 'Subtopic', 'Concept']) {
        if (parsedResponse[category] !== 'Unknown') {
          parsedResponse[category] = await CategoryStandardizer.standardizeTerm(
            parsedResponse[category], 
            category, 
            userId
          );
        }
      }
    }
    
    return parsedResponse;
  } catch (error) {
    console.error(`Categorization Error: ${error.message}`);
    return DEFAULT_RESULT;
  }
}

function parseResponse(responseText) {
  // Parse the API response into a structured object
  const result = { ...DEFAULT_RESULT };
  const lines = responseText.split("\n");

  const categoryMap = {
    "subject": "Subject",
    "topic": "Topic", 
    "subtopic": "Subtopic",
    "concept": "Concept"
  };

  for (const line of lines) {
    const match = line.match(/^(\w+)\s*:\s*(.+)$/i);
    if (match) {
      const [, rawKey, value] = match;
      const key = Object.keys(categoryMap).find(k => 
        rawKey.toLowerCase() === k
      );

      if (key) {
        // Ensure specific terminology and avoid ambiguous categories
        const processedValue = processCategory(value.trim(), categoryMap[key]);
        result[categoryMap[key]] = processedValue;
      }
    }
  }

  // Validate hierarchical consistency
  if (result.Subtopic !== "Unknown" && result.Topic === "Unknown") {
    result.Subtopic = "Unknown";
    result.Concept = "Unknown";
  }
  if (result.Concept !== "Unknown" && result.Subtopic === "Unknown") {
    result.Concept = "Unknown";
  }

  return result;
}

// New function to process categories and avoid ambiguity
function processCategory(value, categoryType) {
  if (value.trim().toLowerCase() === "unknown") {
    return "Unknown";
  }
  
  const capitalizedValue = capitalize(value);
  
  // Common ambiguous terms that need qualification
  const ambiguousTerms = {
    "networks": "Computer Networks",
    "networking": "Computer Networking",
    "security": "Information Security",
    "algebra": "Abstract Algebra",
    "calculus": "Differential Calculus",
    "programming": "Computer Programming",
    "ethics": "Applied Ethics",
    "analysis": "Data Analysis",
    "management": "Business Management",
    "architecture": "Computer Architecture",
    "protocols": "Network Protocols"
  };
  
  // Only apply disambiguation to single-word terms
  const wordCount = capitalizedValue.split(/\s+/).length;
  if (wordCount === 1 && ambiguousTerms[capitalizedValue.toLowerCase()]) {
    return ambiguousTerms[capitalizedValue.toLowerCase()];
  }
  
  return capitalizedValue;
}

// Helper function to capitalize strings
function capitalize(str) {
  if (!str) return str;
  // Capitalize first letter of each word
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Export functions
module.exports = { 
  categorizeText, 
  parseResponse,
  processCategory,
  COMMON_SUBJECTS
};

// Run the test function if this file is executed directly
if (require.main === module) {
  const testTexts = [
    "CSMA/CD is a media access control protocol used in early Ethernet networks",
    "Marketing segmentation divides a broad consumer market into subgroups",
    "TCP/IP is the basic communication language or protocol of the Internet",
    "Photosynthesis is a process by which plants make food using sunlight"
  ];
  
  console.log("Testing improved categorizer with API key:", API_KEY ? "Available" : "Missing");
  
  Promise.all(testTexts.map(async (text) => {
    console.log(`\nCategorizing: "${text}"`);
    const result = await categorizeText(text);
    console.log("Results:", JSON.stringify(result, null, 2));
    return result;
  }))
  .then(() => console.log("\nAll tests completed."))
  .catch(err => console.error("Test error:", err));
}