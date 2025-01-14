import os
from dotenv import load_dotenv
load_dotenv()
import sys
from typing import Dict, List
from assessment_system import AssessmentSystem

def correct_answer_handler(input_text: str, questions: List[str]) -> Dict:

    try:
        # Initialize the assessment system
        api_key = os.getenv('HUGGINGFACE_API_KEY')  # Retrieve API key from environment variable
        if not api_key:
            raise ValueError("API key not found. Please set the 'ASSESSMENT_API_KEY' environment variable.")        
        
        assessment = AssessmentSystem(
            api_key=api_key,
            accuracy_threshold=60,
            evaluation_mode='lenient'
        )

        # Generate correct answers
        correct_answers = assessment.generate_correct_answers(input_text, questions)
        if not correct_answers:
            raise Exception("Failed to generate answers")

        return correct_answers
        
    except Exception as e:
        raise

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            sys.exit(1)
        else:
            # Handle correct answer generation
            input_text = sys.argv[1]
            questions = sys.argv[2]
            results = correct_answer_handler(input_text, questions)
        sys.exit(0)

    except Exception as e:
        sys.exit(1)