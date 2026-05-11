import logging
from groq import Groq
import os
import json
from dotenv import load_dotenv
from rag.embeddings import extract_cv_info
from agents.tools import search_jobs, generate_search_queries

load_dotenv()

logger = logging.getLogger(__name__)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def score_job(job: dict, cv_info: dict) -> dict:
    prompt = (
        "You are a career expert. Score this job for the candidate from 0-100 and give a short reason.\n\n"
        f"Candidate Skills: {cv_info.get('skills', [])}\n"
        f"Experience: {cv_info.get('experience_years', 0)} years\n"
        f"Previous Titles: {cv_info.get('job_titles', [])}\n"
        f"Education: {cv_info.get('education', '')}\n\n"
        f"Job Title: {job.get('title', '')}\n"
        f"Job Description: {str(job.get('description', ''))[:300]}\n\n"
        'Return ONLY valid JSON: {"score": 85, "reasoning": "Strong match because...", "missing_skills": ["skill1"]}'
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=150,
        )
        result = response.choices[0].message.content
        result = result.replace("```json", "").replace("```", "").strip()
        scored_data = json.loads(result)
        return {**job, **scored_data}
    except json.JSONDecodeError as e:
        logger.warning("score_job JSON parse failed for '%s': %s", job.get('title', ''), e)
        return {**job, "score": 50, "reasoning": "Score unavailable", "missing_skills": []}
    except Exception as e:
        logger.error("score_job failed for '%s': %s", job.get('title', ''), e)
        return {**job, "score": 50, "reasoning": "Score unavailable", "missing_skills": []}


def run_agent(cv_text: str, session_id: str) -> dict:
    logger.info("Agent starting for session: %s", session_id)

    logger.info("Step 1: Analyzing CV...")
    cv_info = extract_cv_info(cv_text)

    logger.info("Step 2: Generating search queries...")
    queries = generate_search_queries(cv_info)

    logger.info("Step 3: Searching jobs...")
    all_jobs = []
    for query in queries:
        jobs = search_jobs(query)
        all_jobs.extend(jobs)

    seen = set()
    unique_jobs = []
    for job in all_jobs:
        if job['url'] not in seen:
            seen.add(job['url'])
            unique_jobs.append(job)

    logger.info("Step 4: Scoring %d unique jobs...", len(unique_jobs))
    scored_jobs = []
    for job in unique_jobs[:10]:
        scored_job = score_job(job, cv_info)
        scored_jobs.append(scored_job)

    scored_jobs.sort(key=lambda x: x.get('score', 0), reverse=True)

    logger.info("Agent complete! %d jobs found.", len(scored_jobs))

    return {
        "session_id": session_id,
        "cv_info": cv_info,
        "jobs": scored_jobs,
        "total_jobs": len(scored_jobs)
    }
