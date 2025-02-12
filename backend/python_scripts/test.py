import re

def evaluate_answer():

            evaluation_text = """
**1. Semantic Accuracy Percentage (0-100): 15%**

- The user's answer, "dd", is a bare minimum attempt and does not bear any semantic resemblance to the correct answer.     

**2. Key Missing Points:**
   - The correct answer discusses the following key points, all of which are absent in the user's answer:
     - Complexity of modern problems
     - Speed of single processor computers
     - Parallel computing
     - Importance of parallel computing for efficient problem-solving
     - Increasing trend towards parallel computing due to the outpacing complexity

**3. Brief Comparative Analysis:**

- The correct answer provides a clear explanation of the current state of computing, Raise common issues in Problem-solving, Highlights the solution of parallel computing, and explains why this solution is increasingly important.
- The user's answer is not only factually incorrect but also semantically impoverished. It fails to convey any meaningful information and doesn't even attempt to address the topic. It appears to be a random input, possibly due to a misunderstanding of the question or an attempt to shortcut the process.
"""

            # Extract AI-suggested accuracy
            accuracy_match = re.search(r'Accuracy.*?(\d+)%', evaluation_text)
            ai_accuracy = int(accuracy_match.group(1)) if accuracy_match else None

            # Extract missing points
            missing_points_pattern = (
                r'\*?\*?Key Missing Points:\*?\*?.*?\n((?:\s*-[^\n]+\n(?:\s+-[^\n]+\n)*)+)|'  # Match bold or normal Key Missing Points with nested bullets
                r'\*?\*?Key Missing Points:\*?\*?.*?\n(?:\s*-\s.*?\n)+'  # Match Key Missing Points with bullet
                r'Key Missing Points:.*?\n(.*?)(?=\n3\.)|'  # Match "Key Missing Points" section
                r'Missing Points:.*?\n(.*?)(?=\nAnalysis)|'  # Match "Missing Points" section before "Analysis"
                r'Missing Points:.*?\n\[(.*?)\]|'            # Match "Missing Points" section with list format
                r'Key Missing Points:.*?\n(?:\s*-\s.*?\n)+'  # Match "Key Missing Points" section with bullet points
             )
            missing_points_match = re.search(missing_points_pattern, evaluation_text, re.DOTALL)
            # print(f'Missing points: {missing_points_match}')
            missing_points = []
            if missing_points_match:
                missing_points_group = missing_points_match.group(1) or missing_points_match.group(2)
                if missing_points_group:
                    missing_points = [
                        point.strip('- ').strip()
                        for point in missing_points_group.split('\n')
                        if point.strip()
                    ]

            print(f'AI Accuracy_match: {ai_accuracy}')
            print(f'Missing Points_match: {missing_points}')

if __name__ == "__main__":
    evaluate_answer()

# first
# Accuracy: 65%

# Missing Points:
# - The statement doesn't mention the term "Moore's law" which predicted and described the observed phenomenon of transistors becoming smaller and faster over time.
# - It doesn't explicitly refer to the recent flattening or slowing down of this trend (a concept known as "Moore's law slowdown" or "Moore's law is dead").
# - It lacks detail about what "parallel computing" specifically entails, such as using multiple processors or cores to handle different parts of a task simultaneously.

# Analysis:
# The user's answer captures the main point about modern problems being too complex for single processor computers, and the need for parallel computing to tackle them efficiently. However, it misses important context about the historical trend in computing power (which is where the current issue arises from) and it lacks specific detail about what parallel computing is and how it helps. To improve, the user should familiarize themselves with the historical context and the fundamentals of parallel computing. The answer is only partially accurate and could be misleading without the necessary context.


# second
# **Evaluation:**

# 1. **Semantic Accuracy Percentage:** 65%
#    - The user's answer captures the main idea of multicore processors working together to speed up instruction execution. They also mention "different cores tackling unrelated tasks," which aligns with task-level parallelism.

# 2. **Key Missing Points:**
#    - **Instruction-level parallelism (ILP)**: The user's answer does not explicitly mention or explain this crucial concept of breaking down a single instruction into simpler operations.
#    - **Concurrent processing of different parts of a single program or multiple programs**: The user's answer primarily focuses on task-level parallelism but does not clearly articulate that cores can also process different parts of the same program simultaneously.

# 3. **Comparative Analysis:**
#    - The user's answer correctly identifies that multiple cores work together and that they can tackle unrelated tasks concurrently.
#    - However, it lacks crucial details that distinguish it from the correct answer. The correct answer provides a more comprehensive explanation by mentioning instruction-level parallelism and how different cores can work on the same program or multiple programs at once.
#    - In total, the user's answer is somewhat correct (hence a 65% accuracy) but missing key details that demonstrate a complete understanding of the topic. A clearer explanation of ILP and the ability to process different parts of the same program would make the user's answer more accurate and comprehensive.



# third
# Accuracy: 50%,

# Missing Points:
# - "Core" is a very general term. The user's answer should specify what exactly is considered the core. For instance, it could be the central theme, main idea, central character, etc.

# Analysis:
# The user's answer is partially aligned with the correct answer, as "Core" is a term that can be used to describe the central or most important aspect of something. However, the user's answer lacks specificity, which is a significant issue in this context. The purpose of the question might be to identify the core theme of a story, the essential argument of an essay, or the key character in a play, but the user's answer does not provide any of these details. Therefore, while there is a semantic connection to the correct answer, the lack of specific details makes the user's response only partially accurate.    


# fourth
# **1. Semantic Accuracy Percentage: 70%**
#    - The user's response captures the core concept of a parallel computer, i.e., multiple computers working together (cooperatively executing). However, it lacks the crucial aspect of a single program's involvement.

# **2. Key Missing Points:**
#    - Mention of a single program: The user's response does not highlight that these multiple computers work on a single program, not separate ones. This is a fundamental characteristic of parallel computing.

# **3. Brief Comparative Analysis:**
#    - The user's response is partially correct as it captures the essence of multiple computers working together. However, it is similar to a description of a computer cluster, not a parallel computer. A parallel computer is specifically designed 
# to run a single program tackling a complex task simultaneously from various angles to expedite the process. Therefore, the 
# user's response, while on track, is not entirely accurate in its depiction of parallel computing. They need to emphasize that these multiple computers are cooperatively executing a single program to achieve their high-performance potential.      



# fifth
# **1. Semantic Accuracy Percentage: 70%**
#    - The user's response captures the core concept of a parallel computer, i.e., multiple computers working together (cooperatively executing). However, it lacks the crucial aspect of a single program's involvement.

# **2. Key Missing Points:**
#    - Mention of a single program: The user's response does not highlight that these multiple computers work on a single program, not separate ones. This is a fundamental characteristic of parallel computing.

# **3. Brief Comparative Analysis:**
#    - The user's response is partially correct as it captures the essence of multiple computers working together. However, it is similar to a description of a computer cluster, not a parallel computer. A parallel computer is specifically designed 
# to run a single program tackling a complex task simultaneously from various angles to expedite the process. Therefore, the 
# user's response, while on track, is not entirely accurate in its depiction of parallel computing. They need to emphasize that these multiple computers are cooperatively executing a single program to achieve their high-performance potential.      


