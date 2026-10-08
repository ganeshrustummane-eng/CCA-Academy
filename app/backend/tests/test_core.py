"""Core tests. Run: python -m unittest discover -s tests   (no network, no API key needed)."""
import random
import sys
import unittest
from collections import Counter, defaultdict
from pathlib import Path
from unittest import mock

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cca import ai_features, content, playground  # noqa: E402
from cca.llm import AnthropicClient, LLMError, LLMResponse, MockClient, ToolCall  # noqa: E402
from cca.store import (  # noqa: E402
    DEFAULT_TRACK, EXAM_BLUEPRINT, EXAM_MAX_XP, EXAM_QUESTIONS, TRACK_LEVELS,
    XP_FIRST_CORRECT, XP_REPEAT_CORRECT, Store, level_for,
)


class ContentTests(unittest.TestCase):
    def test_thirty_tasks_five_domains(self):
        self.assertEqual(len(content.all_tasks()), 30)
        self.assertEqual(len(content.curriculum()["domains"]), 5)
        self.assertEqual(sum(d["weight"] for d in content.curriculum()["domains"]), 100)

    def test_every_task_has_a_worked_example(self):
        # Offline teaching content (ADR-019): learners without an API key still see an example.
        for t in content.all_tasks():
            ex = t.get("example") or {}
            self.assertGreaterEqual(len(ex.get("why", "")), 40, t["id"])
            self.assertIn("TRAP", ex.get("code", ""), t["id"])

    def test_glossary_terms_unique_and_defined(self):
        g = content.curriculum()["glossary"]
        self.assertGreaterEqual(len(g), 10)
        self.assertEqual(len({x["term"] for x in g}), len(g))
        self.assertTrue(all(len(x["means"]) >= 20 for x in g))

    def test_every_task_has_a_question(self):
        covered = {q["task"] for q in content.questions()}
        missing = {t["id"] for t in content.all_tasks()} - covered
        self.assertEqual(missing, set(), f"tasks without questions: {missing}")

    def test_questions_well_formed(self):
        ids = set()
        for q in content.questions():
            self.assertNotIn(q["id"], ids)
            ids.add(q["id"])
            self.assertEqual(set(q["options"]), set("ABCD"), q["id"])
            self.assertEqual(set(q["why"]), set("ABCD"), q["id"])
            self.assertIn(q["answer"], q["options"])
            self.assertIsNotNone(content.task(q["task"]), q["id"])

    def test_every_task_has_five_questions_across_all_three_levels(self):
        """Weak-first drilling needs something left to re-ask, and every role track
        filters by level, so a task short of a level is invisible to that track."""
        by_task = defaultdict(list)
        for q in content.questions():
            self.assertIn(q.get("level", 2), (1, 2, 3), q["id"])
            by_task[q["task"]].append(q)
        for t in content.all_tasks():
            qs = by_task[t["id"]]
            self.assertGreaterEqual(len(qs), 5, f"task {t['id']} has only {len(qs)} questions")
            levels = {q.get("level", 2) for q in qs}
            self.assertEqual(levels, {1, 2, 3}, f"task {t['id']} covers levels {sorted(levels)}")

    def test_no_duplicate_stems_or_option_sets_within_a_task(self):
        seen_stem, seen_opts = {}, {}
        for q in content.questions():
            stem = (q["task"], " ".join(q["stem"].split()).lower())
            opts = (q["task"], tuple(sorted(o.strip().lower() for o in q["options"].values())))
            self.assertNotIn(stem, seen_stem, f"{q['id']} repeats the stem of {seen_stem.get(stem)}")
            self.assertNotIn(opts, seen_opts, f"{q['id']} repeats the options of {seen_opts.get(opts)}")
            seen_stem[stem], seen_opts[opts] = q["id"], q["id"]

    def test_correct_answer_letter_is_not_a_shortcut(self):
        """Hand-authored banks drift toward one letter; if any letter carries over
        half the bank, guessing it beats knowing the material."""
        counts = Counter(q["answer"] for q in content.questions())
        total = sum(counts.values())
        self.assertEqual(set(counts), set("ABCD"), f"letters used: {sorted(counts)}")
        worst, n = counts.most_common(1)[0]
        self.assertLess(n, total * 0.4, f"answer {worst} is {n}/{total} of the bank")

    def test_public_question_hides_answer(self):
        p = content.public_question(content.questions()[0])
        self.assertNotIn("answer", p)
        self.assertNotIn("why", p)

    def test_milestone_rubrics_sum_to_100_and_tasks_exist(self):
        for m in content.milestones():
            self.assertEqual(sum(c["weight"] for c in m["rubric"]), 100, m["id"])
            for t in m["tasks"]:
                self.assertIsNotNone(content.task(t), f"{m['id']} -> {t}")

    def test_all_tasks_covered_by_some_milestone(self):
        covered = {t for m in content.milestones() for t in m["tasks"]}
        missing = {t["id"] for t in content.all_tasks()} - covered
        self.assertEqual(missing, set(), f"tasks not covered by any milestone: {missing}")

    def test_milestones_have_a_guide_distinct_from_the_brief(self):
        for m in content.milestones():
            self.assertIsInstance(m.get("guide"), str, m["id"])
            self.assertGreaterEqual(len(m["guide"]), 40, m["id"])
            self.assertNotEqual(m["guide"].strip(), m["brief"].strip(), m["id"])

    def test_milestones_have_step_by_step_plans(self):
        for m in content.milestones():
            steps = m.get("steps")
            self.assertIsInstance(steps, list, m["id"])
            self.assertGreaterEqual(len(steps), 4, m["id"])
            self.assertTrue(all(isinstance(s, str) and len(s) > 20 for s in steps), m["id"])

    def test_rubric_entries_have_exact_keys(self):
        """An unquoted YAML flow scalar ends at the first comma, so the rest of the sentence
        becomes a stray key with value None and the reviewer silently grades a fragment.
        Key-set equality is the guard; length and terminal full stop catch sloppier truncation."""
        for m in content.milestones():
            for c in m["rubric"]:
                self.assertEqual(set(c), {"id", "weight", "check"}, f"{m['id']}/{c.get('id')}")
                self.assertIsInstance(c["check"], str)
                self.assertGreaterEqual(len(c["check"]), 20, f"{m['id']}/{c['id']}")
                self.assertTrue(c["check"].rstrip().endswith("."), f"{m['id']}/{c['id']}")

    def test_lab_rubrics_sum_to_100_and_tasks_exist(self):
        for lab in content.labs():
            self.assertEqual(sum(c["weight"] for c in lab["rubric"]), 100, lab["id"])
            for t in lab["tasks"]:
                self.assertIsNotNone(content.task(t), f"{lab['id']} -> {t}")

    def test_lab_rubric_entries_have_exact_keys(self):
        for lab in content.labs():
            for c in lab["rubric"]:
                self.assertEqual(set(c), {"id", "weight", "check"}, f"{lab['id']}/{c.get('id')}")
                self.assertIsInstance(c["check"], str)
                self.assertGreaterEqual(len(c["check"]), 20, f"{lab['id']}/{c['id']}")
                self.assertTrue(c["check"].rstrip().endswith("."), f"{lab['id']}/{c['id']}")

    def test_scenario_rubrics_sum_to_100_and_tasks_exist(self):
        for sc in content.scenarios():
            self.assertEqual(sum(c["weight"] for c in sc["rubric"]), 100, sc["id"])
            for t in sc["tasks"]:
                self.assertIsNotNone(content.task(t), f"{sc['id']} -> {t}")

    def test_scenario_rubric_entries_have_exact_keys(self):
        for sc in content.scenarios():
            for c in sc["rubric"]:
                self.assertEqual(set(c), {"id", "weight", "check"}, f"{sc['id']}/{c.get('id')}")
                self.assertIsInstance(c["check"], str)
                self.assertGreaterEqual(len(c["check"]), 20, f"{sc['id']}/{c['id']}")
                self.assertTrue(c["check"].rstrip().endswith("."), f"{sc['id']}/{c['id']}")

    def test_scenario_decisions_have_correct_answer_and_full_cost_table(self):
        for sc in content.scenarios():
            for d in sc["decisions"]:
                self.assertIn(d["correct"], d["options"], f"{sc['id']}/{d['id']}")
                self.assertEqual(set(d["cost"]), set(d["options"]), f"{sc['id']}/{d['id']} cost table")
                self.assertEqual(set(d["why"]), set(d["options"]), f"{sc['id']}/{d['id']} why table")

    def test_no_none_values_anywhere_in_content(self):
        """Same bug class, every content file -- including ones added after this test was written."""
        def walk(node, where):
            if isinstance(node, dict):
                for k, v in node.items():
                    self.assertIsNotNone(v, f"{where}: key {k!r} has value None (unquoted comma?)")
                    walk(v, f"{where}.{k}")
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    walk(v, f"{where}[{i}]")

        files = sorted((Path(__file__).resolve().parent.parent / "content").glob("*.yaml"))
        self.assertTrue(files, "no content YAML found")
        for path in files:
            walk(yaml.safe_load(path.read_text(encoding="utf-8")), path.name)


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.s = Store(":memory:")
        self.s.ensure_user("ana", "red")

    def tearDown(self):
        self.s.close()

    def test_first_correct_gives_xp_repeat_gives_less(self):
        q = content.questions()[0]
        r1 = self.s.grade("ana", q["id"], q["answer"])
        r2 = self.s.grade("ana", q["id"], q["answer"])
        self.assertTrue(r1["correct"])
        self.assertEqual(r1["xp_gained"], 10)
        self.assertEqual(r2["xp_gained"], 2)
        self.assertEqual(self.s.xp("ana"), 12)

    def test_wrong_answer_no_xp_and_returns_rationale(self):
        q = content.questions()[0]
        wrong = next(k for k in q["options"] if k != q["answer"])
        r = self.s.grade("ana", q["id"], wrong)
        self.assertFalse(r["correct"])
        self.assertEqual(r["xp_gained"], 0)
        self.assertIn(wrong, r["why"])

    def test_invalid_option_and_unknown_question(self):
        with self.assertRaises(ValueError):
            self.s.grade("ana", content.questions()[0]["id"], "Z")
        with self.assertRaises(KeyError):
            self.s.grade("ana", "nope", "A")

    def test_next_questions_prefers_missed(self):
        qs = content.questions()
        wrong_q = qs[0]
        self.s.grade("ana", wrong_q["id"], next(k for k in wrong_q["options"] if k != wrong_q["answer"]))
        for q in qs[1:]:
            self.s.grade("ana", q["id"], q["answer"])
        draws = 200
        hits = sum(self.s.next_questions("ana", 1, rng=random.Random(i))[0]["id"] == wrong_q["id"]
                   for i in range(draws))
        # The missed question carries 10x the weight of a mastered one, so its share is
        # 10/(10+n-1) against a uniform 1/n. Compare against the uniform baseline rather
        # than a fixed count, so growing the bank does not break the test.
        uniform = draws / len(qs)
        self.assertGreater(hits, 4 * uniform, f"weak-first weighting too flat ({hits} of {draws})")

    def test_filter_by_task_and_domain(self):
        self.assertTrue(all(q["task"] == "1.4" for q in self.s.next_questions("ana", 10, task="1.4")))
        self.assertTrue(all(q["task"].startswith("5.") for q in self.s.next_questions("ana", 20, domain="D5")))

    def test_milestone_xp_only_for_improvement(self):
        m = content.milestone("M1")
        r1 = self.s.record_review("ana", "M1", 80, {})
        self.assertTrue(r1["passed"])
        self.assertEqual(r1["xp_gained"], round(m["xp"] * 0.8))
        r2 = self.s.record_review("ana", "M1", 70, {})
        self.assertEqual(r2["xp_gained"], 0)
        r3 = self.s.record_review("ana", "M1", 100, {})
        self.assertEqual(self.s.xp("ana"), m["xp"])
        self.assertEqual(r3["xp_gained"], m["xp"] - round(m["xp"] * 0.8))

    def test_viewing_solution_forfeits_milestone_xp(self):
        self.s.mark_solution_seen("ana", "M1")
        self.s.mark_solution_seen("ana", "M1")
        r = self.s.record_review("ana", "M1", 95, {})
        self.assertTrue(r["passed"])
        self.assertTrue(r["solution_seen"])
        self.assertEqual(r["xp_gained"], 0)
        self.assertEqual(self.s.xp("ana"), 0)
        self.assertTrue(next(m for m in self.s.milestone_status("ana") if m["id"] == "M1")["solution_seen"])
        self.assertGreater(self.s.record_review("ana", "M2", 95, {})["xp_gained"], 0)

    def test_failed_review_no_xp(self):
        r = self.s.record_review("ana", "M1", 40, {})
        self.assertFalse(r["passed"])
        self.assertEqual(self.s.xp("ana"), 0)
        self.assertEqual(self.s.milestone_status("ana")[0]["status"], "in_progress")

    def test_mastery_badges_readiness(self):
        for q in content.questions():
            self.s.grade("ana", q["id"], q["answer"])
        d = self.s.dashboard("ana")
        self.assertEqual(d["readiness"]["overall"], 100)
        self.assertTrue(any(b["id"] == "spec-D1" for b in d["badges"]))
        self.assertTrue(all(t["mastered"] for t in d["tasks"].values()))

    def test_later_miss_unmasters_task(self):
        qs = [q for q in content.questions() if q["task"] == "1.1" and q.get("level", 2) in self.s.levels_for("ana")]
        for q in qs:
            self.s.grade("ana", q["id"], q["answer"])
        self.assertTrue(self.s.task_stats("ana")["1.1"]["mastered"])
        wrong = next(k for k in "ABCD" if k != qs[0]["answer"])
        self.s.grade("ana", qs[0]["id"], wrong)
        self.assertFalse(self.s.task_stats("ana")["1.1"]["mastered"])
        self.s.grade("ana", qs[0]["id"], qs[0]["answer"])
        self.assertTrue(self.s.task_stats("ana")["1.1"]["mastered"])

    def test_mistakes_mode_serves_only_latest_wrong(self):
        a, b = content.questions()[:2]
        self.s.grade("ana", a["id"], next(k for k in "ABCD" if k != a["answer"]))
        self.s.grade("ana", b["id"], next(k for k in "ABCD" if k != b["answer"]))
        self.s.grade("ana", b["id"], b["answer"])          # fixed, so no longer a mistake
        self.assertEqual([q["id"] for q in self.s.next_questions("ana", 20, mistakes=True)], [a["id"]])
        self.assertEqual(self.s.dashboard("ana")["mistakes"], 1)

    def test_readiness_zero_for_new_user(self):
        self.assertEqual(self.s.readiness("ana")["overall"], 0)

    def test_leaderboard_and_squads(self):
        self.s.ensure_user("bo", "red")
        self.s.ensure_user("cy", "blue")
        q = content.questions()[0]
        self.s.grade("ana", q["id"], q["answer"])
        lb = self.s.leaderboard()
        self.assertEqual(lb["people"][0]["name"], "ana")
        self.assertEqual({t["squad"] for t in lb["squads"]}, {"red", "blue"})
        red = next(t for t in lb["squads"] if t["squad"] == "red")
        self.assertEqual(red["avg_xp"], 5)

    def test_levels(self):
        self.assertEqual(level_for(0)["name"], "Apprentice")
        self.assertEqual(level_for(300)["name"], "Builder")
        self.assertEqual(level_for(1200)["name"], "Architect")
        self.assertIsNone(level_for(5000)["next_at"])

    def test_generated_question_graded_server_side(self):
        gq = {"id": "gen-1.1-x", "task": "1.1", "scenario": "s", "stem": "x" * 50,
              "options": dict.fromkeys("ABCD", "o"), "answer": "C", "why": dict.fromkeys("ABCD", "w")}
        self.s.save_generated("ana", gq)
        self.assertTrue(self.s.grade("ana", "gen-1.1-x", "c")["correct"])


