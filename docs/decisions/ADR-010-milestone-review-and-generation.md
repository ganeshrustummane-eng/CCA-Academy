# ADR-010: Rubric-based milestone review by an independent instance; validated question generation

**Status:** Accepted

## Decision
- Milestone review uses a FRESH conversation (no tutor/generator history), forced tool call `submit_review` with a JSON schema, one score per rubric criterion, weighted total, pass mark 70. Submission text is wrapped as untrusted data and size-capped.
- Missing or invalid criteria trigger a validation-retry with the specific error (max 3 tries).
- XP is awarded only for improvement over the learner's best score.
- Question generation uses forced `tool_choice`, a schema check, and retry with error feedback; generated questions are stored per user and graded server-side (answers never sent to the browser first).
- Each mechanism intentionally mirrors an exam concept (4.3, 4.4, 4.6) so the app teaches by example.

## Consequences
+ Consistent, explainable grading. - LLM grading is approximate; humans (domain leads) spot-check, and the pass mark is a guide, not a certification.
