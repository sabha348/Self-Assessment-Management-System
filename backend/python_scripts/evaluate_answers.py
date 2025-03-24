import os
from dotenv import load_dotenv
load_dotenv()
import sys
import json
import base64
from typing import Dict, List
from assessment_system import AssessmentSystem

def json_encode(obj):
    """Helper function to properly encode JSON with special characters"""
    try:
        json_str = json.dumps(obj, ensure_ascii=False)
        # Base64 encode to avoid string escaping issues
        return base64.b64encode(json_str.encode()).decode()
    except Exception as e:
        return json.dumps({"error": str(e)})

def parse_input_data(data_str: str) -> Dict:
    """Parse and validate input data"""
    try:
        data = json.loads(data_str)
        if not isinstance(data, dict):
            raise ValueError("Input must be a dictionary")
        
        # Ensure required keys exist
        if 'answers' not in data or 'correct_answers' not in data:
            raise ValueError("Missing required keys: answers and correct_answers")
            
        # Ensure arrays have matching lengths
        if len(data['answers']) != len(data['correct_answers']):
            raise ValueError("Number of answers and correct answers must match")
            
        return data
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format: {str(e)}")

def evaluate_answers(answers_data: Dict) -> Dict:
    """
    Evaluate submitted answers and return results.
    """
    try:
        # api_key = os.getenv('HUGGINGFACE_API_KEY')
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("API key not found. Please set the 'HUGGINGFACE_API_KEY' environment variable.")        

        assessment = AssessmentSystem(
            api_key=api_key,
            accuracy_threshold=60,
            evaluation_mode='lenient'
        )

        results = []
        total_score = 0

        # Process each answer pair
        for user_answer, correct_answer in zip(
            answers_data['answers'], 
            answers_data['correct_answers']
        ):
            result = assessment.evaluate_answer(
                str(user_answer),
                str(correct_answer)
            )
            if result['is_correct']:
                total_score += 1
            results.append(result)

        return {
            "evaluations": results,
            "totalScore": total_score
        }
    except Exception as e:
        raise ValueError(f"Evaluation error: {str(e)}")

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Missing required arguments")

        # Parse input data
        input_data = parse_input_data(sys.argv[1])
        
        # Process evaluation
        results = evaluate_answers(input_data)
        
        # Output results
        print(json_encode(results))
        sys.exit(0)

    except Exception as e:
        print(json_encode({"error": str(e)}))
        sys.exit(1)