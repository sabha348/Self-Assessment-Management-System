import os
from dotenv import load_dotenv
load_dotenv()
import sys
import json
from typing import Dict, List, Union
from assessment_system import AssessmentSystem

def json_encode(obj: Union[List, Dict, str]) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

def clean_text(text: str) -> str:
    """Clean and normalize input text"""
    return ' '.join(text.strip().split())

def parse_questions(questions_str: str) -> List[str]:
    """Safely parse questions from JSON string"""
    try:
        if isinstance(questions_str, str):
            # Clean the string before parsing
            cleaned_str = (questions_str
                         .replace('\\"', '"')        # Fix escaped quotes
                         .replace('\\n', ' ')        # Replace newlines
                         .replace('\n', ' ')         # Replace literal newlines
                         .strip())
            
            # Additional validation for JSON array
            if not (cleaned_str.startswith('[') and cleaned_str.endswith(']')):
                raise ValueError("Input must be a JSON array")
            
            questions = json.loads(cleaned_str)
            
            # Clean individual questions
            questions = [q.replace('\n', ' ').strip() for q in questions if q]
            return questions
            
        return questions_str
    except json.JSONDecodeError as e:
        print(f"Error parsing questions JSON: {e}", file=sys.stderr)
        print(f"Problematic input: {questions_str}", file=sys.stderr)
        raise ValueError(f"Invalid questions format: {e}")

def correct_answer_handler(input_text: str, questions: Union[str, List[str]]) -> List[str]:
    try:
        # Clean input text
        cleaned_text = ' '.join(input_text.split())
        if not cleaned_text:
            raise ValueError("Empty input text")

        # Parse and validate questions
        try:
            parsed_questions = parse_questions(questions)
        except Exception as e:
            print(f"Question parsing failed: {str(e)}", file=sys.stderr)
            raise

        if not isinstance(parsed_questions, list) or not parsed_questions:
            raise ValueError("Questions must be a non-empty list")

        # Get API key
        api_key = os.getenv('HUGGINGFACE_API_KEY')
        # api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("API key not found in environment variables")

        # Initialize assessment system
        assessment = AssessmentSystem(
            api_key=api_key,
            accuracy_threshold=60,
            evaluation_mode='lenient'
        )

        # Generate answers
        correct_answers = assessment.generate_correct_answers(cleaned_text, parsed_questions)
        if not correct_answers:
            raise Exception("Failed to generate answers")

        return correct_answers

    except Exception as e:
        print(f"Error in correct_answer_handler: {str(e)}", file=sys.stderr)
        raise

if __name__ == "__main__":
    try:
        # Validate arguments
        if len(sys.argv) < 3:
            raise ValueError("Missing required arguments")

        # Get input text and questions
        input_text = sys.argv[1]
        questions_json = sys.argv[2]

        # Process and encode results
        results = correct_answer_handler(input_text, questions_json)
        print(json_encode(results))
        sys.exit(0)

    except Exception as e:
        print(json_encode({"error": str(e)}))
        sys.exit(1)