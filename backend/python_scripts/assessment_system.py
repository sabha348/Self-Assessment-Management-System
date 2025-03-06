# import os
# from dotenv import load_dotenv
# load_dotenv()
# from huggingface_hub import InferenceClient # Importing InferenceClient
# # from openai import OpenAI
# import re
# import difflib
# from typing import List, Dict, Optional

# class AssessmentSystem:
#     def __init__(self,
#                  api_key: str,
#                  model: str = "mistralai/Mistral-Nemo-Instruct-2407",
#                 #  model: str = "gpt-4o-mini",
#                  accuracy_threshold: int = 70,
#                  evaluation_mode: str = 'balanced'):
#         """
#         Initialize the Assessment Management System with configurable evaluation.

#         :param api_key: Hugging Face API key
#         :param model: The model to use for question generation and evaluation
#         :param accuracy_threshold: Minimum accuracy percentage to consider an answer correct (default 70)
#         :param evaluation_mode: Evaluation strictness ('lenient', 'balanced', 'strict')
#         """
#         self.api_key = api_key
#         self.model = model
#         self.client = InferenceClient(api_key=self.api_key)
#         # self.client = OpenAI(api_key=self.api_key)
#         self.score = 0

#         # Configurable evaluation parameters
#         self.accuracy_threshold = accuracy_threshold
#         self.evaluation_mode = evaluation_mode

#         # Evaluation mode configurations
#         self.mode_configs = {
#             'lenient': {
#                 'semantic_weight': 0.6,
#                 'keyword_weight': 0.4,
#                 'partial_match_bonus': 10
#             },
#             'balanced': {
#                 'semantic_weight': 0.7,
#                 'keyword_weight': 0.3,
#                 'partial_match_bonus': 5
#             },
#             'strict': {
#                 'semantic_weight': 0.8,
#                 'keyword_weight': 0.2,
#                 'partial_match_bonus': 0
#             }
#         }

#     def generate_questions(self, input_text: str, num_questions: int = 2) -> List[str]:
#         """
#         Generate comprehension questions based on the input text.

#         :param input_text: The text to generate questions about
#         :param num_questions: Number of questions to generate
#         :return: List of generated questions
#         """
#         prompt = f"""Generate {num_questions} high-quality, specific comprehension questions
#         that directly test the key points of this text. Ensure questions are:
#         - Clear and unambiguous
#         - Directly based on the text's content
#         - Require specific, factual answers

#         Input Text: {input_text}

#         Provide only the questions, without numbering or additional text."""

#         messages = [
#             {
#                 "role": "system",
#                 "content": "You are an expert in creating precise, comprehensive comprehension questions."
#             },
#             {
#                 "role": "user",
#                 "content": prompt
#             }
#         ]

#         try:
#             completion = self.client.chat.completions.create(
#                 model=self.model,
#                 messages=messages,
#                 max_tokens=500
#             )

#             generated_text = completion.choices[0].message.content
            
#             questions = [
#                 q.strip()
#                 for q in re.split(r'\n+', generated_text)
#                 if q.strip() and not q.strip()[0].isdigit()
#             ][:num_questions]
            
#             return questions
        
#         except Exception as e:
#             print(f"Question generation error: {e}")

#     def generate_correct_answers(self, input_text: str, questions: List[str]) -> List[str]:
#         """
#         Generate correct answers for the given questions.

#         :param input_text: Original context text
#         :param questions: List of questions
#         :return: List of correct answers
#         """
#         correct_answers = []
#         for question in questions:
#             prompt = f"""Provide a precise, concise answer to the following question
#             based strictly on the given context:

#             Context: {input_text}
#             Question: {question}

#             Answer:"""

#             messages = [
#                 {
#                     "role": "system",
#                     "content": "You are an expert providing exact, factual answers based on the given context."
#                 },
#                 {
#                     "role": "user",
#                     "content": prompt
#                 }
#             ]

#             try:
#                 completion = self.client.chat.completions.create(
#                     model=self.model,
#                     messages=messages,
#                     max_tokens=300
#                 )

#                 correct_answer = completion.choices[0].message.content.strip()
#                 correct_answers.append(correct_answer)

#             except Exception as e:
#                 print(f"Answer generation error: {e}")
#                 correct_answers.append("Unable to generate answer")

#         return correct_answers


#     def _custom_similarity_evaluation(self, user_answer: str, correct_answer: str) -> Dict:
#         """
#         Custom similarity evaluation with configurable parameters.

