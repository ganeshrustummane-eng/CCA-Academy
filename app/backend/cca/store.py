"""SQLite progress store, XP ledger, levels, badges, readiness."""
from __future__ import annotations

import json
import random
import sqlite3
import threading
import time
import uuid
from collections import Counter
from typing import Any

from . import content

LEVELS = [(0, "Apprentice"), (300, "Builder"), (700, "Orchestrator"), (1200, "Architect")]
XP_FIRST_CORRECT = 10
XP_REPEAT_CORRECT = 2
PASS_SCORE = 70

# Role track -> which question levels that learner sees. 1 foundational, 2 applied,
# 3 architectural. Resolved here from the stored track, never taken from the client.
TRACK_LEVELS = {
    "builder": (1, 2),
    "senior": (1, 2, 3),
    "architect": (2, 3),
    "director": (2, 3),
}
DEFAULT_TRACK = "senior"

# Mock exam. The blueprint mirrors the domain weights in curriculum.yaml, so an exam
# score and a readiness score are computed the same way and are directly comparable.
EXAM_BLUEPRINT = {"D1": 16, "D2": 11, "D3": 12, "D4": 12, "D5": 9}
EXAM_QUESTIONS = sum(EXAM_BLUEPRINT.values())
EXAM_SECONDS = 90 * 60
EXAM_PASS = 700          # out of 1000
EXAM_MAX_XP = 200

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY, squad TEXT DEFAULT '', created REAL,
  track TEXT DEFAULT 'senior');
CREATE TABLE IF NOT EXISTS answers(id INTEGER PRIMARY KEY, user TEXT, qid TEXT, task TEXT,
  chosen TEXT, correct INTEGER, ts REAL, mode TEXT DEFAULT 'practice');
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, user TEXT, milestone TEXT, score REAL,
  passed INTEGER, detail TEXT, ts REAL);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, user TEXT, kind TEXT, xp INTEGER,
  ref TEXT, ts REAL);
CREATE TABLE IF NOT EXISTS gen_questions(id TEXT PRIMARY KEY, user TEXT, task TEXT, body TEXT, ts REAL);
CREATE TABLE IF NOT EXISTS exams(id TEXT PRIMARY KEY, user TEXT, started REAL, finished REAL,
  score REAL, detail TEXT);
