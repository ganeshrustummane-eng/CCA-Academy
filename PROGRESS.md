# Programme build tracker

Last updated: 2026-10-06

## Done
- [x] Programme plan, ADR-001 to ADR-006, architecture diagram
- [x] Curriculum: 5 domains, 30 task statements (original content)
- [x] 150 original practice questions, 30 per domain (every task covered)
- [x] 8 milestone projects with weighted rubrics (every task covered)
- [x] Backend: provider layer (DIAL/OpenAI/Anthropic/mock), XP/levels/badges/readiness, quiz, tutor, question generator, milestone reviewer, agent playground
- [x] Frontend: dashboard, learn, practice, milestones, tutor, playground, leaderboard, settings
- [x] Claude Code agents (4), skills (4), rules (1) in `claude-config/`
- [x] ADR-007 to ADR-019
- [x] Backend unit tests: 77 passing (offline, mock LLM)
- [x] Frontend JSX syntax check passes
- [x] Mock exam mode (60Q, 90min, pass 700/1000) + 4 role tracks (verified end-to-end against a running server), ADR-014
- [x] Prompt/Tool Lab: 3 exercises (L1-L3, `content/lab.yaml`), `/api/labs`, `/api/labs/{id}/review`, `PromptLab.jsx`, ADR-013
- [x] Architecture scenarios: 2 cases (SC1-SC2, `content/scenarios.yaml`) with deterministic
      decision/cost scoring plus LLM-reviewed rationale, `/api/scenarios`,
      `/api/scenarios/{id}/review`, `Scenarios.jsx`, ADR-015
- [x] Agent sandbox: trace step scrubber, `GET /api/playground/tools` reference panel,
      export-run-as-Python, ADR-016
- [x] Milestones: collapsible "approach guide" per project (original, not upstream code),
      `Milestones.jsx`, ADR-017
- [x] Guided learning path tab, "How this tab works" on every tab, floating Ask AI on every page
      (`/api/ask`, off during the mock exam), 7-step plans per milestone, on-demand reference
      solution (`/api/milestones/{id}/solution`, forfeits that milestone's XP), mock exam wired
      into the nav, ADR-018
- [x] Learning first (ADR-019): wrong answers link back to the task and its traps, mock exam
      ends with a "What to learn next" plan, "My mistakes" practice focus (`mistakes=true`),
      mastery = latest answer correct, worked example per task + basics glossary in
      `curriculum.yaml` (offline, no key), attempt-first wording for reference solutions

## Not yet verified (needs your machine)
- [ ] `pip install -r requirements.txt` and `uvicorn main:app` start cleanly (FastAPI/OpenAI SDK could not be installed in the build sandbox)
- [ ] `npm install && npm run build` succeeds (npm registry blocked in the build sandbox)
- [ ] Live call to DIAL on EPAM VPN via Settings > Test connection; confirm model name from `/openai/models`
- [ ] Run `claude-config/install.ps1` to activate agents and skills

## Next (backlog)
- [ ] SSO or invite-code auth instead of self-declared names
- [ ] Spaced repetition scheduling in `next_questions`
- [ ] Break-It challenges as automated checks
- [ ] Docker image and internal hosting
- [ ] Squad weekly digest to Slack
- [ ] Re-verify product facts quarterly (batch limits, CLI flags)

## Decisions
See `docs/decisions/` (ADR-001 to ADR-019).
