# CCA Academy: Team Plan for Claude Certified Architect (Foundations)

**Audience:** 15-50 teammates, 3-4 hrs/week each. **Duration:** 6 weeks + 1 exam-prep week.
**Delivery:** GitHub repo + CI-driven gamification (zero hosting). **Owner:** Ganesh.

## 1. Goal and success metrics

| Metric | Target |
|---|---|
| Participants completing all 6 labs | >= 70% |
| Mock exam score (720/1000 pass mark) | >= 80% of cohort above 720 before exam |
| Weekly active participation | >= 80% |
| Weak-domain recovery (retest gain) | +15 pts on the lowest domain |

Note: the exam is currently gated to Claude Partner Network affiliation. Confirm eligibility early (see Risks).

## 2. Exam facts the programme is built around

- 5 domains: D1 Agentic Architecture 27%, D2 Tool Design & MCP 18%, D3 Claude Code Config 20%, D4 Prompt Eng & Structured Output 20%, D5 Context & Reliability 15%.
- 6 scenarios: Customer Support Agent, Code Generation, Multi-Agent Research, Developer Productivity, CI/CD, Structured Extraction.
- Scenario-based multiple choice, pass 720/1000. Wrong answers sound like good engineering, so the programme trains *distractor elimination*, not recall.
- Recurring exam rules (drilled in every format): deterministic enforcement for high-stakes; better tool descriptions before classifiers; `stop_reason` not text parsing; subagents have isolated context; explicit criteria over "be conservative"; sync API for blocking work, Batch for latency-tolerant.

## 3. Learning loop (per week)

Each week follows **Learn -> Build -> Break -> Quiz -> Boss**:

1. **Learn (45 min):** read the domain brief (`curriculum/`) + the Domain tutor prompt from the source guide.
2. **Build (90 min):** do the lab (aderegil labs, linked, not copied; see ADR-002).
3. **Break (30 min):** run a "Break It" challenge: reintroduce an exam anti-pattern (e.g. text-based loop termination) and observe the failure. This builds the intuition the exam tests.
4. **Quiz (30 min):** daily 5-question drill via `cca quiz` CLI + weekly 10-question domain quiz.
5. **Boss (30 min, Friday):** a scenario "boss battle": one long scenario with 4-option questions and a post-mortem on every distractor.

## 4. Curriculum calendar

| Week | Focus | Domains / tasks | Lab | Boss battle |
|---|---|---|---|---|
| 0 | Kickoff, API keys, repo setup, diagnostic exam (baseline) | all | Setup | Diagnostic |
| 1 | Agentic loops, hooks, enforcement | D1: 1.1, 1.4, 1.5; D2: 2.1-2.3 | Lab 01 Customer Support | "The Refund Incident" |
| 2 | Multi-agent orchestration, context passing | D1: 1.2, 1.3, 1.6; D5: 5.3, 5.6 | Lab 03 Multi-Agent Research | "The Narrow Coordinator" |
| 3 | Claude Code configuration | D3: 3.1-3.4; D1: 1.7 | Lab 02 Code Generation | "The Missing Teammate" |
| 4 | Developer productivity, MCP, built-ins | D2: 2.4, 2.5; D5: 5.4 | Lab 04 Dev Productivity | "The Context Cliff" |
| 5 | CI/CD, prompt engineering, review | D3: 3.5, 3.6; D4: 4.1, 4.2, 4.6 | Lab 05 CI/CD | "The Noisy Reviewer" |
| 6 | Structured extraction, batch, calibration | D4: 4.3-4.5; D5: 5.1, 5.2, 5.5 | Lab 06 Extraction | "The 97% Lie" |
| 7 | Exam prep: full mock x2, weak-area sprints | all | None | Final mock |

Lab-to-task mapping follows the upstream Lab Reference. Weekly hours: ~3.5.

## 5. Gamification design

**XP (earned by CI-verified evidence, not honour system):**

| Action | XP |
|---|---|
| Daily drill (5 Qs, >= 4 correct) | 10 |
| Weekly domain quiz (score x 1) | up to 100 |
| Lab checkpoint passes (autograder checks) | 50 each |
| Break-It challenge solved | 40 |
| Boss battle (score-scaled) | up to 150 |
| Helping a peer (reviewed PR to `notes/`) | 20 |
| Full mock >= 720 | 200 |

**Levels:** Apprentice (0) -> Builder (300) -> Orchestrator (700) -> Architect (1200) -> Certified-Ready (1200 XP + mock >= 800).

**Badges** (one per exam trap): *Loop Master* (stop_reason), *Gatekeeper* (programmatic enforcement), *Isolation Expert* (subagent context), *Description Doctor*, *Hierarchy Hunter* (CLAUDE.md), *Be Explicit*, *Batch Boss*, *Provenance Pro*.

**Leaderboards:** individual + team (squads of 4-5, mixed experience). Team score = mean XP, to reward helping weaker members. Squad streaks (all members drilled today) give a bonus multiplier.

**Anti-gaming:** quiz answers not in repo (see ADR-004); autograder runs in CI against submitted artefacts; leaderboard is generated from CI results only.

## 6. Roles

- **Programme owner (Ganesh):** cadence, escalations, exam eligibility.
- **Domain leads (5 volunteers):** one per domain; host 30-min Thursday clinic, review question bank PRs.
- **Squad captains:** track squad streak, nudge.
- **Participants:** weekly Friday boss battle live (30 min, optional replay).

## 7. Weekly operating rhythm

| Day | Activity |
|---|---|
| Mon | Domain brief released; lab opens |
| Tue-Wed | Build + daily drills |
| Thu | Domain-lead clinic |
| Fri | Boss battle; leaderboard posted (auto) |
| Weekend | Optional stretch (Break-It) |

## 8. Implementation phases

| Phase | Duration | Output |
|---|---|---|
| P0 Foundations | 1 wk | Repo skeleton, licence check, labs linked, question-bank schema |
| P1 MVP | 2 wks | `cca quiz` CLI, 150 questions (30/domain), XP engine, leaderboard action |
| P2 Content | 2 wks (parallel with cohort wk 1-2) | Break-It challenges, boss scenarios, autograder checks for Labs 01, 03 |
| P3 Scale | ongoing | Autograders for Labs 02, 04-06, analytics dashboard, spaced repetition |

Cohort can start at the end of P1; later labs get autograders while earlier weeks run.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Exam access requires Partner Network | Confirm in week 0; programme still teaches the skills |
| Upstream lab licence (CC BY-NC-ND) forbids modification | Link, do not copy or modify (ADR-002) |
| Question leakage / copying official exam | Write original questions only; never use real exam content |
| API cost across 50 people | Shared org key with per-user budget caps, Haiku for labs where possible (ADR-005) |
| Drop-off after week 2 | Squad streaks, Friday live boss, domain-lead clinics |
| Content drift as Claude features change | Quarterly review owner; question bank has `last_verified` field |

## 10. Repository layout

See `docs/decisions/` for ADRs and `docs/architecture.html` for the diagram. Proposed structure:

```
cca-academy/
  curriculum/        weekly briefs (D1..D5)
  labs/              links + our autograder checks (not upstream code)
  question-bank/     YAML questions (domain, task, scenario, rationale per distractor)
  break-it/          anti-pattern challenges
  boss-battles/      scenario exams
  cli/               `cca quiz`, `cca status`
  engine/            XP, levels, badges, leaderboard builder
  .github/workflows/ grade.yml, leaderboard.yml, weekly-digest.yml
  LEADERBOARD.md     auto-generated
```