class TrackTests(unittest.TestCase):
    def setUp(self):
        self.s = Store(":memory:")

    def tearDown(self):
        self.s.close()

    def test_default_track_and_rejects_unknown(self):
        self.s.ensure_user("ana")
        self.assertEqual(self.s.track("ana"), DEFAULT_TRACK)
        with self.assertRaises(ValueError):
            self.s.ensure_user("ana", track="ceo")
        self.assertEqual(self.s.track("ana"), DEFAULT_TRACK)

    def test_each_track_only_sees_its_levels(self):
        for track, levels in TRACK_LEVELS.items():
            self.s.ensure_user(track, track=track)
            qs = self.s.next_questions(track, 40, levels=self.s.levels_for(track))
            self.assertTrue(qs, track)
            self.assertTrue(all(q.get("level", 2) in levels for q in qs), track)

    def test_mastery_counts_only_questions_the_track_can_see(self):
        """A Builder never sees level 3, so mastery must be measured against the
        questions they are actually served or their readiness is capped at half."""
        self.s.ensure_user("bob", track="builder")
        for q in content.questions():
            if q["task"] == "1.1" and q.get("level", 2) in (1, 2):
                self.s.grade("bob", q["id"], q["answer"])
        self.assertTrue(self.s.task_stats("bob")["1.1"]["mastered"])


