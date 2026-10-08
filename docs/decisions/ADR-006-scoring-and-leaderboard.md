# ADR-006: CI-verified XP, squad-based leaderboard

**Status:** Accepted

## Decision
- XP is only awarded from machine-verifiable evidence: quiz results posted by the CLI, autograder checks on lab artefacts, boss scores.
- Leaderboard rebuilt by GitHub Action on push and nightly; written to `LEADERBOARD.md`.
- Team score = mean XP of squad (4-5 mixed-level members) + streak multiplier, to encourage peer help rather than lone competition.
- "Certified-Ready" requires level 4 plus a full mock >= 800/1000 (buffer over the 720 pass mark).
- Opt-out of public ranking is allowed; progress still tracked privately.

## Consequences
+ Hard to game, transparent. - Competitive framing may demotivate some; mitigated by squad scoring and opt-out.
