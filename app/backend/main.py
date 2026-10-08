"""CCA Academy API (FastAPI). Run: uvicorn main:app --reload"""
from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from cca import ai_features, content, playground
from cca.llm import DIAL_API_VERSION, DIAL_ENDPOINT, LLMClient, LLMError, make_client
from cca.store import EXAM_PASS, EXAM_QUESTIONS, EXAM_SECONDS, TRACK_LEVELS, Store

DEFAULT_PROVIDER = os.getenv("LLM_PROVIDER", "dial")
DEFAULT_MODEL = os.getenv("LLM_MODEL", "gpt-5.6-terra-2026-07-09")
SERVER_KEY = os.getenv("LLM_API_KEY", "")
ENDPOINT = os.getenv("DIAL_ENDPOINT", DIAL_ENDPOINT)
API_VERSION = os.getenv("DIAL_API_VERSION", DIAL_API_VERSION)
# A single Lab run is 2-10 provider calls, so 60/hour puts an iterating learner into a
# 429 within ten minutes. Raise the ceiling rather than build a quota subsystem.
LLM_CALLS_PER_HOUR = int(os.getenv("LLM_CALLS_PER_HOUR", "200"))
ORIGINS = [o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o]

store = Store(os.getenv("CCA_DB", "cca.db"))
app = FastAPI(title="CCA Academy", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])

_calls: dict[str, deque] = defaultdict(deque)


def current_user(x_user: str = Header(default="")) -> str:
    name = x_user.strip()
    if not name:
        raise HTTPException(401, "Missing X-User header. Set your name first.")
    store.ensure_user(name)
    return name


def llm_for(user: str, x_llm_key: str = Header(default=""), x_llm_provider: str = Header(default=""),
            x_llm_model: str = Header(default=""), x_llm_endpoint: str = Header(default="")) -> LLMClient:
    """BYO key per request (never stored or logged); falls back to the server key."""
    now = time.time()
    q = _calls[user]
    while q and now - q[0] > 3600:
        q.popleft()
    if len(q) >= LLM_CALLS_PER_HOUR:
        raise HTTPException(429, "Hourly AI request limit reached. Try again later.")
    key = x_llm_key.strip() or SERVER_KEY
    try:
        client = make_client(x_llm_provider or DEFAULT_PROVIDER, key, x_llm_model or DEFAULT_MODEL,
                             x_llm_endpoint or (ENDPOINT if (x_llm_provider or DEFAULT_PROVIDER) == "dial" else None),
                             API_VERSION)
    except LLMError as e:
        raise HTTPException(400, str(e))
    q.append(now)
    return client


def ai(user: str = Depends(current_user), x_llm_key: str = Header(default=""),
       x_llm_provider: str = Header(default=""), x_llm_model: str = Header(default=""),
       x_llm_endpoint: str = Header(default="")) -> LLMClient:
    return llm_for(user, x_llm_key, x_llm_provider, x_llm_model, x_llm_endpoint)


def _llm_call(fn):
    try:
        return fn()
    except LLMError as e:
        raise HTTPException(502, f"AI provider error: {e}")
    except KeyError as e:
        raise HTTPException(404, f"Not found: {e}")
    except ValueError as e:
        raise HTTPException(422, str(e))


# ------------------------------------------------------------------ models
class UserIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    squad: str = Field(default="", max_length=40)
    track: str | None = None


class ExamSubmitIn(BaseModel):
    exam_id: str
    answers: dict[str, str] = {}


class AnswerIn(BaseModel):
    qid: str
    chosen: str = Field(min_length=1, max_length=1)


class GenerateIn(BaseModel):
    task: str


class TutorIn(BaseModel):
    domain: str
    message: str = Field(min_length=1, max_length=4000)
    history: list[dict] = []


class AskIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    ref: str = Field(default="", max_length=40)
    page: str = Field(default="", max_length=40)
    history: list[dict] = []


class ReviewIn(BaseModel):
    files: dict[str, str]


class LabReviewIn(BaseModel):
    system_prompt: str = Field(default="", max_length=12_000)
    tools: list[dict] = []


class ScenarioReviewIn(BaseModel):
    choices: dict[str, str] = {}
    rationale: str = Field(default="", max_length=12_000)


class PlaygroundIn(BaseModel):
    message: str = Field(default="I'd like a refund of $750 for order O2. My customer id is C100, email jane@example.com.",
                         max_length=2000)
    loop_mode: str = "correct"
    gate: bool = True
    hook: bool = True
    normalise: bool = True
    demo: bool = False


# ------------------------------------------------------------------ routes
@app.get("/api/health")
def health():
    return {"ok": True, "provider": DEFAULT_PROVIDER, "model": DEFAULT_MODEL,
            "server_key": bool(SERVER_KEY), "tracks": sorted(TRACK_LEVELS)}


@app.get("/api/curriculum")
def get_curriculum():
    return content.curriculum()


@app.get("/api/milestones")
def get_milestones():
    return {"milestones": content.milestones()}


@app.post("/api/users")
def upsert_user(body: UserIn):
    try:
        store.ensure_user(body.name, body.squad, body.track)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"ok": True, "track": store.track(body.name.strip()[:60])}


@app.get("/api/dashboard")
def dashboard(user: str = Depends(current_user)):
    return store.dashboard(user)


