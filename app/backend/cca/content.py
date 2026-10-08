"""Loads curriculum, questions and milestones from YAML."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"


def _load(name: str) -> dict:
    with open(CONTENT_DIR / name, encoding="utf-8") as f:
        return yaml.safe_load(f)


@lru_cache(maxsize=1)
def curriculum() -> dict:
    return _load("curriculum.yaml")


@lru_cache(maxsize=1)
def questions() -> list[dict]:
    return _load("questions.yaml")["questions"]


@lru_cache(maxsize=1)
def milestones() -> list[dict]:
    return _load("milestones.yaml")["milestones"]


@lru_cache(maxsize=1)
def labs() -> list[dict]:
    return _load("lab.yaml")["labs"]


@lru_cache(maxsize=1)
def scenarios() -> list[dict]:
    return _load("scenarios.yaml")["scenarios"]


def all_tasks() -> list[dict]:
    out = []
    for d in curriculum()["domains"]:
        for t in d["tasks"]:
            out.append({**t, "domain": d["id"], "domain_title": d["title"]})
    return out


def task(task_id: str) -> dict | None:
    return next((t for t in all_tasks() if t["id"] == task_id), None)


def domain(domain_id: str) -> dict | None:
    return next((d for d in curriculum()["domains"] if d["id"] == domain_id), None)


def question(qid: str) -> dict | None:
    return next((q for q in questions() if q["id"] == qid), None)


def milestone(mid: str) -> dict | None:
    return next((m for m in milestones() if m["id"] == mid), None)


def lab(lab_id: str) -> dict | None:
    return next((l for l in labs() if l["id"] == lab_id), None)


def scenario(scenario_id: str) -> dict | None:
    return next((s for s in scenarios() if s["id"] == scenario_id), None)


def domain_of_task(task_id: str) -> str:
    return task_id.split(".")[0] and "D" + task_id.split(".")[0]


def public_question(q: dict) -> dict:
    """Question without answer or rationales (sent to the learner before answering)."""
    return {k: q[k] for k in ("id", "task", "scenario", "stem", "options")}