class ExamTests(unittest.TestCase):
    def setUp(self):
        self.s = Store(":memory:")
        self.s.ensure_user("ana", "red", "senior")

    def tearDown(self):
        self.s.close()


    def _sit(self, user="ana", wrong=0):
        """Sits a full exam, deliberately missing the first `wrong` questions."""
        started = self.s.start_exam(user, rng=random.Random(7))
        answers = {}
        for i, q in enumerate(started["questions"]):
            full = content.question(q["id"])
            answers[q["id"]] = (next(k for k in "ABCD" if k != full["answer"]) if i < wrong
                               else full["answer"])
        return started, self.s.submit_exam(user, started["exam_id"], answers)

    def test_blueprint_matches_domain_weights(self):
        self.assertEqual(sum(EXAM_BLUEPRINT.values()), EXAM_QUESTIONS)
        started = self.s.start_exam("ana", rng=random.Random(1))
        self.assertEqual(len(started["questions"]), EXAM_QUESTIONS)
        got = Counter("D" + q["task"].split(".")[0] for q in started["questions"])
        self.assertEqual(dict(got), EXAM_BLUEPRINT)
        self.assertEqual(len({q["id"] for q in started["questions"]}), EXAM_QUESTIONS)

    def test_start_hides_the_answer(self):
        for q in self.s.start_exam("ana", rng=random.Random(2))["questions"]:
            self.assertNotIn("answer", q)
            self.assertNotIn("why", q)

    def test_perfect_exam_pays_once_not_per_question(self):
        _, r = self._sit()
        self.assertEqual(r["score"], 1000)
        self.assertTrue(r["passed"])
        self.assertEqual(r["xp_gained"], EXAM_MAX_XP)
        # 60 questions through the practice path would have paid ~600 XP.
        self.assertEqual(self.s.xp("ana"), EXAM_MAX_XP)
        kinds = Counter(k for (k,) in self.s._db.execute("SELECT kind FROM events WHERE user='ana'"))
        self.assertEqual(kinds, Counter({"exam": 1}))

    def test_retake_pays_only_the_improvement(self):
        _, first = self._sit(wrong=12)          # 48/60
        self.assertLess(first["score"], 1000)
        _, second = self._sit()                 # perfect
        self.assertEqual(first["xp_gained"] + second["xp_gained"], EXAM_MAX_XP)
        _, third = self._sit()                  # no improvement left
        self.assertEqual(third["xp_gained"], 0)

    def test_failing_exam_awards_nothing(self):
        _, r = self._sit(wrong=EXAM_QUESTIONS)
        self.assertEqual(r["score"], 0)
        self.assertFalse(r["passed"])
        self.assertEqual(r["xp_gained"], 0)
        self.assertEqual(self.s.xp("ana"), 0)

    def test_exam_answers_do_not_move_readiness_but_do_steer_practice(self):
        before = self.s.readiness("ana")
        self._sit()
        self.assertEqual(self.s.readiness("ana"), before, "exam answers must not feed readiness")
        self.assertEqual(self.s.task_stats("ana")["1.1"]["attempts"], 0)
        rows = self.s._q("SELECT COUNT(*) c FROM answers WHERE user='ana' AND mode='exam'")
        self.assertEqual(rows[0]["c"], EXAM_QUESTIONS, "exam answers are still recorded")

    def test_practice_still_awards_after_the_exam(self):
        started, _ = self._sit()
        sat = {q["id"] for q in started["questions"]}
        seen, unseen = next(iter(sat)), next(q["id"] for q in content.questions() if q["id"] not in sat)
        # A question the exam already answered correctly has spent its first-correct bonus...
        self.assertEqual(self.s.grade("ana", seen, content.question(seen)["answer"])["xp_gained"],
                         XP_REPEAT_CORRECT)
        # ...but practice is otherwise untouched by the exam.
        self.assertEqual(self.s.grade("ana", unseen, content.question(unseen)["answer"])["xp_gained"],
                         XP_FIRST_CORRECT)

    def test_unanswered_counts_wrong_and_is_not_recorded(self):
        started = self.s.start_exam("ana", rng=random.Random(3))
        r = self.s.submit_exam("ana", started["exam_id"], {})
        self.assertEqual(r["score"], 0)
        self.assertEqual(r["correct"], 0)
        self.assertEqual(self.s._q("SELECT COUNT(*) c FROM answers WHERE user='ana'")[0]["c"], 0)
        self.assertTrue(all(q["chosen"] is None for q in r["review"]))

    def test_submit_is_idempotent(self):
        started, first = self._sit()
        again = self.s.submit_exam("ana", started["exam_id"], {})
        self.assertEqual(again, first)
        self.assertEqual(self.s.xp("ana"), EXAM_MAX_XP, "a resubmit must not pay twice")

    def test_unknown_exam_and_other_users_exam_rejected(self):
        started = self.s.start_exam("ana", rng=random.Random(4))
        self.s.ensure_user("mal")
        with self.assertRaises(KeyError):
            self.s.submit_exam("mal", started["exam_id"], {})
        with self.assertRaises(KeyError):
            self.s.submit_exam("ana", "nope", {})

    def test_undersized_bank_refuses_rather_than_repeating_questions(self):
        """The 422 is what stops an exam shipping before the bank can fill it."""
        thin = [q for q in content.questions() if q["task"] == "1.1"]
        with mock.patch.object(content, "questions", lambda: thin):
            with self.assertRaises(ValueError) as e:
                self.s.start_exam("ana", rng=random.Random(5))
        self.assertIn("too small", str(e.exception))
        self.assertEqual(len(content.questions()), 150, "patch must not leak")

    def test_history_records_finished_exams_only(self):
        self.s.start_exam("ana", rng=random.Random(6))
        self.assertEqual(self.s.exam_history("ana"), [])
        _, r = self._sit()
        hist = self.s.exam_history("ana")
        self.assertEqual([h["score"] for h in hist], [r["score"]])

    def test_each_tracks_exam_stays_within_its_levels(self):
        for track, levels in TRACK_LEVELS.items():
            self.s.ensure_user(track, track=track)
            started = self.s.start_exam(track, rng=random.Random(8))
            self.assertEqual(len(started["questions"]), EXAM_QUESTIONS, track)
            self.assertTrue(all(content.question(q["id"]).get("level", 2) in levels
                                for q in started["questions"]), track)


