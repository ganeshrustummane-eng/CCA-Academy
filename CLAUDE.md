# CCA Academy: project conventions

Team learning app for the Claude Certified Architect (Foundations) exam. Backend `app/backend` (FastAPI, Python 3.10+), frontend `app/frontend` (React + Vite).

## Rules that always apply
- Content is ORIGINAL. Never paste real exam items or upstream lab code (CC BY-NC-ND). Link to upstream instead. See `docs/decisions/ADR-008`.
- Never commit API keys. `.env` is git-ignored; keys travel per request via headers and are never logged or stored.
- Every question needs four options, a correct letter, and a one-line reason for EACH option.
- Run `cd app/backend && python -m unittest discover -s tests` before finishing any backend or content change.
- Record architectural choices as ADRs in `docs/decisions/` (next free number) and tick `PROGRESS.md`.

## Layout
- `app/backend/content/*.yaml`: curriculum (30 tasks), questions, milestones. Edited by humans and agents.
- `app/backend/cca/`: `llm.py` provider layer, `store.py` progress/XP, `ai_features.py` tutor/generator/reviewer, `playground.py` agent demo.
- `claude-config/`: agents (tutor, question-author, milestone-reviewer, content-auditor), skills (add-question, review-milestone, run-boss-battle, update-progress) and rules. Run `claude-config/install.ps1` (or `install.sh`) once to copy them into `.claude/`.

## Commands
- Backend: `cd app/backend && pip install -r requirements.txt && uvicorn main:app --reload`
- Frontend: `cd app/frontend && npm install && npm run dev` (proxies /api to :8000)
- Tests: `cd app/backend && python -m unittest discover -s tests`
