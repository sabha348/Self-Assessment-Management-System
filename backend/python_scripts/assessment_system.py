
import os
from dotenv import load_dotenv
load_dotenv()
import google.generativeai as genai
import re
import difflib
from typing import List, Dict, Optional

class AssessmentSystem:
    def __init__(self,
                 api_key: str,
                 model: str = "gemini-2.0-flash-lite",
                 accuracy_threshold: int = 70,
                 evaluation_mode: str = 'balanced'):
        """
        Initialize the Assessment Management System with configurable evaluation.

        :param api_key: Google API key
        :param model: The model to use (default is gemini-2.0-flash-lite)
        :param accuracy_threshold: Minimum accuracy percentage to consider an answer correct (default 70)
        :param evaluation_mode: Evaluation strictness ('lenient', 'balanced', 'strict')
        """
        try:
            self.api_key = api_key
            self.model = model
            
            # Initialize Gemini with safety settings
            genai.configure(api_key=self.api_key)
            generation_config = {
                "temperature": 0.7,
                "top_p": 1,
                "top_k": 1,
                "max_output_tokens": 2048,
            }
            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
            
            self.client = genai.GenerativeModel(
                model_name=self.model,
                generation_config=generation_config,
                safety_settings=safety_settings
            )
            
            # Test the connection
            response = self.client.generate_content("Test connection")
            if not response:
                raise Exception("Failed to initialize Gemini client")
            
            self.score = 0
            self.accuracy_threshold = accuracy_threshold
            self.evaluation_mode = evaluation_mode

            # Evaluation mode configurations
            self.mode_configs = {
                'lenient': {'semantic_weight': 0.6, 'keyword_weight': 0.4, 'partial_match_bonus': 10},
                'balanced': {'semantic_weight': 0.7, 'keyword_weight': 0.3, 'partial_match_bonus': 5},
                'strict': {'semantic_weight': 0.8, 'keyword_weight': 0.2, 'partial_match_bonus': 0}
            }

        except Exception as e:
            print(f"Initialization error: {str(e)}")
            raise

    def _sanitize_response(self, text: str) -> str:
        """Normalize and clean AI response text."""
        if not text:
            return ""
        # Replace multiple newlines with a single one, remove excessive whitespace
        text = re.sub(r'\n+', '\n', text.strip())
        # Remove control characters that might cause parsing issues
        text = ''.join(c for c in text if ord(c) >= 32 or c == '\n')
        return text

    def generate_questions(self, input_text: str, num_questions: int = 2) -> List[str]:
        """
        Generate comprehension questions based on the input text.

        :param input_text: The text to generate questions about
        :param num_questions: Number of questions to generate
        :return: List of generated questions
        """
        if not input_text.strip():
            print("Error: Input text is empty")
            return []
        
        prompt = f"""Generate {num_questions} high-quality comprehension questions that fully test the reader's understanding of this text. Ensure questions:
- Cover all aspects of comprehension, including factual recall, definitions, processes, relationships, comparisons, sequences, purposes, inferences, applications, and critical analysis
- Are clear, relevant, and directly related to the text's content or concepts
- Vary in difficulty, from basic recall to higher-order thinking (e.g., analysis, evaluation, application)
- May include hypothetical scenarios, implications, or connections to broader concepts if relevant to the text
- Are phrased to engage the reader and encourage deep understanding
- Use the text’s exact terminology to avoid confusion (e.g., use 'cooperation' if the text does, not 'collaboration')
- Avoid vague references to unspecified elements (e.g., 'the process' or 'main concepts') unless clearly defined in the question
- Prefer standalone phrasing, avoiding terms like 'based on the text' to ensure questions are clear without needing the text

Input Text: {input_text}

Provide only the questions, without numbering or additional text."""
        try:
            response = self.client.generate_content(prompt)
            if not response or not response.text:
                raise Exception("Empty response from API")
            
            generated_text = self._sanitize_response(response.text)
            
            # Flexible parsing for different AI response formats
            questions = []
            lines = [line.strip() for line in generated_text.split('\n') if line.strip()]
            for line in lines:
                cleaned_line = re.sub(r'^\s*(\d+\.|\-|\*)\s*', '', line).strip()
                if cleaned_line and not cleaned_line.isdigit():
                    questions.append(cleaned_line)
            
            questions = questions[:num_questions]
            if not questions:
                raise Exception("No valid questions generated")
            
            return questions
        
        except Exception as e:
            print(f"Question generation error: {str(e)}")
            return []

    def generate_correct_answers(self, input_text: str, questions: List[str]) -> List[str]:
        """
        Generate correct answers for the given questions.

        :param input_text: Original context text
        :param questions: List of questions
        :return: List of correct answers
        """
        correct_answers = []
        for question in questions:
            prompt = f"""Provide a precise, concise answer to the following question:

Question: {question}

If the provided context does not contain sufficient information to answer the question completely, use general knowledge to provide the correct answer. Do not mention the context, its limitations, or phrases like 'based on general knowledge' in the answer. Simply provide the direct answer to the question.

Context: {input_text}

Answer:"""

            try:
                response = self.client.generate_content(prompt)
                correct_answer = self._sanitize_response(response.text).strip()
                correct_answers.append(correct_answer)

            except Exception as e:
                print(f"Answer generation error: {e}")
                correct_answers.append("Unable to generate answer")

        return correct_answers

    def _custom_similarity_evaluation(self, user_answer: str, correct_answer: str) -> Dict:
        """Modified similarity evaluation with minimum threshold"""
        mode_config = self.mode_configs.get(self.evaluation_mode, self.mode_configs['balanced'])

        user_lower = user_answer.lower().strip()
        correct_lower = correct_answer.lower().strip()

        semantic_similarity = difflib.SequenceMatcher(None, user_lower, correct_lower).ratio() * 100

        # Extract meaningful keywords (filter out common words)
        common_words = {'the', 'a', 'an', 'is', 'are', 'in', 'on', 'of', 'and', 'to', 'that', 'it'}
        user_keywords = set(word for word in user_lower.split() if word not in common_words)
        correct_keywords = set(word for word in correct_lower.split() if word not in common_words)
        
        keyword_overlap = len(user_keywords & correct_keywords)
        total_keywords = len(correct_keywords)
        keyword_score = (keyword_overlap / total_keywords * 100) if total_keywords > 0 else 0

        # Only apply partial match bonus if there's meaningful similarity
        partial_bonus = mode_config['partial_match_bonus'] if semantic_similarity > 20 else 0
        
        accuracy = (
            (mode_config['semantic_weight'] * semantic_similarity) +
            (mode_config['keyword_weight'] * keyword_score) +
            partial_bonus
        )
        
        # Enforce minimum threshold for completely wrong answers
        if semantic_similarity < 15 and keyword_overlap == 0:
            accuracy = 0
            
        accuracy = max(0, min(100, accuracy))

        missing_keywords = list(correct_keywords - user_keywords)

        return {
            'accuracy': round(accuracy, 2),
            'semantic_similarity': round(semantic_similarity, 2),
            'keyword_score': round(keyword_score, 2),
            'missing_keywords': missing_keywords,
            'is_correct': accuracy >= self.accuracy_threshold
        }

    def evaluate_answer(self, user_answer: str, correct_answer: str) -> Dict:
        """
        Evaluate a single user answer with advanced, flexible methods.

        :param user_answer: User's provided answer
        :param correct_answer: Correct answer to the question
        :return: Comprehensive evaluation dictionary
        """
        try:
            prompt = f"""Perform a nuanced, multi-dimensional answer comparison:

Correct Answer: {correct_answer}
User Answer: {user_answer}

Evaluation Guidelines:
- Assess semantic alignment
- Check factual correctness
- Identify key information coverage
- Provide constructive feedback

Provide:
1. Semantic Accuracy Percentage (0-100)
2. Key Missing Points
3. Brief Comparative Analysis

Response Format:
Accuracy:XX,
Missing Points:[list],
Analysis:detailed text"""

            response = self.client.generate_content(prompt)
            evaluation_text = self._sanitize_response(response.text)

            # Extract AI-suggested accuracy
            accuracy_match = re.search(r'Accuracy.*?(\d+)%?', evaluation_text, re.IGNORECASE)
            ai_accuracy = int(accuracy_match.group(1)) if accuracy_match else None

            # Extract missing points with improved multi-line handling
            missing_points_match = re.search(
                r'Missing Points:\s*\[(.*?)\]|Missing Points:(.*?)(?=\nAnalysis|\n3\.)',
                evaluation_text, re.DOTALL | re.IGNORECASE
            )
            missing_points = []
            if missing_points_match:
                group = missing_points_match.group(1) or missing_points_match.group(2)
                if group:
                    if '[' in group:
                        missing_points = [p.strip() for p in group.strip('[]').split(',') if p.strip()]
                    else:
                        missing_points = [p.strip('- ').strip() for p in group.split('\n') if p.strip()]

        except Exception as e:
            print(f"AI Evaluation error: {e}")
            ai_accuracy = None
            missing_points = []

        custom_evaluation = self._custom_similarity_evaluation(user_answer, correct_answer)

        final_accuracy = ai_accuracy if ai_accuracy is not None else custom_evaluation['accuracy']
        is_correct = final_accuracy >= self.accuracy_threshold

        if is_correct:
            self.score += 1

        return {
            "is_correct": is_correct,
            "accuracy": final_accuracy,
            "custom_evaluation": custom_evaluation,
            "missing_points": missing_points,
            "correct_answer": correct_answer,
            "user_answer": user_answer
        }

    def run_assessment(self, input_text: str, num_questions: int = 5):
        """
        Run the complete assessment process.

        :param input_text: Text to generate questions from
        :param num_questions: Number of questions to generate
        """
        questions = self.generate_questions(input_text, num_questions)

        if not questions:
            print("Failed to generate questions.")
            return

        print("\n--- Assessment Questions ---")
        for i, question in enumerate(questions, 1):
            print(f"Question {i}: {question}")

        user_answers = []
        for i, question in enumerate(questions, 1):
            print(f"\nQuestion {i}")
            user_answer = input("Your answer: ").strip()
            user_answers.append(user_answer)

        correct_answers = self.generate_correct_answers(input_text, questions)

        print("\n--- Assessment Results ---")
        for i, (user_answer, correct_answer) in enumerate(zip(user_answers, correct_answers), 1):
            print(f"\nQuestion {i} Evaluation:")
            result = self.evaluate_answer(user_answer, correct_answer)

            print(f"Status: {'Correct' if result['is_correct'] else 'Incorrect'}")
            print(f"Accuracy: {result['accuracy']}%")
            print(f"Correct Answer: {result['correct_answer']}")

            if not result['is_correct']:
                print("Missing Points:")
                for point in result['missing_points']:
                    print(f"- {point}")

        print(f"\nTotal Score: {self.score}/{len(questions)}")

def main():
    API_KEY = os.getenv('GOOGLE_API_KEY')
    
    input_text = (
        """
What is Parallel Computer?
PAGE 7
 A computer which consists of a number of inter-connected computers which
cooperatively execute a single program to solve a problem is called a parallel
computer.
 All current micro-processors are parallel processors.
 Each processor in a microprocessor chip is called a core and such a
microprocessor is called a multicore processor.
 The processor retrieves a sequence of instructions from the main memory and
stores them in an on-chip memory. The "cores" can then cooperate to execute
these instructions in parallel.
 Even though the speed of single processor computers is continuously
increasing, problems which are required to be solved nowadays are becoming
more complex
"""
    )

    assessment = AssessmentSystem(
        API_KEY,
        accuracy_threshold=60,
        evaluation_mode='lenient'
    )

    assessment.run_assessment(input_text)

if __name__ == "__main__":
    main()