class MigrationTests(unittest.TestCase):
    def test_existing_database_gains_the_new_columns(self):
        """SCHEMA is CREATE TABLE IF NOT EXISTS only, so without the PRAGMA guard an
        existing cca.db would keep the old shape and every mode/track read would no-op."""
        import sqlite3
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = str(Path(d) / "old.db")
            old = sqlite3.connect(path)
            old.executescript("""
                CREATE TABLE users(name TEXT PRIMARY KEY, squad TEXT DEFAULT '', created REAL);
                CREATE TABLE answers(id INTEGER PRIMARY KEY, user TEXT, qid TEXT, task TEXT,
                  chosen TEXT, correct INTEGER, ts REAL);
                INSERT INTO users(name, created) VALUES('old', 0);
            """)
            old.commit()
            old.close()
            s = Store(path)
            try:
                cols = {t: {r[1] for r in s._db.execute(f"PRAGMA table_info({t})")}
                        for t in ("users", "answers")}
                self.assertIn("track", cols["users"])
                self.assertIn("mode", cols["answers"])
                self.assertEqual(s.track("old"), DEFAULT_TRACK)
                qid = content.questions()[0]["id"]
                s.ensure_user("old")
                self.assertEqual(s.grade("old", qid, content.question(qid)["answer"])["xp_gained"],
                                 XP_FIRST_CORRECT)
            finally:
                s.close()   # Windows will not delete the temp dir while the file is open