#         :param user_answer: User's provided answer
#         :param correct_answer: Correct answer
#         :return: Detailed evaluation dictionary
#         """
#         # Get current mode configuration
#         mode_config = self.mode_configs.get(self.evaluation_mode, self.mode_configs['balanced'])

#         # Lowercase for case-insensitive comparison
#         user_lower = user_answer.lower().strip()
#         correct_lower = correct_answer.lower().strip()

#         # Semantic similarity using difflib
#         semantic_similarity = difflib.SequenceMatcher(None, user_lower, correct_lower).ratio() * 100

#         # Keyword matching
#         user_keywords = set(user_lower.split())
#         correct_keywords = set(correct_lower.split())
#         keyword_overlap = len(user_keywords & correct_keywords)
#         total_keywords = len(correct_keywords)

#         # Keyword matching score
#         keyword_score = (keyword_overlap / total_keywords * 100) if total_keywords > 0 else 0

#         # Weighted calculation with mode-specific weights
#         accuracy = (
#             (mode_config['semantic_weight'] * semantic_similarity) +
#             (mode_config['keyword_weight'] * keyword_score) +
#             mode_config['partial_match_bonus']
#         )

#         # Ensure accuracy is between 0 and 100
#         accuracy = max(0, min(100, accuracy))

#         # Identify missing keywords
#         missing_keywords = list(correct_keywords - user_keywords)

#         return {
#             'accuracy': round(accuracy, 2),
#             'semantic_similarity': round(semantic_similarity, 2),
#             'keyword_score': round(keyword_score, 2),
#             'missing_keywords': missing_keywords,
#             'is_correct': accuracy >= self.accuracy_threshold
#         }

#     # def evaluate_answer(self, user_answer: str, correct_answer: str) -> Dict:
#     def evaluate_answer(self, user_answer: str, correct_answer: str) -> Dict:
#         """
#         Evaluate a single user answer with advanced, flexible methods.

#         :param user_answer: User's provided answer
#         :param correct_answer: Correct answer to the question
#         :return: Comprehensive evaluation dictionary
#         """
#         # Primary AI-assisted evaluation
#         try:
#             # Flexible evaluation prompt
#             prompt = f"""Perform a nuanced, multi-dimensional answer comparison:

# Correct Answer: {correct_answer}
# User Answer: {user_answer}

# Evaluation Guidelines:
# - Assess semantic alignment
# - Check factual correctness
# - Identify key information coverage
# - Provide constructive feedback

# Provide:
# 1. Semantic Accuracy Percentage (0-100)
# 2. Key Missing Points
# 3. Brief Comparative Analysis

# Response Format:
# Accuracy:XX,
# Missing Points:[list],
# Analysis:detailed text"""

#             messages = [
#                 {
#                     "role": "system",
#                     "content": f"You are an expert evaluator. Current mode: {self.evaluation_mode}. "
#                               f"Accuracy Threshold: {self.accuracy_threshold}%"
#                 },
#                 {
#                     "role": "user",
#                     "content": prompt
#                 }
#             ]

#             # AI-assisted evaluation
#             completion = self.client.chat.completions.create(
#                 model=self.model,
#                 messages=messages,
#                 max_tokens=500
#             )

#             evaluation_text = completion.choices[0].message.content
#             # print(f"AI Evaluation: {evaluation_text}")

#             # Extract AI-suggested accuracy
#             accuracy_match = re.search(r'Accuracy.*?(\d+)%', evaluation_text)
#             ai_accuracy = int(accuracy_match.group(1)) if accuracy_match else None

#             # Extract missing points
#             missing_points_pattern = (
#                 r'Missing Points:.*?\n(.*?)(?=\nAnalysis)|'  # Match "Missing Points" section before "Analysis"
#                 r'Key Missing Points:.*?\n(.*?)(?=\n3\.)|'  # Match "Key Missing Points" section
#                 r'Missing Points:.*?\n\[(.*?)\]|'            # Match "Missing Points" section with list format
#                 r'Key Missing Points:.*?\n(?:\s*-\s.*?\n)+|'  # Match "Key Missing Points" section with bullet points
#                 r'\*?\*?Key Missing Points:\*?\*?.*?\n((?:\s*-[^\n]+\n(?:\s+-[^\n]+\n)*)+)|'  # Match bold or normal Key Missing Points with nested bullets
#                 r'\*?\*?Key Missing Points:\*?\*?.*?\n(?:\s*-\s.*?\n)+'  # Match Key Missing Points with bullet
#              )
#             missing_points_match = re.search(missing_points_pattern, evaluation_text, re.DOTALL)
#             missing_points = []
#             if missing_points_match:
#                 missing_points_group = missing_points_match.group(1) or missing_points_match.group(2) or missing_points_match.group(3) or missing_points_match.group(4) or missing_points_match.group(5)
#                 if missing_points_group:
#                     missing_points = [
#                         point.strip('- ').strip()
#                         for point in missing_points_group.split('\n')
#                         if point.strip()
#                     ]  
#             # missing_points = [
#             #     point.strip()
#             #     for point in missing_points_match.group(1).split(',')
#             #     if point.strip()
#             # ] if missing_points_match else []

