# ADR-019: Learning first, exam second

**Status:** Accepted, all three phases implemented (amends ADR-006, ADR-012, ADR-018)

## Context
The goal is that every colleague learns how to do the work. Passing the exam is a side effect.
A failed mock exam is fine as long as the learner knows what to study next.

What the app does today, and where it falls short of that goal:

| # | Today | Gap for a learner |
|---|---|---|
| G1 | Learn shows each task as summary + rules + traps (`curriculum.yaml`) | It reads like a cheat sheet. The only worked example is "Explain with AI", so a learner without an API key never sees one. |
| G2 | Practice shows "why each option" after an answer | A wrong answer does not point back to the rule or trap it tested, or to the Learn page. |
| G3 | `next_questions` gives a missed question weight 2.0 | There is no way to say "show me only what I got wrong". Mistakes come back at random, or not at all. |
| G4 | `task_stats`: a task is mastered once each question has been answered correctly at least once | A lucky guess counts for life, and a later wrong answer never un-masters the task. Readiness overstates what someone knows. |
| G5 | Exam results show a red "Below the pass mark" pill, domain bars and the list of missed questions | No next step. A colleague who failed gets a verdict, not a study plan. |
| G6 | The curriculum starts at task 1.1 (`stop_reason`, `tool_use`, hooks, MCP) | People new to LLM APIs have no primer or glossary, and PLAN.md's week 0 doesn't exist in the app. |
| G7 | Revealing a milestone solution warns "will no longer earn XP" before anything else | The warning puts people off looking at worked solutions. It also doesn't push them to try first and compare after, which is how people learn from a solution. |

## Decision
Make the app teach first. Each change reuses data we already have. No new services, no new
dependencies, and only one new content field per task.

### Phase 1: close the feedback loop (frontend only, no new state)
1. **Missed answer → concept (G2).** In Practice, after a wrong answer, show the tested task's
   `traps` and a **Re-read task X.Y** button (`goto("learn", { task })`). Use the same button
   in each item of the Exam review.
2. **Study plan after the exam (G5).** In `Exam.jsx` `Results`, add a "What to learn next"
   card. It groups `result.review` misses by task, takes the top 3, and gives each a
   *Learn* and a *Practise* button. Rename "Below the pass mark" to
   "Not yet: here is your plan". Keep the score unchanged.
3. **Attempt-first wording (G7).** The milestone solution copy becomes "Submit one honest
   attempt, then compare with the reference." The XP rule from ADR-018 stays the same. Only
   the wording and the order on the page change.

### Phase 2: honest progress signal (small backend change)
4. **Review my mistakes (G3).** Add `mistakes=true` to `/api/quiz/next`. The pool becomes
   questions whose *latest* answer was wrong, in practice or in the mock exam. Exam misses
   belong here because that is where people who failed should start. Mastery (item 5) stays
   practice-only, so readiness does not become circular. In Practice it appears as a focus
   option "My mistakes (n)", with `n` taken from the dashboard's `mistakes` count. The empty
   state says "Nothing to review".
5. **Mastery = latest answer correct (G4).** In `task_stats`, a task is mastered when the
   *most recent* practice answer to each visible question is correct. A later miss
   un-masters it until that question is answered correctly again. The tests
   `test_mastery_badges_readiness` and `test_mastery_counts_only_questions_the_track_can_see`
   still hold. Add one test for the un-master case.

### Phase 3: content that teaches without a key (YAML + rendering)
6. **Worked example per task (G1).** Add an `example` field to each of the 30 tasks in
   `curriculum.yaml`: one short original snippet (code, config or prompt) that shows the
   right way, with the trap as a commented-out line, and 1-2 sentences on why it works.
   Render it in Learn under "What is tested". Guard test: every task has an `example`.
   It must be original (ADR-008) and not copied from upstream labs.
7. **Basics primer (G6).** Add a top-level `glossary:` to `curriculum.yaml` with about 15
   plain-language terms (Messages API, tool_use, stop_reason, system prompt, context window,
   MCP, subagent, hook, CLAUDE.md, Batch API, structured output, few-shot, ...). Render it as
   a "Start here: the basics" card at the top of Learn and as stop 0 on the Learning path.

### Out of scope (stays in the PROGRESS backlog)
Full spaced repetition with intervals, automated Break-It checks, SSO and Docker. Phase 2's
mistakes mode covers most of the value of spaced repetition for now.

## Consequences
+ Every wrong answer leads back to the concept it tested. Every failed exam ends with a plan.
+ Readiness and "mastered" track what the learner knows now, not their best day.
+ Learners without an API key still get worked examples and a primer.
+ Phases 1 and 2 are small diffs with no new tables. Each phase can ship on its own.
- Phase 3 means writing 30 examples and a glossary by hand. Review each one for originality
  and accuracy before merging (same caveat as ADR-017).
- With G4, some learners will see readiness drop when this ships. Say why in the release note.