def valid_q():
    return {"scenario": "Support", "stem": "A support agent loops forever when the model returns text. " * 2,
            "options": {"A": "one", "B": "two", "C": "three", "D": "four"}, "answer": "B",
            "why": {"A": "a", "B": "b", "C": "c", "D": "d"}}


class AiFeatureTests(unittest.TestCase):
    def test_generator_retries_with_error_feedback(self):
        bad = {"stem": "short", "options": {"A": "x"}, "answer": "Q", "why": {}}
        client = MockClient([
            LLMResponse("", [ToolCall("1", "submit_question", bad)], "tool_use"),
            LLMResponse("", [ToolCall("2", "submit_question", valid_q())], "tool_use"),
        ])
        q = ai_features.generate_question(client, "1.1")
        self.assertEqual(q["task"], "1.1")
        self.assertTrue(q["id"].startswith("gen-1.1-"))
        # second request must contain the failed output and the specific validation error
        second = client.calls[1]["messages"]
        self.assertEqual(second[-2]["role"], "assistant")
        self.assertIn("Validation failed", second[-1]["content"])
        self.assertEqual(client.calls[0]["tool_choice"], {"name": "submit_question"})

    def test_generator_gives_up_after_retries(self):
        bad = LLMResponse("", [ToolCall("1", "submit_question", {})], "tool_use")
        with self.assertRaises(LLMError):
            ai_features.generate_question(MockClient([bad, bad, bad]), "1.1")

    def test_validate_question(self):
        self.assertEqual(ai_features.validate_question(valid_q()), [])
        q = valid_q()
        q["options"]["C"] = "ONE"
        q["options"]["A"] = "one"
        self.assertTrue(any("distinct" in e for e in ai_features.validate_question(q)))

    def _review_args(self, m, score=80, drop=None):
        crit = [{"id": c["id"], "score": score, "evidence": "e", "fix": "f"} for c in m["rubric"]]
        if drop:
            crit = [c for c in crit if c["id"] != drop]
        return {"criteria": crit, "summary": "ok"}

    def test_review_weighted_score_and_independence(self):
        m = content.milestone("M2")
        client = MockClient([LLMResponse("", [ToolCall("1", "submit_review", self._review_args(m, 80))], "tool_use")])
        res = ai_features.review_milestone(client, "M2", {"gate.py": "def gate(): pass"})
        self.assertEqual(res["score"], 80.0)
        msgs = client.calls[0]["messages"]
        self.assertEqual(len(msgs), 1)  # fresh context, no tutor/generator history
        self.assertIn("untrusted data", msgs[0]["content"])
        self.assertEqual(client.calls[0]["tool_choice"], {"name": "submit_review"})

    def test_review_retries_when_criterion_missing(self):
        m = content.milestone("M1")
        client = MockClient([
            LLMResponse("", [ToolCall("1", "submit_review", self._review_args(m, 90, drop="history"))], "tool_use"),
            LLMResponse("", [ToolCall("2", "submit_review", self._review_args(m, 90))], "tool_use"),
        ])
        res = ai_features.review_milestone(client, "M1", {"loop.py": "x"})
        self.assertEqual(res["score"], 90.0)
        self.assertIn("missing criterion history", client.calls[1]["messages"][-1]["content"])

    def test_review_rejects_empty_submission_and_truncates(self):
        with self.assertRaises(ValueError):
            ai_features.review_milestone(MockClient([]), "M1", {"a.py": "  "})
        m = content.milestone("M1")
        prompt = ai_features.build_review_prompt(m, {"big.py": "x" * 100_000})
        self.assertLess(len(prompt), 20_000)

    def _lab_review_args(self, lab, score=80, drop=None):
        crit = [{"id": c["id"], "score": score, "evidence": "e", "fix": "f"} for c in lab["rubric"]]
        if drop:
            crit = [c for c in crit if c["id"] != drop]
        return {"criteria": crit, "summary": "ok"}

    def test_review_lab_weighted_score(self):
        lab = content.lab("L1")
        client = MockClient([LLMResponse("", [ToolCall("1", "submit_lab_review", self._lab_review_args(lab, 80))], "tool_use")])
        res = ai_features.review_lab(client, "L1", "You are an order lookup agent.", [{"name": "get_order_status"}])
        self.assertEqual(res["score"], 80.0)
        self.assertEqual(client.calls[0]["tool_choice"], {"name": "submit_lab_review"})

    def test_review_lab_retries_when_criterion_missing(self):
        lab = content.lab("L1")
        client = MockClient([
            LLMResponse("", [ToolCall("1", "submit_lab_review", self._lab_review_args(lab, 90, drop="tool-name"))], "tool_use"),
            LLMResponse("", [ToolCall("2", "submit_lab_review", self._lab_review_args(lab, 90))], "tool_use"),
        ])
        res = ai_features.review_lab(client, "L1", "prompt", [{"name": "t"}])
        self.assertEqual(res["score"], 90.0)
        self.assertIn("missing criterion tool-name", client.calls[1]["messages"][-1]["content"])

    def test_review_lab_rejects_empty_submission(self):
        with self.assertRaises(ValueError):
            ai_features.review_lab(MockClient([]), "L1", "  ", [])

    def _scenario_review_args(self, sc, score=80, drop=None):
        crit = [{"id": c["id"], "score": score, "evidence": "e", "fix": "f"} for c in sc["rubric"]]
        if drop:
            crit = [c for c in crit if c["id"] != drop]
        return {"criteria": crit, "summary": "ok"}

    def test_score_decisions_is_deterministic_and_sums_cost(self):
        sc = content.scenario("SC1")
        correct_choices = {d["id"]: d["correct"] for d in sc["decisions"]}
        det = ai_features.score_decisions(sc, correct_choices)
        self.assertEqual(det["decision_score"], 100.0)
        self.assertEqual(det["monthly_cost"], sum(d["cost"][d["correct"]] for d in sc["decisions"]))

        half_wrong = {**correct_choices, sc["decisions"][0]["id"]: "Z"}
        det2 = ai_features.score_decisions(sc, half_wrong)
        self.assertLess(det2["decision_score"], 100.0)

    def test_review_scenario_blends_decision_and_rubric_score(self):
        sc = content.scenario("SC1")
        correct_choices = {d["id"]: d["correct"] for d in sc["decisions"]}
        client = MockClient([LLMResponse("", [ToolCall("1", "submit_scenario_review",
                                                        self._scenario_review_args(sc, 80))], "tool_use")])
        res = ai_features.review_scenario(client, "SC1", correct_choices, "Because routing matches load.")
        self.assertEqual(res["decision_score"], 100.0)
        self.assertEqual(res["score"], 90.0)  # 0.5*100 + 0.5*80
        self.assertEqual(client.calls[0]["tool_choice"], {"name": "submit_scenario_review"})

    def test_review_scenario_retries_when_criterion_missing(self):
        sc = content.scenario("SC1")
        drop_id = sc["rubric"][0]["id"]
        client = MockClient([
            LLMResponse("", [ToolCall("1", "submit_scenario_review",
                                      self._scenario_review_args(sc, 90, drop=drop_id))], "tool_use"),
            LLMResponse("", [ToolCall("2", "submit_scenario_review", self._scenario_review_args(sc, 90))], "tool_use"),
        ])
        res = ai_features.review_scenario(client, "SC1", {}, "rationale text")
        self.assertEqual(client.calls[1]["messages"][-1]["content"], f"Validation failed: missing criterion {drop_id}. Resubmit with every rubric criterion.")
        self.assertAlmostEqual(res["score"], 0.5 * res["decision_score"] + 0.5 * 90)

    def test_review_scenario_rejects_empty_rationale(self):
        with self.assertRaises(ValueError):
            ai_features.review_scenario(MockClient([]), "SC1", {}, "  ")

    def test_tutor_prompt_grounded_in_domain(self):
        p = ai_features.tutor_system_prompt("D1")
        self.assertIn("1.4", p)
        self.assertNotIn("3.6 CI/CD", p)
        c = MockClient([LLMResponse("hello")])
        self.assertEqual(ai_features.tutor_reply(c, "D2", [{"role": "user", "content": "hi"}], "q"), "hello")

    def test_ask_grounding_resolves_ids_without_leaking_answers(self):
        self.assertIn("Milestone M1", ai_features.ask_grounding("M1"))
        self.assertIn("step:", ai_features.ask_grounding("M1"))
        self.assertIn("Task 1.1", ai_features.ask_grounding("1.1"))
        q = content.questions()[0]
        g = ai_features.ask_grounding(q["id"])
        self.assertIn(q["stem"][:30], g)
        self.assertNotIn(q["why"][q["answer"]], g)
        self.assertIn("General course", ai_features.ask_grounding("nope"))
        c = MockClient([LLMResponse("explained")])
        self.assertEqual(ai_features.ask_reply(c, "M2", "milestones", [], "how?"), "explained")
        self.assertIn("Milestone M2", c.calls[0]["messages"][0]["content"])

    def test_milestone_solution_forces_tool_and_rejects_empty(self):
        args = {"files": [{"name": "loop.py", "body": "print(1)"}], "walkthrough": "1. ..."}
        c = MockClient([LLMResponse("", [ToolCall("1", "submit_solution", args)], "tool_use")])
        res = ai_features.milestone_solution(c, "M1")
        self.assertEqual(res["files"][0]["name"], "loop.py")
        self.assertEqual(c.calls[0]["tool_choice"], {"name": "submit_solution"})
        with self.assertRaises(LLMError):
            ai_features.milestone_solution(MockClient([LLMResponse("no tool")]), "M1")
        with self.assertRaises(KeyError):
            ai_features.milestone_solution(MockClient([]), "M99")