@app.get("/api/leaderboard")
def leaderboard():
    return store.leaderboard()


@app.get("/api/quiz/next")
def quiz_next(n: int = Query(5, ge=1, le=20), task: str | None = None, domain: str | None = None,
              mistakes: bool = False, user: str = Depends(current_user)):
    # Levels come from the stored track, never from a query param, so a learner cannot
    # widen their own difficulty band by editing the URL.
    qs = store.next_questions(user, n, task, domain, levels=store.levels_for(user), mistakes=mistakes)
    return {"questions": [content.public_question(q) for q in qs], "track": store.track(user)}


@app.post("/api/exam/start")
def exam_start(user: str = Depends(current_user)):
    try:
        return store.start_exam(user)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/api/exam/submit")
def exam_submit(body: ExamSubmitIn, user: str = Depends(current_user)):
    try:
        return store.submit_exam(user, body.exam_id, body.answers)
    except KeyError:
        raise HTTPException(404, "Unknown exam")


@app.get("/api/exam/history")
def exam_history(user: str = Depends(current_user)):
    return {"exams": store.exam_history(user), "pass_mark": EXAM_PASS,
            "questions": EXAM_QUESTIONS, "seconds": EXAM_SECONDS}


@app.post("/api/quiz/answer")
def quiz_answer(body: AnswerIn, user: str = Depends(current_user)):
    try:
        return store.grade(user, body.qid, body.chosen)
    except KeyError:
        raise HTTPException(404, "Unknown question")
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/api/quiz/generate")
def quiz_generate(body: GenerateIn, user: str = Depends(current_user), client: LLMClient = Depends(ai)):
    q = _llm_call(lambda: ai_features.generate_question(client, body.task))
    store.save_generated(user, q)
    return content.public_question(q)


@app.post("/api/tutor")
def tutor(body: TutorIn, client: LLMClient = Depends(ai)):
    return {"reply": _llm_call(lambda: ai_features.tutor_reply(client, body.domain, body.history, body.message))}


@app.post("/api/ask")
def ask(body: AskIn, user: str = Depends(current_user),
        x_llm_key: str = Header(default=""), x_llm_provider: str = Header(default=""),
        x_llm_model: str = Header(default=""), x_llm_endpoint: str = Header(default="")):
    if body.page == "exam":   # checked before building a client so it costs no rate-limit slot
        raise HTTPException(403, "Ask AI is off during the mock exam.")
    client = llm_for(user, x_llm_key, x_llm_provider, x_llm_model, x_llm_endpoint)
    return {"reply": _llm_call(lambda: ai_features.ask_reply(client, body.ref, body.page, body.history, body.message))}


@app.post("/api/milestones/{mid}/solution")
def milestone_solution(mid: str, user: str = Depends(current_user), client: LLMClient = Depends(ai)):
    result = _llm_call(lambda: ai_features.milestone_solution(client, mid))
    store.mark_solution_seen(user, mid)   # only once a solution was actually delivered
    return result


@app.post("/api/milestones/{mid}/review")
def review(mid: str, body: ReviewIn, user: str = Depends(current_user), client: LLMClient = Depends(ai)):
    result = _llm_call(lambda: ai_features.review_milestone(client, mid, body.files))
    rec = store.record_review(user, mid, result["score"], result)
    return {**result, **rec}


@app.get("/api/labs")
def get_labs():
    return {"labs": content.labs()}


@app.post("/api/labs/{lid}/review")
def lab_review(lid: str, body: LabReviewIn, user: str = Depends(current_user), client: LLMClient = Depends(ai)):
    result = _llm_call(lambda: ai_features.review_lab(client, lid, body.system_prompt, body.tools))
    rec = store.record_lab(user, lid, result["score"], result)
    return {**result, **rec}


@app.get("/api/scenarios")
def get_scenarios():
    return {"scenarios": content.scenarios()}


@app.post("/api/scenarios/{sid}/review")
def scenario_review(sid: str, body: ScenarioReviewIn, user: str = Depends(current_user), client: LLMClient = Depends(ai)):
    result = _llm_call(lambda: ai_features.review_scenario(client, sid, body.choices, body.rationale))
    rec = store.record_scenario(user, sid, result["score"], result)
    return {**result, **rec}


@app.get("/api/playground/tools")
def playground_tools():
    return {"tools": playground.TOOLS, "system": playground.SYSTEM}


@app.post("/api/playground/run")
def playground_run(body: PlaygroundIn, user: str = Depends(current_user),
                   x_llm_key: str = Header(default=""), x_llm_provider: str = Header(default=""),
                   x_llm_model: str = Header(default=""), x_llm_endpoint: str = Header(default="")):
    opts = body.model_dump(exclude={"message", "demo"})
    if body.demo:
        return playground.run_agent(playground.demo_client(), body.message, opts)
    client = llm_for(user, x_llm_key, x_llm_provider, x_llm_model, x_llm_endpoint)
    return _llm_call(lambda: playground.run_agent(client, body.message, opts))


@app.post("/api/llm/test")
def llm_test(client: LLMClient = Depends(ai)):
    r = _llm_call(lambda: client.chat([{"role": "user", "content": "Reply with the single word: ready"}], max_tokens=20))
    return {"ok": True, "reply": r.text[:50]}


# Serve the built frontend if present (production). In development use `npm run dev`.
_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="web")