#         except Exception as e:
#             # print(f"AI Evaluation error: {e}")
#             ai_accuracy = None
#             missing_points = []

#         # Fallback to custom similarity evaluation
#         custom_evaluation = self._custom_similarity_evaluation(user_answer, correct_answer)

#         # Combine AI and custom evaluation
#         final_accuracy = ai_accuracy if ai_accuracy is not None else custom_evaluation['accuracy']
#         is_correct = final_accuracy >= self.accuracy_threshold

#         # Update score if correct
#         if is_correct:
#             self.score += 1

#         return {
#             "is_correct": is_correct,
#             "accuracy": final_accuracy,
#             "custom_evaluation": custom_evaluation,
#             "missing_points": missing_points,
#             "correct_answer": correct_answer,
#             "user_answer": user_answer
#         }

#     # Rest of the class remains the same as in previous implementation
#     def run_assessment(self, input_text: str, num_questions: int = 5):
#         """
#         Run the complete assessment process.

#         :param input_text: Text to generate questions from
#         :param num_questions: Number of questions to generate
#         """
#         # Generate questions
#         questions = self.generate_questions(input_text, num_questions)

#         if not questions:
#             print("Failed to generate questions.")
#             return

#         # Display questions
#         print("\n--- Assessment Questions ---")
#         for i, question in enumerate(questions, 1):
#             print(f"Question {i}: {question}")

#         # Collect user answers
#         user_answers = []
#         for i, question in enumerate(questions, 1):
#             print(f"\nQuestion {i}")
#             user_answer = input("Your answer: ").strip()
#             user_answers.append(user_answer)

#         # Generate correct answers
#         correct_answers = self.generate_correct_answers(input_text, questions)

#         # Evaluate answers
#         print("\n--- Assessment Results ---")
#         for i, (user_answer, correct_answer) in enumerate(zip(user_answers, correct_answers), 1):
#             print(f"\nQuestion {i} Evaluation:")
#             result = self.evaluate_answer(user_answer, correct_answer)

#             # Display detailed results
#             print(f"Status: {'Correct' if result['is_correct'] else 'Incorrect'}")
#             print(f"Accuracy: {result['accuracy']}%")
#             print(f"Correct Answer: {result['correct_answer']}")

#             if not result['is_correct']:
#                 print("Missing Points:")
#                 for point in result['missing_points']:
#                     print(f"- {point}")
#                 # print(f"Explanation: {result['explanation']}")

#         # Final score
#         print(f"\nTotal Score: {self.score}/{len(questions)}")

# def main():
#     # Replace with your actual Hugging Face API key
#     API_KEY = os.getenv('HUGGINGFACE_API_KEY')
#     # API_KEY = os.getenv('OPENAI_API_KEY','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')


#     # Example input text
#     input_text = (
#         """
# What is Parallel Computer?
# PAGE 7
#  A computer which consists of a number of inter-connected computers which
# cooperatively execute a single program to solve a problem is called a parallel
# computer.
#  All current micro-processors are parallel processors.
#  Each processor in a microprocessor chip is called a core and such a
# microprocessor is called a multicore processor.
#  The processor retrieves a sequence of instructions from the main memory and
# stores them in an on-chip memory. The “cores” can then cooperate to execute
# these instructions in parallel.
#  Even though the speed of single processor computers is continuously
# increasing, problems which are required to be solved nowadays are becoming
# more complex

# """
#     )

#     # Create assessment with custom parameters
#     assessment = AssessmentSystem(
#         API_KEY,
#         accuracy_threshold=60,  # Lower threshold
#         evaluation_mode='lenient'  # More relaxed evaluation
#     )

#     # Run assessment
#     assessment.run_assessment(input_text)

# if __name__ == "__main__":
#     main()




