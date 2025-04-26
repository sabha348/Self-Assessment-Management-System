import os
from dotenv import load_dotenv
load_dotenv()
import sys
import json
import base64
from typing import Dict, List, Union
from assessment_system import AssessmentSystem

def json_encode(obj: Union[List, Dict, str]) -> str:
    try:
        json_str = json.dumps(obj, ensure_ascii=False)
        # Base64 encode to avoid string escaping issues
        return base64.b64encode(json_str.encode()).decode()
    except Exception as e:
        return json.dumps({"error": str(e)})

def clean_text(text: str) -> str:
    """Clean and normalize input text"""
    return ' '.join(text.strip().split())

def sanitize_and_parse_json(input_str):
    try:
        # Replace problematic characters
        sanitized_input = input_str.replace('\" \"', '","')
        return json.loads(sanitized_input)
    except json.JSONDecodeError as error:
        print(f"Error parsing JSON: {error.msg} at line {error.lineno} column {error.colno}")
        return None

def parse_questions(questions_str: str) -> List[str]:
    """Safely parse questions from JSON string"""
    try:
        if isinstance(questions_str, str):
            # Enhanced cleaning for complex escape sequences
            cleaned_str = questions_str
            
            # Try multiple approaches to fix escape sequences
            try:
                # First attempt: standard JSON load
                questions = json.loads(cleaned_str)
            except json.JSONDecodeError:
                try:
                    # Second attempt: replace problematic escape sequences
                    cleaned_str = (cleaned_str
                                .replace('\\"', '"')
                                .replace('\\\\', '\\')
                                .replace('\\n', ' ')
                                .replace('\n', ' ')
                                .strip())
                    
                    # Handle raw string literal markers that might be present
                    if cleaned_str.startswith('r"') or cleaned_str.startswith("r'"):
                        cleaned_str = cleaned_str[1:]
                        
                    questions = json.loads(cleaned_str)
                except json.JSONDecodeError:
                    try:
                        # Third attempt: manually parse the list structure
                        if cleaned_str.startswith('[') and cleaned_str.endswith(']'):
                            # Extract individual questions by parsing manually
                            items = []
                            current = ""
                            in_quotes = False
                            escape_next = False
                            
                            for char in cleaned_str[1:-1]:
                                if escape_next:
                                    current += char
                                    escape_next = False
                                    continue
                                    
                                if char == '\\':
                                    escape_next = True
                                    current += char
                                elif char == '"' and not escape_next:
                                    in_quotes = not in_quotes
                                    current += char
                                elif char == ',' and not in_quotes:
                                    items.append(current.strip())
                                    current = ""
                                else:
                                    current += char
                                    
                            if current:
                                items.append(current.strip())
                                
                            questions = [item.strip('"') for item in items]
                        else:
                            # Single question case
                            questions = [cleaned_str]
                    except Exception as e:
                        print(f"Manual parsing failed: {e}", file=sys.stderr)
                        # Last resort: just split by comma if it looks like a list
                        if cleaned_str.startswith('[') and cleaned_str.endswith(']'):
                            questions = [q.strip(' "\'') for q in cleaned_str[1:-1].split(',')]
                        else:
                            questions = [cleaned_str]
            
            # Clean individual questions
            questions = [q.replace('\n', ' ').strip() for q in questions if q]
            return questions
            
        return questions_str
    except json.JSONDecodeError as e:
        print(f"Error parsing questions JSON: {e}", file=sys.stderr)
        print(f"Problematic input: {questions_str}", file=sys.stderr)
        # Add enhanced recovery - try to extract questions even if JSON is malformed
        try:
            if isinstance(questions_str, str) and '[' in questions_str and ']' in questions_str:
                # Extract content between first [ and last ]
                content = questions_str[questions_str.find('[')+1:questions_str.rfind(']')]
                # Attempt to split by quote-comma-quote pattern
                import re
                questions = re.split(r'",\s*"', content)
                questions = [q.strip('"\'') for q in questions]
                if questions:
                    print(f"Recovered {len(questions)} questions through fallback method", file=sys.stderr)
                    return questions
        except Exception as recovery_error:
            print(f"Recovery attempt failed: {recovery_error}", file=sys.stderr)
        
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