def script(*steps):
    return MockClient(list(steps))


class PlaygroundTests(unittest.TestCase):
    def test_demo_all_guards_on(self):
        out = playground.run_agent(playground.demo_client(), "refund")
        kinds = [t["type"] for t in out["trace"]]
        self.assertEqual(kinds.count("gate"), 1)
        self.assertEqual(kinds.count("hook"), 1)
        self.assertEqual(out["refunds"], [])  # nothing slipped through
        self.assertEqual(out["stopped_by"], "end_turn")

    def test_without_guards_refund_goes_through(self):
        out = playground.run_agent(playground.demo_client(), "refund", {"gate": False, "hook": False})
        # unguarded: the unverified attempt AND the later one both execute (a double refund)
        self.assertEqual(out["refunds"], [{"order_id": "O2", "amount": 750.0}] * 2)

    def test_gate_only_still_blocked_by_hook_when_verified(self):
        out = playground.run_agent(playground.demo_client(), "refund", {"gate": True, "hook": False})
        self.assertEqual(out["refunds"], [{"order_id": "O2", "amount": 750.0}])  # verified, no limit hook

    def test_text_check_antipattern_drops_tool_calls(self):
        out = playground.run_agent(playground.demo_client(), "refund", {"loop_mode": "text_check"})
        self.assertTrue(out["stopped_by"].startswith("text_present"))
        self.assertTrue(any(t["type"] == "bug" for t in out["trace"]))
        self.assertEqual([t for t in out["trace"] if t["type"] == "tool"], [])

    def test_normalise_hook(self):
        c = script(LLMResponse("", [ToolCall("1", "lookup_order", {"order_id": "O1"})], "tool_use"),
                   LLMResponse("done", [], "end_turn"))
        out = playground.run_agent(c, "status of O1")
        res = next(t for t in out["trace"] if t["type"] == "tool")["result"]
        self.assertEqual(res["status"], "delivered")
        self.assertIn("T", res["placed"])
        c2 = script(LLMResponse("", [ToolCall("1", "lookup_order", {"order_id": "O1"})], "tool_use"),
                    LLMResponse("done", [], "end_turn"))
        raw = playground.run_agent(c2, "x", {"normalise": False})
        self.assertEqual(next(t for t in raw["trace"] if t["type"] == "tool")["result"]["status"], 3)

    def test_empty_result_is_not_an_error(self):
        c = script(LLMResponse("", [ToolCall("1", "lookup_order", {"order_id": "ZZ"})], "tool_use"),
                   LLMResponse("no such order", [], "end_turn"))
        res = next(t for t in playground.run_agent(c, "x")["trace"] if t["type"] == "tool")["result"]
        self.assertNotIn("isError", res)
        self.assertEqual(res["orders"], [])

    def test_safety_cap_is_backstop(self):
        loop = [LLMResponse("", [ToolCall(str(i), "lookup_order", {"order_id": "O1"})], "tool_use")
                for i in range(playground.SAFETY_CAP + 2)]
        out = playground.run_agent(script(*loop), "x")
        self.assertEqual(out["stopped_by"], "safety_cap")

    def test_final_answer_in_history_when_continuing(self):
        c = playground.demo_client()
        playground.run_agent(c, "refund")
        last_call_msgs = c.calls[-1]["messages"]
        self.assertEqual(last_call_msgs[-1]["role"], "tool")  # tool results appended before next call


class AnthropicConvertTests(unittest.TestCase):
    def test_conversion_groups_tool_results(self):
        msgs = [{"role": "system", "content": "sys"}, {"role": "user", "content": "hi"},
                {"role": "assistant", "content": "ok", "tool_calls": [
                    {"id": "a", "name": "t", "arguments": {"x": 1}}, {"id": "b", "name": "t", "arguments": {}}]},
                {"role": "tool", "tool_call_id": "a", "content": "1"},
                {"role": "tool", "tool_call_id": "b", "content": "2"}]
        system, out = AnthropicClient._convert(msgs)
        self.assertEqual(system, "sys")
        self.assertEqual(len(out), 3)
        self.assertEqual([b["type"] for b in out[1]["content"]], ["text", "tool_use", "tool_use"])
        self.assertEqual(len(out[2]["content"]), 2)


if __name__ == "__main__":
    unittest.main()
