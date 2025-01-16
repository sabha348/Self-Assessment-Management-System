import os
from dotenv import load_dotenv
load_dotenv()
import sys
import json
from typing import Dict, List
from assessment_system import AssessmentSystem

# # Set up logging
# logging.basicConfig(
#     level=logging.DEBUG,
#     format='%(asctime)s - %(levelname)s - %(message)s',
#     handlers=[
#         logging.FileHandler('assessment_debug.log'),
#         logging.StreamHandler(sys.stdout)
#     ]
# )
def json_encode(obj):
    """Helper function to properly encode JSON with special characters"""
    return json.dumps(obj, ensure_ascii=False, indent=None)

# logger = logging.getLogger(__name__)

def handle_assessment(input_text: str, num_questions: int = 5) -> Dict:
    """
    Handle the assessment process and return JSON-serializable results.
    """
    try:
        # logger.debug(f"Starting assessment with text: {input_text[:100]}...")
        
        # Initialize the assessment system
        api_key = os.getenv('HUGGINGFACE_API_KEY')  # Retrieve API key from environment variable
        if not api_key:
            raise ValueError("API key not found. Please set the 'HUGGINGFACE_API_KEY' environment variable.")
        # logger.debug("Initializing AssessmentSystem")
        
        assessment = AssessmentSystem(
            api_key=api_key,
            accuracy_threshold=60,
            evaluation_mode='lenient'
        )

        # Generate questions
        # logger.debug("Generating questions")
        questions = assessment.generate_questions(input_text, num_questions)
        if not questions:
            raise Exception("Failed to generate questions")

        # # Generate correct answers
        # logger.debug("Generating correct answers")
        # correct_answers = assessment.generate_correct_answers(input_text, questions)

        # logger.debug("Assessment completed successfully")
        return questions
    
    except Exception as e:
        # logger.error(f"Error in handle_assessment: {str(e)}", exc_info=True)
        raise

def evaluate_answers(answers_data: Dict) -> Dict:
    """
    Evaluate submitted answers and return results.
    """
    try:
        # logger.debug("Starting answer evaluation")
        api_key = os.getenv('HUGGINGFACE_API_KEY')  # Retrieve API key from environment variable
        if not api_key:
            raise ValueError("API key not found. Please set the 'ASSESSMENT_API_KEY' environment variable.")        
        assessment = AssessmentSystem(
            
            api_key=api_key,
            accuracy_threshold=60,
            evaluation_mode='lenient'
        )

        results = []
        total_score = 0

        for i, (user_answer, correct_answer) in enumerate(zip(
            answers_data['answers'], 
            answers_data['correctAnswers']
        )):
            # logger.debug(f"Evaluating answer {i+1}")
            result = assessment.evaluate_answer(user_answer, correct_answer)
            if result['is_correct']:
                total_score += 1
            results.append(result)

        # logger.debug("Evaluation completed successfully")
        return {
            "evaluations": results,
            "totalScore": total_score,
            "totalQuestions": len(answers_data['answers'])
        }
    except Exception as e:
    #     logger.error(f"Error in evaluate_answers: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    try:
        # logger.debug(f"Script started with arguments: {sys.argv}")
        
        # if len(sys.argv) < 2:
        #     print(json_encode({"error": "Missing required arguments"}))
        #     sys.exit(1)

        # if sys.argv[1].startswith('{'):
        #     # Handle answer evaluation
        #     answers_data = json.loads(sys.argv[1])
        #     results = evaluate_answers(answers_data)
        # else:
            # Handle initial assessment
        input_text = sys.argv[1] if len(sys.argv) > 1 else "hello my name is Sahil"
        num_questions = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        results = handle_assessment(input_text, num_questions)

        # Ensure proper JSON encoding of the results
        print(json_encode(results))
        sys.exit(0)

    except Exception as e:
        print(json_encode({"error": str(e)}))
        sys.exit(1)