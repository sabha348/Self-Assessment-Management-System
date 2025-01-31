import os
from dotenv import load_dotenv
load_dotenv()
import sys
import json
from typing import Dict, List
from assessment_system import AssessmentSystem

def json_encode(obj):
    """Helper function to properly encode JSON with special characters"""
    return json.dumps(obj, ensure_ascii=False, indent=None)

def correct_answer_handler(input_text: str, questions: List[str]) -> List[str]:

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
        print(f"An error occurred: {e}", file=sys.stderr)
        raise

if __name__ == "__main__":
    try:
        # if len(sys.argv) < 3:
        #     print("Error: Required arguments missing. Usage: script.py <input_text> <questions_json>", file=sys.stderr)
        #     sys.exit(1)
        # else:
            # Handle correct answer generation
        input_text = sys.argv[1] if len(sys.argv) > 1 else "hello my name is Sahil"
        questions = json.loads(sys.argv[2]) if len(sys.argv) > 2 else ["What is your name?"]
        results = correct_answer_handler(input_text, questions)
        
        print(json_encode(results))
        sys.exit(0)

    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        sys.exit(1)