import os
from dotenv import load_dotenv
load_dotenv()
import google.generativeai as genai  # New import
import re
import difflib
from typing import List, Dict, Optional

class AssessmentSystem:
    def __init__(self,
                 api_key: str,
                 model: str = "gemini-pro",  # Changed default model
                 accuracy_threshold: int = 70,
                 evaluation_mode: str = 'balanced'):
        """
        Initialize the Assessment Management System with configurable evaluation.

        :param api_key: Google API key
        :param model: The model to use (default is gemini-pro)
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

            # Configurable evaluation parameters
            self.accuracy_threshold = accuracy_threshold
            self.evaluation_mode = evaluation_mode

            # Evaluation mode configurations
            self.mode_configs = {
                'lenient': {
                    'semantic_weight': 0.6,
                    'keyword_weight': 0.4,
                    'partial_match_bonus': 10
                },
                'balanced': {
                    'semantic_weight': 0.7,
                    'keyword_weight': 0.3,
                    'partial_match_bonus': 5
                },
                'strict': {
                    'semantic_weight': 0.8,
                    'keyword_weight': 0.2,
                    'partial_match_bonus': 0
                }
            }

        except Exception as e:
            print(f"Initialization error: {str(e)}")
            raise

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
        
        prompt = f"""Generate {num_questions} high-quality, specific comprehension questions
        that directly test the key points of this text. Ensure questions are:
        - Clear and unambiguous
        - Directly based on the text's content
        - Require specific, factual answers

        Input Text: {input_text}

        Provide only the questions, without numbering or additional text."""

        try:
            response = self.client.generate_content(prompt)
            if not response or not response.text:
                raise Exception("Empty response from API")
            
            generated_text = response.text
            
            questions = [
                q.strip()
                for q in re.split(r'\n+', generated_text)
                if q.strip() and not q.strip()[0].isdigit()
            ][:num_questions]
            
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
            prompt = f"""Provide a precise, concise answer to the following question
            based strictly on the given context:

            Context: {input_text}
            Question: {question}

            Answer:"""

            try:
                response = self.client.generate_content(prompt)
                correct_answer = response.text.strip()
                correct_answers.append(correct_answer)

            except Exception as e:
                print(f"Answer generation error: {e}")
                correct_answers.append("Unable to generate answer")

        return correct_answers

    def _custom_similarity_evaluation(self, user_answer: str, correct_answer: str) -> Dict:
        """
        Custom similarity evaluation with configurable parameters.

        :param user_answer: User's provided answer
        :param correct_answer: Correct answer
        :return: Detailed evaluation dictionary
        """
        # Get current mode configuration
        mode_config = self.mode_configs.get(self.evaluation_mode, self.mode_configs['balanced'])

        # Lowercase for case-insensitive comparison
        user_lower = user_answer.lower().strip()
        correct_lower = correct_answer.lower().strip()

        # Semantic similarity using difflib
        semantic_similarity = difflib.SequenceMatcher(None, user_lower, correct_lower).ratio() * 100

        # Keyword matching
        user_keywords = set(user_lower.split())
        correct_keywords = set(correct_lower.split())
        keyword_overlap = len(user_keywords & correct_keywords)
        total_keywords = len(correct_keywords)

        # Keyword matching score
        keyword_score = (keyword_overlap / total_keywords * 100) if total_keywords > 0 else 0

        # Weighted calculation with mode-specific weights
        accuracy = (
            (mode_config['semantic_weight'] * semantic_similarity) +
            (mode_config['keyword_weight'] * keyword_score) +
            mode_config['partial_match_bonus']
        )

        # Ensure accuracy is between 0 and 100
        accuracy = max(0, min(100, accuracy))

        # Identify missing keywords
        missing_keywords = list(correct_keywords - user_keywords)

        return {
            'accuracy': round(accuracy, 2),
            'semantic_similarity': round(semantic_similarity, 2),
            'keyword_score': round(keyword_score, 2),
            'missing_keywords': missing_keywords,
            'is_correct': accuracy >= self.accuracy_threshold
        }

    # def evaluate_answer(self, user_answer: str, correct_answer: str) -> Dict:
    def evaluate_answer(self, user_answer: str, correct_answer: str) -> Dict:
        """
        Evaluate a single user answer with advanced, flexible methods.

        :param user_answer: User's provided answer
        :param correct_answer: Correct answer to the question
        :return: Comprehensive evaluation dictionary
        """
        # Primary AI-assisted evaluation
        try:
            # Flexible evaluation prompt
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
            evaluation_text = response.text

            # Extract AI-suggested accuracy
            accuracy_match = re.search(r'Accuracy.*?(\d+)%', evaluation_text)
            ai_accuracy = int(accuracy_match.group(1)) if accuracy_match else None

            # Extract missing points (using existing regex pattern)
            missing_points_pattern = (
                r'Missing Points:.*?\n(.*?)(?=\nAnalysis)|'  # Match "Missing Points" section before "Analysis"
                r'Key Missing Points:.*?\n(.*?)(?=\n3\.)|'  # Match "Key Missing Points" section
                r'Missing Points:.*?\n\[(.*?)\]|'            # Match "Missing Points" section with list format
                r'Key Missing Points:.*?\n(?:\s*-\s.*?\n)+|'  # Match "Key Missing Points" section with bullet points
                r'\*?\*?Key Missing Points:\*?\*?.*?\n((?:\s*-[^\n]+\n(?:\s+-[^\n]+\n)*)+)|'  # Match bold or normal Key Missing Points with nested bullets
                r'\*?\*?Key Missing Points:\*?\*?.*?\n(?:\s*-\s.*?\n)+'  # Match Key Missing Points with bullet
             )
            missing_points_match = re.search(missing_points_pattern, evaluation_text, re.DOTALL)
            missing_points = []
            if missing_points_match:
                missing_points_group = (
                    missing_points_match.group(1) or 
                    missing_points_match.group(2) or 
                    missing_points_match.group(3) or 
                    missing_points_match.group(4) or 
                    missing_points_match.group(5)
                )
                if missing_points_group:
                    missing_points = [
                        point.strip('- ').strip()
                        for point in missing_points_group.split('\n')
                        if point.strip()
                    ]  
            # missing_points = [
            #     point.strip()
            #     for point in missing_points_match.group(1).split(',')
            #     if point.strip()
            # ] if missing_points_match else []

        except Exception as e:
            # print(f"AI Evaluation error: {e}")
            ai_accuracy = None
            missing_points = []

        # Fallback to custom similarity evaluation
        custom_evaluation = self._custom_similarity_evaluation(user_answer, correct_answer)

        # Combine AI and custom evaluation
        final_accuracy = ai_accuracy if ai_accuracy is not None else custom_evaluation['accuracy']
        is_correct = final_accuracy >= self.accuracy_threshold

        # Update score if correct
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

    # Rest of the class remains the same as in previous implementation
    def run_assessment(self, input_text: str, num_questions: int = 5):
        """
        Run the complete assessment process.

        :param input_text: Text to generate questions from
        :param num_questions: Number of questions to generate
        """
        # Generate questions
        questions = self.generate_questions(input_text, num_questions)

        if not questions:
            print("Failed to generate questions.")
            return

        # Display questions
        print("\n--- Assessment Questions ---")
        for i, question in enumerate(questions, 1):
            print(f"Question {i}: {question}")

        # Collect user answers
        user_answers = []
        for i, question in enumerate(questions, 1):
            print(f"\nQuestion {i}")
            user_answer = input("Your answer: ").strip()
            user_answers.append(user_answer)

        # Generate correct answers
        correct_answers = self.generate_correct_answers(input_text, questions)

        # Evaluate answers
        print("\n--- Assessment Results ---")
        for i, (user_answer, correct_answer) in enumerate(zip(user_answers, correct_answers), 1):
            print(f"\nQuestion {i} Evaluation:")
            result = self.evaluate_answer(user_answer, correct_answer)

            # Display detailed results
            print(f"Status: {'Correct' if result['is_correct'] else 'Incorrect'}")
            print(f"Accuracy: {result['accuracy']}%")
            print(f"Correct Answer: {result['correct_answer']}")

            if not result['is_correct']:
                print("Missing Points:")
                for point in result['missing_points']:
                    print(f"- {point}")
                # print(f"Explanation: {result['explanation']}")

        # Final score
        print(f"\nTotal Score: {self.score}/{len(questions)}")

def main():
    # Use Google API key instead of Hugging Face
    API_KEY = os.getenv('GOOGLE_API_KEY')
    
    # Example input text
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

    # Create assessment with custom parameters
    assessment = AssessmentSystem(
        API_KEY,
        accuracy_threshold=60,  # Lower threshold
        evaluation_mode='lenient'  # More relaxed evaluation
    )

    # Run assessment
    assessment.run_assessment(input_text)

if __name__ == "__main__":
    main()
