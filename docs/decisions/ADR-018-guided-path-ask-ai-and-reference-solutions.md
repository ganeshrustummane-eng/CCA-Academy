# ADR-018: Guided learning path, Ask AI everywhere, and on-demand reference solutions

**Status:** Accepted (amends ADR-017)

## Decision
- **Learning path** (`Path.jsx`, default landing after onboarding): one stop per milestone, ordered
  by week, each split into learn -> practise -> build -> review, ending in the mock exam. Derived
  entirely from existing content and dashboard data; no new state.
- **How this tab works**: every entry in `App.jsx` `PAGES` carries a `how` list rendered as a
  collapsed numbered panel under the blurb.
- **Ask AI** (`Ask.jsx`, `POST /api/ask`): a floating panel on every page except the mock exam
  (hidden in the UI and refused server-side before a client or rate-limit slot is used). The client
  sends only an id (task, milestone, lab, scenario, domain or question); the server resolves it to
  grounding from our YAML. Question grounding never includes the answer key or rationales.
  Pages open it with `askAI(prompt, ref)` (a `cca-ask` window event).
- **Milestone steps**: `steps:` list per milestone in `milestones.yaml`, shown as a checklist with
  an Ask AI button per step. Ticks are personal and stored in localStorage only.
- **Reference solution** (`POST /api/milestones/{id}/solution`): generated on demand by the LLM
  with a forced `submit_solution` tool, from our brief/guide/rubric, so it is original and never
  upstream lab code (ADR-008). The first reveal writes a zero-XP `solution` event; afterwards that
  milestone's reviews are still scored and can pass but award no XP (ADR-006 leaderboard integrity).

## Consequences
+ Learners always have a next step and a way to get unstuck without leaving the page.
+ No hand-maintained solution code to keep correct or original.
- Generated solutions vary run to run and can be imperfect; they are a study aid, not an answer key.
- Each reveal and each Ask AI message is one provider call on the learner's key.
