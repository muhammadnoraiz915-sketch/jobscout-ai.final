import logging
from groq import Groq
from pydantic import BaseModel, field_validator
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import os
import uuid
import shutil
from rag.cv_parser import parse_cv
from agents.job_scout_agent import run_agent
from database.mongo import results_collection, sessions_collection
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
router = APIRouter()

UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_MSG_LENGTH = 500
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    if not file.filename.endswith(('.pdf', '.docx', '.doc')):
        raise HTTPException(status_code=400, detail="Only PDF or Word files are supported.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 5MB.")

    session_id = str(uuid.uuid4())
    file_path = f"{UPLOAD_DIR}/{session_id}_{file.filename}"

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        cv_text = parse_cv(file_path)

        if not cv_text or len(cv_text) < 50:
            raise HTTPException(status_code=400, detail="Could not extract text from CV.")

        try:
            sessions_collection.insert_one({
                "session_id": session_id,
                "filename": file.filename,
                "status": "processing"
            })
        except Exception as db_err:
            logger.warning("MongoDB insert skipped: %s", db_err)

        results = run_agent(cv_text, session_id)

        try:
            results_collection.insert_one({"session_id": session_id, **results})
            sessions_collection.update_one(
                {"session_id": session_id},
                {"$set": {"status": "completed"}}
            )
        except Exception as db_err:
            logger.warning("MongoDB update skipped: %s", db_err)

        os.remove(file_path)

        return JSONResponse(content={
            "success": True,
            "session_id": session_id,
            "message": f"{results['total_jobs']} jobs found!",
            "data": results
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error("upload_cv failed for session %s: %s", session_id, e)
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail="Processing failed. Please try again.")


@router.get("/results/{session_id}")
async def get_results(session_id: str):
    result = results_collection.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )

    if not result:
        raise HTTPException(status_code=404, detail="Results not found.")

    return JSONResponse(content={"success": True, "data": result})


@router.get("/health")
async def health():
    return {"status": "JobScout AI is running!"}


@router.get("/debug")
async def debug():
    results = {}

    # Test MongoDB
    try:
        from database.mongo import client as mongo_client
        mongo_client.admin.command("ping")
        results["mongodb"] = "ok"
    except Exception as e:
        results["mongodb"] = f"FAIL: {e}"

    # Test Groq
    try:
        test_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        resp = test_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Say ok"}],
            max_tokens=5,
        )
        results["groq"] = "ok"
    except Exception as e:
        results["groq"] = f"FAIL: {e}"

    # Test Tavily
    try:
        from tavily import TavilyClient
        tc = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        tc.search("test", max_results=1)
        results["tavily"] = "ok"
    except Exception as e:
        results["tavily"] = f"FAIL: {e}"

    results["env"] = {
        "GROQ_API_KEY": "set" if os.getenv("GROQ_API_KEY") else "MISSING",
        "MONGODB_URL": "set" if os.getenv("MONGODB_URL") else "MISSING",
        "TAVILY_API_KEY": "set" if os.getenv("TAVILY_API_KEY") else "MISSING",
    }

    return results


class ChatRequest(BaseModel):
    message: str
    cv_info: dict
    jobs: list

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty.")
        return v[:MAX_MSG_LENGTH]


@router.post("/chat")
async def chat_with_agent(request: ChatRequest):
    cv_summary = (
        f"Name: {request.cv_info.get('name', 'N/A')}\n"
        f"Skills: {', '.join(request.cv_info.get('skills', [])[:10])}\n"
        f"Experience: {request.cv_info.get('experience_years', 0)} years\n"
        f"Education: {request.cv_info.get('education', 'N/A')}\n"
        f"Summary: {request.cv_info.get('summary', '')[:200]}"
    )

    top_jobs = "\n".join(
        f"- {j.get('title', '')} ({j.get('score', 0)}%): {j.get('reasoning', '')[:100]}"
        for j in request.jobs[:3]
    )

    prompt = (
        "You are a career counselor. Based on the candidate profile and their matched jobs, "
        "answer their question concisely and helpfully.\n\n"
        f"Candidate:\n{cv_summary}\n\n"
        f"Top Jobs:\n{top_jobs}\n\n"
        f"Question: {request.message}\n\n"
        "Keep your answer short and actionable (under 150 words)."
    )

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300,
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        logger.error("chat endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="AI response failed. Please try again.")
