
from tavily import TavilyClient
import os
from dotenv import load_dotenv

load_dotenv()

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

_EXPIRED_PHRASES = [
    "no longer accepting",
    "no longer available",
    "no longer hiring",
    "position has been filled",
    "position filled",
    "not accepting applications",
    "application deadline has passed",
    "job has expired",
    "this job is closed",
    "hiring is closed",
    "this position is closed",
    "applications are closed",
    "vacancy has been filled",
    "role has been filled",
]

def _is_expired(title: str, description: str) -> bool:
    text = (title + " " + description).lower()
    return any(phrase in text for phrase in _EXPIRED_PHRASES)

def search_jobs(query: str) -> list:
    """Tavily se real-time jobs search karta hai"""
    try:
        results = tavily.search(
            query=query,
            search_depth="advanced",
            max_results=8,  # fetch extra so filtering doesn't leave us short
            include_domains=[
                "linkedin.com",
                "rozee.pk",
                "indeed.com",
                "glassdoor.com",
                "mustakbil.com"
            ],
            days=30,  # only jobs posted in the last 30 days
        )

        jobs = []
        for r in results.get("results", []):
            url = r.get("url", "").strip()
            title = r.get("title", "").strip()
            description = r.get("content", "")[:500]
            source = url.split("/")[2] if url else ""

            # Skip expired / closed postings
            if _is_expired(title, description):
                continue

            # Fallback: build a LinkedIn search URL when Tavily returns no direct link
            if not url and title:
                encoded = title.replace(" ", "+")
                url = f"https://www.linkedin.com/jobs/search/?keywords={encoded}"
                source = "linkedin.com"

            jobs.append({
                "title": title,
                "url": url,
                "description": description,
                "source": source,
            })
        return jobs
    except Exception as e:
        print(f"Search error: {e}")
        return []

def generate_search_queries(cv_info: dict) -> list:
    """CV info se search queries banata hai"""
    queries = []
    
    skills = cv_info.get("skills", [])[:3]
    titles = cv_info.get("job_titles", [])[:2]
    
    for title in titles:
        queries.append(f"{title} jobs Pakistan 2025")
        queries.append(f"{title} remote jobs 2025")
    
    if skills:
        skill_str = " ".join(skills[:3])
        queries.append(f"{skill_str} developer jobs")
    
    if not queries:
        queries = ["software developer jobs Pakistan", "IT jobs Pakistan 2024"]
    
    return queries[:4]  # Max 4 queries