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

# def evaluate_answers(user_answers: List[str],correct_answers: List[str]) -> Dict:
def evaluate_answers(answers_data: Dict) -> Dict:
    """
    Evaluate submitted answers and return results.
    """
    try:
        # logger.debug("Starting answer evaluation")
        api_key = os.getenv('HUGGINGFACE_API_KEY')  # Retrieve API key from environment variable
        if not api_key:
            raise ValueError("API key not found. Please set the 'HUGGINGFACE_API_KEY' environment variable.")        
        assessment = AssessmentSystem(
            
            api_key=api_key,
            accuracy_threshold=60,
            evaluation_mode='lenient'
        )

        results = []
        total_score = 0

        # # Convert JSON strings to arrays if needed
        # if isinstance(user_answers, str):
        #     user_answers = json.loads(user_answers)
        # if isinstance(correct_answers, str):
        #     correct_answers = json.loads(correct_answers)

        # # Ensure both are lists/arrays
        # if not isinstance(user_answers, list):
        #     user_answers = [user_answers]
        # if not isinstance(correct_answers, list):
        #     correct_answers = [correct_answers]

        for i, (user_answer, correct_answer) in enumerate(zip(
            answers_data['answers'], 
            answers_data['correct_answers']
            )):
            # logger.debug(f"Evaluating answer {i+1}")
            result = assessment.evaluate_answer(user_answer, correct_answer)
            if result['is_correct']:
                total_score += 1
            results.append(result)

        # for i in range(len(user_answers)):
        #     # logger.debug(f"Evaluating answer {i+1}")
        #     user_answer = user_answers[i]
        #     correct_answer = correct_answers[i]
        #     result = assessment.evaluate_answer(user_answer, correct_answer)
        #     if result['is_correct']:
        #         total_score += 1
        #     results.append(result)

        # logger.debug("Evaluation completed successfully")
        # print(results)
        return {
            "evaluations": results,
            "totalScore": total_score,
            # "totalQuestions": len(answers_data['answers'])
        }
    except Exception as e:
    #     logger.error(f"Error in evaluate_answers: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    try:
        
        if len(sys.argv) < 2:
            print(json_encode({"error": "Missing required arguments"}))
            sys.exit(1)

        # if sys.argv[1].startswith('{'):
        else:
            # Handle answer evaluation
            #pass {"answers":["yes","yes","yes","yes","yes"],"correct_answers":["Sahil","The speaker introduces themselves with their name Sahil.","my name is Sahil","Two words","S"]} from received argument in sys.argv[1] to evaluate_answers function 
            data = json.loads(sys.argv[1])
            answers_data = {
                'answers': data["answers"],
                'correct_answers': data["correct_answers"]
            }
            results = evaluate_answers(answers_data)
            
        # else:
            # Handle initial assessment
        # print(sys.argv[1])
        # user_answers = json.loads(sys.argv[1]) if len(sys.argv) > 1 else ["yes", "no"]
        # correct_answers = json.loads(sys.argv[2]) if len(sys.argv) > 2 else ["yes", "no"]
        # results = evaluate_answers(user_answers, correct_answers)

        # Ensure proper JSON encoding of the results
        print(json_encode(results))
        sys.exit(0)

    except Exception as e:
        print(json_encode({"error": str(e)}))
        sys.exit(1)