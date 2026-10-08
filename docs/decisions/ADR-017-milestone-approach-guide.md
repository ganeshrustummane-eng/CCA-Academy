# ADR-017: Milestones carry an approach guide, not a solution

**Status:** Accepted

## Decision
Each milestone in `content/milestones.yaml` gets a `guide` field: a short, original
explanation of the approach (what to check, what order, what trap it's testing) written for
this project, never copied from the upstream repo or any real solution. It renders collapsed
behind a "Need a nudge?" `<details>` in `Milestones.jsx` so it doesn't spoil the brief for
learners who don't want it. A guard test (`test_milestones_have_a_guide_distinct_from_the_brief`)
only checks it exists and isn't a copy of the brief — it cannot check originality, that's on
whoever edits the YAML.

## Consequences
+ Learners stuck on a milestone get a nudge without anyone pasting real exam/lab code (ADR-008).
- Guides must be hand-written and kept approach-level; a future editor could slip in
  implementation detail that is closer to a solution than intended. Review new/edited guides
  for that before merging.