CREATE INDEX IF NOT EXISTS ix_answers_user ON answers(user);
CREATE INDEX IF NOT EXISTS ix_events_user ON events(user);
CREATE INDEX IF NOT EXISTS ix_exams_user ON exams(user);
"""

# SCHEMA is CREATE TABLE IF NOT EXISTS only, so a database created before these columns
# existed never gains them and every mode/track read would silently see nothing.
MIGRATIONS = [
    ("answers", "mode", "TEXT DEFAULT 'practice'"),
    ("users", "track", f"TEXT DEFAULT '{DEFAULT_TRACK}'"),
]


def level_for(xp: int) -> dict:
    name, floor, nxt = LEVELS[0][1], 0, None
    for i, (t, n) in enumerate(LEVELS):
        if xp >= t:
            name, floor = n, t
            nxt = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
    return {"name": name, "floor": floor,
            "next_name": nxt[1] if nxt else None, "next_at": nxt[0] if nxt else None}


class Store:
    def __init__(self, path: str = ":memory:"):
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._db.executescript(SCHEMA)
            for table, col, decl in MIGRATIONS:
                if col not in {r["name"] for r in self._db.execute(f"PRAGMA table_info({table})")}:
                    self._db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
            self._db.commit()

    # ------------------------------------------------------------ helpers
    def _q(self, sql: str, args: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self._db.execute(sql, args).fetchall()

    def _x(self, sql: str, args: tuple = ()) -> None:
        with self._lock:
            self._db.execute(sql, args)
            self._db.commit()

    def close(self) -> None:
        with self._lock:
            self._db.close()

    def ensure_user(self, name: str, squad: str | None = None, track: str | None = None) -> None:
        name = name.strip()[:60]
        if not name:
            raise ValueError("User name required")
        self._x("INSERT OR IGNORE INTO users(name, created) VALUES(?,?)", (name, time.time()))
        if squad is not None:
            self._x("UPDATE users SET squad=? WHERE name=?", (squad.strip()[:40], name))
        if track is not None:
            if track not in TRACK_LEVELS:
                raise ValueError(f"Unknown track: {track}")
            self._x("UPDATE users SET track=? WHERE name=?", (track, name))

    def track(self, user: str) -> str:
        r = self._q("SELECT track FROM users WHERE name=?", (user,))
        return (r[0]["track"] if r and r[0]["track"] in TRACK_LEVELS else DEFAULT_TRACK)

    def levels_for(self, user: str) -> tuple[int, ...]:
        return TRACK_LEVELS[self.track(user)]

    def _add_xp(self, user: str, kind: str, xp: int, ref: str = "") -> None:
        if xp:
            self._x("INSERT INTO events(user,kind,xp,ref,ts) VALUES(?,?,?,?,?)",
                    (user, kind, int(xp), ref, time.time()))

    def xp(self, user: str) -> int:
        r = self._q("SELECT COALESCE(SUM(xp),0) s FROM events WHERE user=?", (user,))
        return int(r[0]["s"])

    # ------------------------------------------------------------ quiz
    def _pool(self, user: str, task: str | None = None, domain: str | None = None,
              levels: tuple[int, ...] | None = None, generated: bool = True) -> list[dict]:
        pool = list(content.questions()) + (self._generated(user) if generated else [])
        if task:
            pool = [q for q in pool if q["task"] == task]
        if domain:
            pool = [q for q in pool if "D" + q["task"].split(".")[0] == domain]
        if levels:
            pool = [q for q in pool if q.get("level", 2) in levels]
        return pool

    def _last_answers(self, user: str, practice_only: bool = False) -> dict[str, int]:
        """qid -> 1/0 for the learner's most recent answer to each question."""
        sql = "SELECT qid, correct FROM answers WHERE user=?" + (" AND mode='practice'" if practice_only else "")
        return {r["qid"]: r["correct"] for r in self._q(sql + " ORDER BY id", (user,))}

    def mistakes(self, user: str, levels: tuple[int, ...] | None = None) -> list[dict]:
        """Questions whose latest answer (practice or exam) was wrong."""
        last = self._last_answers(user)
        return [q for q in self._pool(user, levels=levels) if last.get(q["id"]) == 0]

    def next_questions(self, user: str, n: int = 5, task: str | None = None,
                       domain: str | None = None, rng: random.Random | None = None,
                       levels: tuple[int, ...] | None = None, mistakes: bool = False) -> list[dict]:
        rng = rng or random.Random()
        last = self._last_answers(user)
        pool = self.mistakes(user, levels) if mistakes else self._pool(user, task, domain, levels)

        def weight(q):
            if q["id"] not in last:
                return 1.0
            return 2.0 if last[q["id"]] == 0 else 0.2

        picked: list[dict] = []
        pool = list(pool)
        while pool and len(picked) < n:
            q = rng.choices(pool, weights=[weight(x) for x in pool])[0]
            picked.append(q)
            pool.remove(q)
        return picked

    def _generated(self, user: str) -> list[dict]:
        return [json.loads(r["body"]) for r in
                self._q("SELECT body FROM gen_questions WHERE user=?", (user,))]

    def save_generated(self, user: str, q: dict) -> None:
        self._x("INSERT OR REPLACE INTO gen_questions(id,user,task,body,ts) VALUES(?,?,?,?,?)",
                (q["id"], user, q["task"], json.dumps(q), time.time()))

    def find_question(self, user: str, qid: str) -> dict | None:
        return content.question(qid) or next((q for q in self._generated(user) if q["id"] == qid), None)

    def grade(self, user: str, qid: str, chosen: str, mode: str = "practice") -> dict:
        """Records the answer and, for practice only, awards per-question XP.

        The exam passes mode='exam': its answers are evidence (they still steer
        weak-first selection and still consume the first-correct XP bonus) but the
        exam pays out once on submit instead of 10 XP x 60 questions. Making that
        structural rather than an `award=` flag means no caller can forget it.
        """
        q = self.find_question(user, qid)
        if not q:
            raise KeyError(qid)
        chosen = chosen.strip().upper()[:1]
        if chosen not in q["options"]:
            raise ValueError("Unknown option")
        correct = chosen == q["answer"]
        prior_correct = self._q("SELECT 1 FROM answers WHERE user=? AND qid=? AND correct=1", (user, qid))
        self._x("INSERT INTO answers(user,qid,task,chosen,correct,ts,mode) VALUES(?,?,?,?,?,?,?)",
                (user, qid, q["task"], chosen, int(correct), time.time(), mode))
        gained = 0
        if correct and mode == "practice":
            gained = XP_REPEAT_CORRECT if prior_correct else XP_FIRST_CORRECT
            self._add_xp(user, "answer", gained, qid)
        return {"correct": correct, "answer": q["answer"], "why": q["why"],
                "xp_gained": gained, "task": q["task"]}

    # ------------------------------------------------------------ mock exam
    def start_exam(self, user: str, rng: random.Random | None = None) -> dict:
        """Samples a 60-question exam stratified by the domain weights.

        Sampling is uniform within each domain on purpose: the weak-first weighting
        used for practice would over-represent what the learner keeps missing and
        make the score a measure of their worst material rather than of readiness.
        """
        rng = rng or random.Random()
        levels = self.levels_for(user)
        qids: list[str] = []
        for dom, k in EXAM_BLUEPRINT.items():
            pool = self._pool(user, domain=dom, levels=levels, generated=False)
            if len(pool) < k:
                raise ValueError(
                    f"Question bank too small for an exam: {dom} needs {k} questions at "
                    f"levels {list(levels)} but has {len(pool)}.")
            qids += [q["id"] for q in rng.sample(pool, k)]
        rng.shuffle(qids)
        exam_id = uuid.uuid4().hex
        self._x("INSERT INTO exams(id,user,started,detail) VALUES(?,?,?,?)",
                (exam_id, user, time.time(), json.dumps({"qids": qids, "track": self.track(user)})))
        return {"exam_id": exam_id, "seconds": EXAM_SECONDS,
                "questions": [content.public_question(content.question(i)) for i in qids]}

    def submit_exam(self, user: str, exam_id: str, answers: dict[str, str]) -> dict:
        rows = self._q("SELECT * FROM exams WHERE id=? AND user=?", (exam_id, user))
        if not rows:
            raise KeyError(exam_id)
        row = rows[0]
        detail = json.loads(row["detail"])
        if row["finished"]:
            return detail["result"]          # idempotent: a double submit returns the same result

        review, per_domain = [], {d: [0, 0] for d in EXAM_BLUEPRINT}
        for qid in detail["qids"]:
            q = content.question(qid)
            dom = "D" + q["task"].split(".")[0]
            chosen = (answers.get(qid) or "").strip().upper()[:1]
            if chosen in q["options"]:
                r = self.grade(user, qid, chosen, mode="exam")
                correct = r["correct"]
            else:
                correct = False              # unanswered counts against the score but is not recorded
            per_domain[dom][0] += int(correct)
            per_domain[dom][1] += 1
            review.append({"qid": qid, "task": q["task"], "domain": dom, "chosen": chosen or None,
                           "answer": q["answer"], "correct": correct,
                           "stem": q["stem"], "options": q["options"], "why": q["why"]})

        # Same weighted formula as readiness(), so the two numbers are comparable.
        pct = sum(d["weight"] * per_domain[d["id"]][0] / per_domain[d["id"]][1]
                  for d in content.curriculum()["domains"])
        score = round(pct * 10)
        best_before = self._best_exam_pct(user)
        gained = self._award_best(user, "exam", exam_id, pct, EXAM_MAX_XP, best_before)
        finished = time.time()
        result = {"exam_id": exam_id, "score": score, "passed": score >= EXAM_PASS,
                  "pass_mark": EXAM_PASS, "xp_gained": gained,
                  "seconds_taken": round(finished - row["started"]),
                  "late": finished - row["started"] > EXAM_SECONDS + 60,
                  "per_domain": {k: round(100 * v[0] / v[1]) for k, v in per_domain.items()},
                  "correct": sum(v[0] for v in per_domain.values()), "total": len(detail["qids"]),
                  "review": review}
        self._x("UPDATE exams SET finished=?, score=?, detail=? WHERE id=?",
                (finished, score, json.dumps({**detail, "result": result}), exam_id))
        return result

    def _best_exam_pct(self, user: str) -> float:
        r = self._q("SELECT COALESCE(MAX(score),0) s FROM exams WHERE user=? AND finished IS NOT NULL",
                    (user,))
        return float(r[0]["s"]) / 10

    def exam_history(self, user: str, limit: int = 10) -> list[dict]:
        return [{"exam_id": r["id"], "score": r["score"], "finished": r["finished"],
                 "passed": r["score"] >= EXAM_PASS}
                for r in self._q("""SELECT id, score, finished FROM exams
                                    WHERE user=? AND finished IS NOT NULL
                                    ORDER BY finished DESC LIMIT ?""", (user, limit))]

    # ------------------------------------------------------------ milestones
    def record_review(self, user: str, milestone_id: str, score: float, detail: dict) -> dict:
        m = content.milestone(milestone_id)
        if not m:
            raise KeyError(milestone_id)
        score = max(0.0, min(100.0, float(score)))
        passed = score >= PASS_SCORE
        best_before = self._best_score(user, milestone_id)
        self._x("INSERT INTO reviews(user,milestone,score,passed,detail,ts) VALUES(?,?,?,?,?,?)",
                (user, milestone_id, score, int(passed), json.dumps(detail), time.time()))
        # Studying the reference solution is allowed, but then submitting it is not worth XP.
        seen = self.solution_seen(user, milestone_id)
        gained = 0 if seen else self._award_best(user, "milestone", milestone_id, score, m["xp"], best_before)
        return {"score": score, "passed": passed, "xp_gained": gained, "solution_seen": seen}

    def mark_solution_seen(self, user: str, milestone_id: str) -> None:
        if not self.solution_seen(user, milestone_id):
            self._x("INSERT INTO events(user,kind,xp,ref,ts) VALUES(?,?,?,?,?)",
                    (user, "solution", 0, milestone_id, time.time()))

    def solution_seen(self, user: str, milestone_id: str) -> bool:
        return bool(self._q("SELECT 1 FROM events WHERE user=? AND kind='solution' AND ref=?",
                            (user, milestone_id)))

    def _award_best(self, user: str, kind: str, ref: str, pct: float, max_xp: int,
                    best_before: float) -> int:
        """Improvement-only XP: pay for the gain over the best attempt so far, never the
        whole score again. Shared by milestone reviews and the mock exam so a retake
        cannot farm the same points twice."""
        if pct < PASS_SCORE or pct <= best_before:
            return 0
        earned_before = round(max_xp * best_before / 100) if best_before >= PASS_SCORE else 0
        gained = round(max_xp * pct / 100) - earned_before
        self._add_xp(user, kind, gained, ref)
        return gained

    def _best_score(self, user: str, mid: str) -> float:
        r = self._q("SELECT COALESCE(MAX(score),0) s FROM reviews WHERE user=? AND milestone=?", (user, mid))
        return float(r[0]["s"])

    def milestone_status(self, user: str) -> list[dict]:
        out = []
        for m in content.milestones():
            best = self._best_score(user, m["id"])
            tries = self._q("SELECT COUNT(*) c FROM reviews WHERE user=? AND milestone=?", (user, m["id"]))[0]["c"]
            out.append({"id": m["id"], "title": m["title"], "week": m["week"], "xp": m["xp"],
                        "best": best, "attempts": tries, "solution_seen": self.solution_seen(user, m["id"]),
                        "status": "passed" if best >= PASS_SCORE else ("in_progress" if tries else "todo")})
        return out

    # ------------------------------------------------------------ prompt/tool lab
    # Shares the reviews table with milestones (id namespaces L1../M1.. never collide),
    # so no schema change is needed to reuse _award_best/_best_score as-is.
    def record_lab(self, user: str, lab_id: str, score: float, detail: dict) -> dict:
        lab = content.lab(lab_id)
        if not lab:
            raise KeyError(lab_id)
        score = max(0.0, min(100.0, float(score)))
        passed = score >= PASS_SCORE
        best_before = self._best_score(user, lab_id)
        self._x("INSERT INTO reviews(user,milestone,score,passed,detail,ts) VALUES(?,?,?,?,?,?)",
                (user, lab_id, score, int(passed), json.dumps(detail), time.time()))
        gained = self._award_best(user, "lab", lab_id, score, lab["xp"], best_before)
        return {"score": score, "passed": passed, "xp_gained": gained}

    def lab_status(self, user: str) -> list[dict]:
        out = []
        for lab in content.labs():
            best = self._best_score(user, lab["id"])
            tries = self._q("SELECT COUNT(*) c FROM reviews WHERE user=? AND milestone=?", (user, lab["id"]))[0]["c"]
            out.append({"id": lab["id"], "title": lab["title"], "xp": lab["xp"],
                        "best": best, "attempts": tries, "solution_seen": self.solution_seen(user, m["id"]),
                        "status": "passed" if best >= PASS_SCORE else ("in_progress" if tries else "todo")})
        return out

    # ------------------------------------------------------------ architecture scenarios
    # Shares the reviews table too (id prefix SC.. never collides with M../L..).
    def record_scenario(self, user: str, scenario_id: str, score: float, detail: dict) -> dict:
        sc = content.scenario(scenario_id)
        if not sc:
            raise KeyError(scenario_id)
        score = max(0.0, min(100.0, float(score)))
        passed = score >= PASS_SCORE
        best_before = self._best_score(user, scenario_id)
        self._x("INSERT INTO reviews(user,milestone,score,passed,detail,ts) VALUES(?,?,?,?,?,?)",
                (user, scenario_id, score, int(passed), json.dumps(detail), time.time()))
        gained = self._award_best(user, "scenario", scenario_id, score, sc["xp"], best_before)
        return {"score": score, "passed": passed, "xp_gained": gained}

    def scenario_status(self, user: str) -> list[dict]:
        out = []
        for sc in content.scenarios():
            best = self._best_score(user, sc["id"])
            tries = self._q("SELECT COUNT(*) c FROM reviews WHERE user=? AND milestone=?", (user, sc["id"]))[0]["c"]
            out.append({"id": sc["id"], "title": sc["title"], "xp": sc["xp"],
                        "best": best, "attempts": tries, "solution_seen": self.solution_seen(user, m["id"]),
                        "status": "passed" if best >= PASS_SCORE else ("in_progress" if tries else "todo")})
        return out

    # ------------------------------------------------------------ progress
    def task_stats(self, user: str) -> dict[str, dict]:
        stats = {t["id"]: {"attempts": 0, "correct": 0, "mastered": False, "total_q": 0}
                 for t in content.all_tasks()}
        # Only the questions this learner's track actually shows count toward mastery.
        # Otherwise a Builder, who never sees level 3, could never master a task and
        # their readiness would be permanently capped at half.
        levels = self.levels_for(user)
        visible = [q for q in content.questions() if q.get("level", 2) in levels]
        for q in visible:
            stats[q["task"]]["total_q"] += 1
        # Practice answers only. readiness() is built on these and is meant to *predict*
        # exam performance, so letting exam answers feed it would make it circular. The
        # exam score already uses the same domain-weight formula and stands on its own.
        for r in self._q("SELECT task, correct FROM answers WHERE user=? AND mode='practice'",
                         (user,)):
            s = stats.get(r["task"])
            if s is None:
                continue
            s["attempts"] += 1
            s["correct"] += r["correct"]
        # Mastered = the *latest* answer to every visible question is correct, so one lucky
        # guess doesn't count forever and a later miss un-masters the task (ADR-019).
        last = self._last_answers(user, practice_only=True)
        right = Counter(q["task"] for q in visible if last.get(q["id"]) == 1)
        for t, s in stats.items():
            s["mastered"] = s["total_q"] > 0 and right[t] >= s["total_q"]
        return stats

    def readiness(self, user: str) -> dict:
        """Weighted readiness: domain weight x average of task scores (quiz accuracy blended with mastery)."""
        stats = self.task_stats(user)
        per_domain = {}
        total = 0.0
        for d in content.curriculum()["domains"]:
            vals = []
            for t in d["tasks"]:
                s = stats[t["id"]]
                acc = s["correct"] / s["attempts"] if s["attempts"] else 0.0
                vals.append(0.5 * acc + 0.5 * (1.0 if s["mastered"] else 0.0))
            pct = sum(vals) / len(vals)
            per_domain[d["id"]] = round(pct * 100)
            total += pct * d["weight"]
        return {"overall": round(total), "domains": per_domain}

    def badges(self, user: str) -> list[dict]:
        out = []
        stats = self.task_stats(user)
        if any(s["attempts"] for s in stats.values()):
            out.append({"id": "first-step", "name": "First Step", "desc": "Answered your first question."})
        for d in content.curriculum()["domains"]:
            if all(stats[t["id"]]["mastered"] for t in d["tasks"]):
                out.append({"id": f"spec-{d['id']}", "name": f"{d['id']} Specialist",
                            "desc": f"Mastered every {d['title']} question."})
        passed = {m["id"] for m in self.milestone_status(user) if m["status"] == "passed"}
        for mid, name, desc in [("M1", "Loop Master", "Passed The Honest Loop."),
                                ("M2", "Gatekeeper", "Passed The Gatekeeper."),
                                ("M4", "Isolation Expert", "Passed The Coordinator."),
                                ("M8", "Batch Boss", "Passed The Extraction Pipeline.")]:
            if mid in passed:
                out.append({"id": f"ms-{mid}", "name": name, "desc": desc})
        if len(passed) == len(content.milestones()):
            out.append({"id": "all-milestones", "name": "Builder of All", "desc": "Passed every milestone."})
        return out

    def dashboard(self, user: str) -> dict:
        xp = self.xp(user)
        stats = self.task_stats(user)
        weakest = sorted((t for t in stats.items() if t[1]["attempts"]),
                         key=lambda kv: kv[1]["correct"] / kv[1]["attempts"])[:3]
        r = self.readiness(user)
        return {"user": user, "xp": xp, "level": level_for(xp), "readiness": r,
                "tasks": stats, "milestones": self.milestone_status(user),
                "badges": self.badges(user),
                "mistakes": len(self.mistakes(user, self.levels_for(user))),
                "weakest": [{"task": k, "accuracy": round(100 * v["correct"] / v["attempts"])} for k, v in weakest],
                "certified_ready": xp >= 1200 and r["overall"] >= 80}

    def leaderboard(self, limit: int = 20) -> dict:
        rows = self._q("""SELECT u.name, u.squad, COALESCE(SUM(e.xp),0) xp FROM users u
                          LEFT JOIN events e ON e.user=u.name GROUP BY u.name ORDER BY xp DESC LIMIT ?""", (limit,))
        people = [{"name": r["name"], "squad": r["squad"], "xp": int(r["xp"]),
                   "level": level_for(int(r["xp"]))["name"]} for r in rows]
        squads: dict[str, list[int]] = {}
        for p in people:
            if p["squad"]:
                squads.setdefault(p["squad"], []).append(p["xp"])
        team = sorted(({"squad": s, "avg_xp": round(sum(v) / len(v)), "members": len(v)}
                       for s, v in squads.items()), key=lambda x: -x["avg_xp"])
        return {"people": people, "squads": team}
