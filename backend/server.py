"""Resume Screener API - FastAPI + MongoDB.
Free in-house matching engine (TF-IDF quick + local embeddings deep),
knowledge cache, feedback training loop, BYO-key AI providers, JWT + Google auth.
"""
from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, List
from pathlib import Path
from datetime import datetime, timezone
import asyncio
import logging
import os
import threading
import uuid

from engine import quick_analyze, deep_analyze, preload_model, extract_skills
from parsing import parse_file, content_hash, ParseError
from security_utils import (
    hash_password, verify_password, create_token, decode_token,
    encrypt_secret, decrypt_secret, mask_key,
)
from ai_providers import ai_analyze, test_connection, AIProviderError, DEFAULT_MODELS
from skills_data import all_skills, SYNONYM_SEED

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Resume Decoded API")
api = APIRouter(prefix="/api")

MAX_RESUMES = 3
MAX_GROUPS = 2
MAX_SCANS_PER_GROUP = 5
MAX_TEXT_LEN = 50000

# In-memory cache of skill weights/synonyms (refreshed on feedback writes)
_kb_cache = {"weights": None, "synonyms": None}


# ---------------- helpers ----------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def serialize_doc(doc):
    """Strip Mongo _id and ensure JSON-safe types."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        return {k: serialize_doc(v) for k, v in doc.items() if k != "_id"}
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc


async def get_kb():
    """Load skill weights + synonyms (cached in memory)."""
    if _kb_cache["weights"] is None:
        weights = {}
        async for s in db.skills_kb.find({}, {"_id": 0}):
            weights[s["skill"]] = s.get("weight", 1.0)
        synonyms = {}
        async for s in db.synonyms_kb.find({}, {"_id": 0}):
            synonyms[s["synonym"]] = s["canonical"]
        _kb_cache["weights"] = weights
        _kb_cache["synonyms"] = synonyms
    return _kb_cache["weights"], _kb_cache["synonyms"]


def invalidate_kb_cache():
    _kb_cache["weights"] = None
    _kb_cache["synonyms"] = None


async def current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Please log in to continue.")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(401, "Your session has expired. Please log in again.")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Account not found. Please log in again.")
    return user


# ---------------- models ----------------
class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthInput(BaseModel):
    credential: str


class ResumeCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=50, max_length=MAX_TEXT_LEN)


class ResumeUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=80)
    is_default: Optional[bool] = None


class AnalyzeInput(BaseModel):
    resume_id: Optional[str] = None
    resume_text: Optional[str] = Field(None, max_length=MAX_TEXT_LEN)
    jd_text: str = Field(min_length=50, max_length=MAX_TEXT_LEN)
    mode: str = Field(pattern="^(quick|deep|ai)$")
    provider: Optional[str] = None


class FeedbackInput(BaseModel):
    overall_accurate: Optional[bool] = None
    skill_corrections: Dict[str, str] = {}  # skill -> correct|incorrect|important
    missing_skills_to_add: List[str] = []
    comment: Optional[str] = Field(None, max_length=1000)


class ApiKeyInput(BaseModel):
    provider: str = Field(pattern="^(openai|anthropic|gemini|ollama)$")
    api_key: str = Field(min_length=1, max_length=500)
    model: Optional[str] = Field(None, max_length=100)


class TestKeyInput(BaseModel):
    provider: str = Field(pattern="^(openai|anthropic|gemini|ollama)$")


class AnalysisUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    group_id: Optional[str] = None
    remove_from_group: bool = False


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class GroupUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


# ---------------- startup ----------------
@app.on_event("startup")
async def startup():
    # seed skills KB if empty
    if await db.skills_kb.count_documents({}) == 0:
        docs = [{"skill": s["skill"], "category": s["category"], "weight": 1.0, "source": "seed"} for s in all_skills()]
        await db.skills_kb.insert_many(docs)
        logger.info(f"Seeded {len(docs)} skills")
    if await db.synonyms_kb.count_documents({}) == 0:
        docs = [{"synonym": k, "canonical": v, "source": "seed"} for k, v in SYNONYM_SEED.items()]
        await db.synonyms_kb.insert_many(docs)
        logger.info(f"Seeded {len(docs)} synonyms")
    # indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.resumes.create_index([("user_id", 1)])
    await db.analyses.create_index([("user_id", 1), ("created_at", -1)])
    await db.resume_cache.create_index("hash", unique=True)
    await db.skills_kb.create_index("skill", unique=True)
    # preload embeddings model in background (non-blocking)
    threading.Thread(target=preload_model, daemon=True).start()


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------------- health / config ----------------
@api.get("/health")
async def health():
    return {"status": "ok", "time": now_iso()}


@api.get("/auth/config")
async def auth_config():
    gcid = os.environ.get("GOOGLE_CLIENT_ID", "").strip().strip('"')
    return {"google_enabled": bool(gcid), "google_client_id": gcid or None}


# ---------------- auth ----------------
@api.post("/auth/register")
async def register(body: RegisterInput):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(409, "An account with this email already exists. Try logging in.")
    user = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "auth_provider": "email",
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@api.post("/auth/login")
async def login(body: LoginInput):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect.")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@api.post("/auth/google")
async def google_auth(body: GoogleAuthInput):
    gcid = os.environ.get("GOOGLE_CLIENT_ID", "").strip().strip('"')
    if not gcid:
        raise HTTPException(501, "Google sign-in is not configured on this server.")
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        info = google_id_token.verify_oauth2_token(body.credential, google_requests.Request(), gcid)
    except Exception:
        raise HTTPException(401, "Google sign-in failed. Please try again.")
    email = info.get("email", "").lower()
    if not email:
        raise HTTPException(401, "Google account has no email.")
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "name": info.get("name", email.split("@")[0]),
            "email": email,
            "password_hash": None,
            "auth_provider": "google",
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return serialize_doc(user)


# ---------------- resumes (max 3) ----------------
async def cache_resume_text(text: str):
    """Knowledge repository: cache parsed resume features by content hash."""
    h = content_hash(text)
    cached = await db.resume_cache.find_one({"hash": h}, {"_id": 0})
    if cached:
        await db.resume_cache.update_one({"hash": h}, {"$inc": {"hits": 1}, "$set": {"last_used": now_iso()}})
        return h, cached.get("skills", []), True
    weights, synonyms = await get_kb()
    skills = sorted(extract_skills(text, weights, synonyms))
    try:
        await db.resume_cache.insert_one({
            "hash": h, "skills": skills, "word_count": len(text.split()),
            "hits": 0, "created_at": now_iso(), "last_used": now_iso(),
        })
    except Exception:
        pass  # race: another request cached it first
    return h, skills, False


@api.get("/resumes")
async def list_resumes(user=Depends(current_user)):
    docs = await db.resumes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return serialize_doc(docs)


@api.post("/resumes")
async def create_resume(body: ResumeCreate, user=Depends(current_user)):
    count = await db.resumes.count_documents({"user_id": user["id"]})
    if count >= MAX_RESUMES:
        raise HTTPException(409, f"You can store up to {MAX_RESUMES} resumes. Delete one to add another.")
    h, skills, cached = await cache_resume_text(body.text)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "label": body.label.strip(),
        "text": body.text.strip(),
        "hash": h,
        "skills": skills,
        "source": "paste",
        "filename": None,
        "is_default": count == 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.resumes.insert_one(dict(doc))
    return serialize_doc(doc)


@api.post("/resumes/upload")
async def upload_resume(file: UploadFile = File(...), label: str = "", user=Depends(current_user)):
    count = await db.resumes.count_documents({"user_id": user["id"]})
    if count >= MAX_RESUMES:
        raise HTTPException(409, f"You can store up to {MAX_RESUMES} resumes. Delete one to add another.")
    data = await file.read()
    try:
        text = parse_file(file.filename, data)
    except ParseError as e:
        raise HTTPException(422, str(e))
    if len(text) < 50:
        raise HTTPException(422, "We couldn't extract enough text from this file. Please paste your resume text instead.")
    h, skills, cached = await cache_resume_text(text)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "label": (label or file.filename or "My resume").strip()[:80],
        "text": text[:MAX_TEXT_LEN],
        "hash": h,
        "skills": skills,
        "source": "upload",
        "filename": file.filename,
        "is_default": count == 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.resumes.insert_one(dict(doc))
    result = serialize_doc(doc)
    result["from_cache"] = cached
    return result


@api.patch("/resumes/{resume_id}")
async def update_resume(resume_id: str, body: ResumeUpdate, user=Depends(current_user)):
    resume = await db.resumes.find_one({"id": resume_id, "user_id": user["id"]})
    if not resume:
        raise HTTPException(404, "Resume not found.")
    updates = {"updated_at": now_iso()}
    if body.label is not None:
        updates["label"] = body.label.strip()
    if body.is_default is True:
        await db.resumes.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
        updates["is_default"] = True
    await db.resumes.update_one({"id": resume_id}, {"$set": updates})
    doc = await db.resumes.find_one({"id": resume_id}, {"_id": 0})
    return serialize_doc(doc)


@api.delete("/resumes/{resume_id}")
async def delete_resume(resume_id: str, user=Depends(current_user)):
    result = await db.resumes.delete_one({"id": resume_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Resume not found.")
    return {"deleted": True}


# ---------------- parse file (analyze page upload without saving) ----------------
@api.post("/parse-file")
async def parse_uploaded_file(file: UploadFile = File(...), user=Depends(current_user)):
    data = await file.read()
    try:
        text = parse_file(file.filename, data)
    except ParseError as e:
        raise HTTPException(422, str(e))
    h, skills, cached = await cache_resume_text(text)
    return {"text": text[:MAX_TEXT_LEN], "hash": h, "skills": skills, "from_cache": cached, "filename": file.filename}


# ---------------- analysis ----------------
@api.post("/analyze")
async def analyze(body: AnalyzeInput, user=Depends(current_user)):
    # resolve resume text
    resume_text = None
    resume_label = None
    if body.resume_id:
        resume = await db.resumes.find_one({"id": body.resume_id, "user_id": user["id"]}, {"_id": 0})
        if not resume:
            raise HTTPException(404, "Saved resume not found.")
        resume_text = resume["text"]
        resume_label = resume["label"]
    elif body.resume_text and len(body.resume_text.strip()) >= 50:
        resume_text = body.resume_text.strip()
    else:
        raise HTTPException(422, "Please provide a resume (at least 50 characters) or pick a saved one.")

    jd_text = body.jd_text.strip()
    h, cached_skills, from_cache = await cache_resume_text(resume_text)
    weights, synonyms = await get_kb()

    ai_insights = None
    engine_used = body.mode

    loop = asyncio.get_event_loop()
    if body.mode == "quick":
        result = await loop.run_in_executor(None, quick_analyze, resume_text, jd_text, weights, synonyms)
    elif body.mode == "deep":
        result = await loop.run_in_executor(None, deep_analyze, resume_text, jd_text, weights, synonyms)
        if not result.get("semantic_available", True):
            engine_used = "quick"
    else:  # ai mode
        provider = body.provider
        if not provider:
            raise HTTPException(422, "Pick an AI provider for AI-powered analysis.")
        key_doc = await db.api_keys.find_one({"user_id": user["id"], "provider": provider}, {"_id": 0})
        if not key_doc:
            raise HTTPException(422, f"No {provider} key saved. Add it in Settings first.")
        credential = decrypt_secret(key_doc["encrypted_key"])
        # run local deep analysis alongside AI for a consistent result structure
        result = await loop.run_in_executor(None, deep_analyze, resume_text, jd_text, weights, synonyms)
        try:
            ai_insights = await ai_analyze(provider, credential, resume_text, jd_text, key_doc.get("model"))
            # blend scores: AI opinion 60%, local engine 40%
            blended = round(0.6 * ai_insights["score"] + 0.4 * result["score"], 1)
            result["score"] = blended
            result["label"] = "Strong match" if blended >= 75 else ("Decent match" if blended >= 50 else "Needs work")
        except AIProviderError as e:
            raise HTTPException(502, str(e))

    analysis = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "resume_id": body.resume_id,
        "resume_label": resume_label,
        "resume_hash": h,
        "resume_from_cache": from_cache,
        "resume_excerpt": resume_text[:300],
        "jd_excerpt": jd_text[:300],
        "jd_text": jd_text,
        "mode": body.mode,
        "engine_used": engine_used,
        "provider": body.provider if body.mode == "ai" else None,
        "result": result,
        "ai_insights": ai_insights,
        "feedback_given": False,
        "created_at": now_iso(),
    }
    await db.analyses.insert_one(dict(analysis))
    return serialize_doc(analysis)


@api.get("/analyses")
async def list_analyses(limit: int = 50, user=Depends(current_user)):
    docs = await db.analyses.find(
        {"user_id": user["id"]},
        {"_id": 0, "jd_text": 0, "result.alignments": 0, "result.top_jd_terms": 0},
    ).sort("created_at", -1).to_list(min(limit, 100))
    return serialize_doc(docs)


@api.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str, user=Depends(current_user)):
    doc = await db.analyses.find_one({"id": analysis_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Analysis not found.")
    return serialize_doc(doc)


@api.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str, user=Depends(current_user)):
    result = await db.analyses.delete_one({"id": analysis_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Analysis not found.")
    return {"deleted": True}


# ---------------- feedback (trains the in-house model) ----------------
@api.post("/analyses/{analysis_id}/feedback")
async def submit_feedback(analysis_id: str, body: FeedbackInput, user=Depends(current_user)):
    analysis = await db.analyses.find_one({"id": analysis_id, "user_id": user["id"]}, {"_id": 0})
    if not analysis:
        raise HTTPException(404, "Analysis not found.")

    changes = []
    # skill weight adjustments (global knowledge base learning)
    for skill, verdict in body.skill_corrections.items():
        s = skill.lower().strip()
        if not s or verdict not in ("correct", "incorrect", "important"):
            continue
        existing = await db.skills_kb.find_one({"skill": s})
        if not existing:
            await db.skills_kb.insert_one({"skill": s, "category": "user_added", "weight": 1.0, "source": "feedback"})
            existing = {"weight": 1.0}
            changes.append(f"Learned new skill: {s}")
        w = existing.get("weight", 1.0)
        if verdict == "important":
            new_w = min(w + 0.25, 3.0)
        elif verdict == "incorrect":
            new_w = max(w - 0.25, 0.1)
        else:  # correct - small reinforcement
            new_w = min(w + 0.05, 3.0)
        await db.skills_kb.update_one({"skill": s}, {"$set": {"weight": round(new_w, 3)}})
        if abs(new_w - w) > 0.01:
            changes.append(f"Adjusted '{s}' weight: {round(w,2)} -> {round(new_w,2)}")

    # user says these skills were missing from our detection - learn them
    for skill in body.missing_skills_to_add:
        s = skill.lower().strip()[:60]
        if not s:
            continue
        existing = await db.skills_kb.find_one({"skill": s})
        if not existing:
            await db.skills_kb.insert_one({"skill": s, "category": "user_added", "weight": 1.0, "source": "feedback"})
            changes.append(f"Learned new skill: {s}")

    feedback_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "analysis_id": analysis_id,
        "overall_accurate": body.overall_accurate,
        "skill_corrections": body.skill_corrections,
        "missing_skills_added": body.missing_skills_to_add,
        "comment": body.comment,
        "changes_applied": changes,
        "created_at": now_iso(),
    }
    await db.feedback.insert_one(dict(feedback_doc))
    await db.analyses.update_one({"id": analysis_id}, {"$set": {"feedback_given": True}})
    invalidate_kb_cache()
    return {"saved": True, "changes_applied": changes,
            "message": "Thanks! Your feedback just made the matching engine smarter." if changes else "Thanks! Feedback recorded."}


# ---------------- settings: AI provider keys ----------------
@api.get("/settings/keys")
async def list_keys(user=Depends(current_user)):
    docs = await db.api_keys.find({"user_id": user["id"]}, {"_id": 0, "encrypted_key": 0}).to_list(10)
    return serialize_doc(docs)


@api.post("/settings/keys")
async def save_key(body: ApiKeyInput, user=Depends(current_user)):
    doc = {
        "user_id": user["id"],
        "provider": body.provider,
        "encrypted_key": encrypt_secret(body.api_key.strip()),
        "masked_key": mask_key(body.api_key.strip()),
        "model": (body.model or DEFAULT_MODELS.get(body.provider, "")).strip() or None,
        "verified": False,
        "updated_at": now_iso(),
    }
    await db.api_keys.update_one(
        {"user_id": user["id"], "provider": body.provider},
        {"$set": doc}, upsert=True,
    )
    return {"saved": True, "provider": body.provider, "masked_key": doc["masked_key"], "model": doc["model"]}


@api.post("/settings/keys/test")
async def test_key(body: TestKeyInput, user=Depends(current_user)):
    key_doc = await db.api_keys.find_one({"user_id": user["id"], "provider": body.provider}, {"_id": 0})
    if not key_doc:
        raise HTTPException(404, f"No {body.provider} key saved yet.")
    credential = decrypt_secret(key_doc["encrypted_key"])
    try:
        ok = await test_connection(body.provider, credential, key_doc.get("model"))
    except AIProviderError as e:
        await db.api_keys.update_one({"user_id": user["id"], "provider": body.provider}, {"$set": {"verified": False}})
        raise HTTPException(502, str(e))
    await db.api_keys.update_one({"user_id": user["id"], "provider": body.provider}, {"$set": {"verified": ok}})
    return {"ok": ok, "message": "Connection works!" if ok else "Connection failed."}


@api.delete("/settings/keys/{provider}")
async def delete_key(provider: str, user=Depends(current_user)):
    result = await db.api_keys.delete_one({"user_id": user["id"], "provider": provider})
    if result.deleted_count == 0:
        raise HTTPException(404, "Key not found.")
    return {"deleted": True}


# ---------------- stats ----------------
@api.get("/stats")
async def user_stats(user=Depends(current_user)):
    analyses = await db.analyses.find({"user_id": user["id"]}, {"_id": 0, "result.score": 1, "created_at": 1, "mode": 1}).sort("created_at", -1).to_list(200)
    scores = [a["result"]["score"] for a in analyses if a.get("result", {}).get("score") is not None]
    resume_count = await db.resumes.count_documents({"user_id": user["id"]})
    trend = [{"date": a["created_at"][:10], "score": a["result"]["score"]} for a in reversed(analyses[:20]) if a.get("result")]
    return {
        "total_analyses": len(analyses),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        "best_score": max(scores) if scores else None,
        "resume_count": resume_count,
        "resume_limit": MAX_RESUMES,
        "trend": trend,
    }


@api.get("/kb/stats")
async def kb_stats():
    return {
        "skills_known": await db.skills_kb.count_documents({}),
        "skills_learned_from_feedback": await db.skills_kb.count_documents({"source": "feedback"}),
        "cached_resumes": await db.resume_cache.count_documents({}),
        "cache_hits": (await db.resume_cache.aggregate([{"$group": {"_id": None, "total": {"$sum": "$hits"}}}]).to_list(1) or [{"total": 0}])[0].get("total", 0),
        "feedback_events": await db.feedback.count_documents({}),
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
