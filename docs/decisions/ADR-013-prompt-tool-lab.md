# ADR-013: Prompt/Tool Lab reuses the milestone review pipeline

**Status:** Accepted

## Decision
The Lab (`content/lab.yaml`, `/api/labs`, `/api/labs/{id}/review`) asks the learner for a system
prompt plus tool definitions against a scenario, and scores them with the same rubric-based,
validation-retry reviewer used for milestones (`ai_features.review_lab`, mirrors
`review_milestone`). It shares the `reviews` SQLite table with milestones instead of a new table:
lab ids (`L1..`) and milestone ids (`M1..`) never collide, so `_award_best`/`_best_score` work
unchanged and no schema migration is needed.

## Consequences
+ No new persistence code, XP math, or retry loop to maintain — one reviewer pattern for both
features. - A lab and a milestone sharing a numeric id prefix would silently merge their scores;
mitigated by the `L`/`M` id convention, not enforced in code.
