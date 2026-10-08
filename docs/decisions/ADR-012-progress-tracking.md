# ADR-012: Two-level progress tracking

**Status:** Accepted

## Decision
- Learner progress: SQLite ledger (answers, reviews, XP events). Mastery per task = all built-in questions for that task answered correctly at least once. Exam readiness = domain-weighted blend of accuracy (50%) and mastery (50%). "Certified-Ready" = 1200 XP and readiness >= 80.
- Programme progress: `PROGRESS.md` checklist, updated via the `update-progress` skill, with ADRs for decisions.
- Question XP: 10 first correct, 2 on repeats (anti-farming). Milestone XP scales with score and only pays on improvement.

## Consequences
+ Transparent, hard to farm. - Readiness is a heuristic; the full mock exam remains the real gate.
