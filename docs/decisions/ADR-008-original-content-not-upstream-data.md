# ADR-008: App content is original; upstream repos are linked, not ingested

**Status:** Accepted

## Context
The request was to build the app "from the repos' data". The main lab repo is CC BY-NC-ND 4.0 (no derivatives), and other community repos have their own terms. Real exam items must not be reproduced.

## Decision
- Curriculum, questions and milestone rubrics are authored from the public exam outline and the team's own study guide, then stored in `app/backend/content/*.yaml`.
- Upstream labs are referenced by lab number and link only (Learn page, milestone briefs).
- Third-party repos can inform topic coverage, but no text or code is copied. The `content-auditor` agent checks for this.

## Consequences
+ Licence-safe and fully editable by the team. - Authoring effort; the generator and `question-author` agent reduce it.
- If Legal approves a specific upstream licence, content can be revisited.
