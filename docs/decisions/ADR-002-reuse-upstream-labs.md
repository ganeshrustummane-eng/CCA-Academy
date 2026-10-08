# ADR-002: Link to aderegil labs; do not fork or modify

**Status:** Accepted

## Context
`aderegil/claude-certified-architect` provides 6 labs covering all 30 task statements. Its licence is CC BY-NC-ND 4.0: non-commercial, **no derivatives**.

## Decision
Participants clone the upstream repo as-is. Our repo holds only original material: curriculum, question bank, Break-It challenges, boss battles, and autograder checks that inspect participants' lab output.

## Consequences
+ Licence-safe, upstream improvements flow in. - Autograder must tolerate upstream layout changes; pin a commit SHA per cohort.
- Internal training use is non-commercial, but confirm with Legal if the programme is ever sold externally.
