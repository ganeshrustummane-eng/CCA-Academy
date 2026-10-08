# ADR-004: Original question bank in YAML, answers served by CLI

**Status:** Accepted

## Decision
Questions are authored by domain leads in YAML (`id, domain, task, scenario, stem, options, answer, rationale_per_option, last_verified`). Target 30/domain by P1 (150), 300 by P3.
- Never copy real exam items; write original scenario items.
- Answer keys live in a separate `answers/` file excluded from default checkout (private repo branch or encrypted hashes) so the CLI checks answers without participants browsing them.
- Every distractor needs a written reason it is wrong; this feeds the boss-battle post-mortems.

## Consequences
+ Reviewable via PR, reusable by CLI/CI. - Authoring effort (~150 questions); split across 5 domain leads (~30 each).
