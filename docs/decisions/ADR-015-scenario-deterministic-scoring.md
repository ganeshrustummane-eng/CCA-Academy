# ADR-015: Architecture scenarios split deterministic and LLM-judged scoring

**Status:** Accepted

## Decision
Scenarios (`content/scenarios.yaml`, `/api/scenarios/{id}/review`) present multiple-choice
trade-off decisions (model tier, caching, batch-vs-stream, RAG-vs-tools) each with a known
correct answer and a per-option monthly-cost table. `score_decisions` grades these in plain
Python — never asked of the LLM — because they have one objectively correct answer and a cost
number is either right or wrong. Only the learner's free-text rationale is sent to the LLM
reviewer, scored against the scenario's rubric via the same validation-retry tool-call pattern
used by milestones and labs. The overall score is `0.5 * decision_score + 0.5 * rubric_score`.

## Consequences
+ No prompt can talk the reviewer into crediting a wrong decision or a made-up cost figure.
- Rubric criteria must stay focused on reasoning quality, not re-litigating facts the Python
  layer already decided.
