const Quiz = require('../models/Quiz');

/**
 * Service that standardizes category terms by checking the database
 */
class CategoryStandardizer {
  /**
   * Find the most similar existing term in the database for a given category
   * @param {string} term - The term to standardize
   * @param {string} categoryType - The type of category (Subject, Topic, Subtopic, Concept)
   * @param {string} userId - The user ID to query their quizzes
   * @returns {Promise<string>} - The standardized term or original if no match
   */
  static async standardizeTerm(term, categoryType, userId) {
    if (!term || term === "Unknown") return term;
    
    try {
      const normalizedTerm = term.trim().toLowerCase();
      
      // Build the query based on category type and userId
      const query = { userId };
      const fieldName = categoryType.toLowerCase();
      
      // Get unique values for this category type from this user's quizzes
      const existingTerms = await Quiz.distinct(fieldName, query);
      
      // Normalize all existing terms for comparison
      const normalizedExisting = existingTerms.map(t => ({
        original: t,
        normalized: t.toLowerCase().trim()
      }));
      
      // Look for exact matches first
      const exactMatch = normalizedExisting.find(t => t.normalized === normalizedTerm);
      if (exactMatch) return exactMatch.original;
      
      // Then look for close matches using similarity metrics
      const similarMatch = findSimilarTerm(normalizedTerm, normalizedExisting);
      if (similarMatch) return similarMatch.original;
      
      // If no match found, return the original with proper capitalization
      return capitalizeWords(term);
    } catch (error) {
      console.error(`Error standardizing term: ${error.message}`);
      return term; // Return original term in case of error
    }
  }
}

/**
 * Find the most similar term from a list of candidates
 * @param {string} term - Term to match
 * @param {Array<{original: string, normalized: string}>} candidates - List of candidate terms
 * @returns {Object|null} - The best matching term or null
 */
function findSimilarTerm(term, candidates) {
  // Minimum similarity threshold (0-1 scale, higher means more similar)
  const SIMILARITY_THRESHOLD = 0.85;
  
  let bestMatch = null;
  let highestSimilarity = 0;
  
  for (const candidate of candidates) {
    // Skip exact matches as they were handled earlier
    if (candidate.normalized === term) continue;
    
    // Calculate similarity score
    const similarity = calculateSimilarity(term, candidate.normalized);
    
    // Check if this is the best match so far
    if (similarity > highestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
      highestSimilarity = similarity;
      bestMatch = candidate;
    }
  }
  
  return bestMatch;
}

/**
 * Calculate similarity between two strings (0-1 scale)
 * This uses a combination of substring and Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  // If one string contains the other, high similarity
  if (str1.includes(str2) || str2.includes(str1)) {
    const shorterLength = Math.min(str1.length, str2.length);
    const longerLength = Math.max(str1.length, str2.length);
    // Ratio of shorter to longer string gives similarity
    return shorterLength / longerLength;
  }
  
  // Otherwise use Levenshtein distance
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  // Convert distance to similarity (1 = identical, 0 = completely different)
  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // Create a matrix of size (m+1) x (n+1)
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
  
  // Initialize the matrix
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] !== str2[j - 1] ? 1 : 0;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Capitalize first letter of each word in a string
 */
function capitalizeWords(str) {
  return str.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

module.exports = CategoryStandardizer;