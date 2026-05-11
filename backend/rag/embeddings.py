import logging
from groq import Groq
import os
import json
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def extract_cv_info(cv_text: str) -> dict:
    prompt = (
        "Extract information from the CV below as JSON with these fields:\n"
        "name, skills (list), experience_years (number), job_titles (list), "
        "education, location, summary (2-3 sentences).\n"
        "Return ONLY valid JSON, nothing else.\n\n"
        "CV:\n" + cv_text[:2000]
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=400,
        )
        result = response.choices[0].message.content
        result = result.replace("```json", "").replace("```", "").strip()
        return json.loads(result)
    except json.JSONDecodeError as e:
        logger.warning("extract_cv_info JSON parse failed: %s", e)
        return {
            "name": "",
            "skills": [],
            "experience_years": 0,
            "job_titles": [],
            "education": "",
            "location": "",
            "summary": ""
        }
    except Exception as e:
        logger.error("extract_cv_info failed: %s", e)
        return {
            "name": "",
            "skills": [],
            "experience_years": 0,
            "job_titles": [],
            "education": "",
            "location": "",
            "summary": ""
        }
