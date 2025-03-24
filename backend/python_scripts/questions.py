import os
from dotenv import load_dotenv
load_dotenv()
import sys
import json
import base64
from typing import Dict, List, Union
from assessment_system import AssessmentSystem

def json_encode(obj: Union[List, Dict, str]) -> str:
    """Helper function to properly encode JSON with special characters"""
    try:
        json_str = json.dumps(obj, ensure_ascii=False)
        # Base64 encode to avoid string escaping issues
        return base64.b64encode(json_str.encode()).decode()
    except Exception as e:
        return json.dumps({"error": str(e)})

def handle_assessment(input_text: str, num_questions: int = 5) -> List[str]:
    """Handle the assessment process and return questions."""
    try:
        # Clean input text
        input_text = ' '.join(input_text.split())
        if not input_text:
            raise ValueError("Empty input text received")

        # Get API key
        # api_key = os.getenv('HUGGINGFACE_API_KEY')
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("API key not found in environment variables")

        # Initialize assessment system
        assessment = AssessmentSystem(
            api_key=api_key,
            accuracy_threshold=60,
            evaluation_mode='lenient'
        )

        # Generate and validate questions
        questions = assessment.generate_questions(input_text, num_questions)
        if not questions:
            raise Exception("No questions were generated")

        # Clean questions
        cleaned_questions = [
            q.strip().replace('\n', ' ').replace('  ', ' ')
            for q in questions
            if isinstance(q, str) and q.strip()
        ]

        if not cleaned_questions:
            raise Exception("No valid questions after cleaning")

        return cleaned_questions

    except Exception as e:
        print(f"Error in handle_assessment: {str(e)}", file=sys.stderr)
        raise

if __name__ == "__main__":
    try:
        # Get and validate input arguments
        if len(sys.argv) < 2:
            raise ValueError("Missing required text argument")

        input_text = sys.argv[1]
        try:
            num_questions = int(sys.argv[2]) if len(sys.argv) > 2 else 5
            if num_questions < 1:
                raise ValueError
        except ValueError:
            print(json_encode({"error": "Invalid number of questions"}))
            sys.exit(1)

        # Process the assessment
        results = handle_assessment(input_text, num_questions)
        
        # Encode and output results
        print(json_encode(results))
        sys.exit(0)

    except Exception as e:
        print(json_encode({"error": str(e)}))
        sys.exit(1)