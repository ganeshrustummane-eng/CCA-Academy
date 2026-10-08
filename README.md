# CCA Academy

Team web app for learning, practising and tracking the Claude Certified Architect (Foundations) exam topics.

**Features:** curriculum with exam traps (30 task statements) · weak-first practice quiz · AI-generated questions · 8 milestone projects with AI rubric review · per-domain AI tutor · agent playground showing loops, gates and hooks · XP, levels, badges, squad leaderboard.

## Run it

```bash
# 1. Backend (Python 3.10+)
cd app/backend
python -m venv .venv # Windows: .venv\Scripts\activate
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # keep LLM_API_KEY empty for team use
uvicorn main:app --reload                            # http://localhost:8000

# 2. Frontend
cd ../frontend
npm install
npm run dev                                          # http://localhost:5173
```

Open the app, go to **Settings**, enter your name, pick a provider and paste your own API key, then press **Test connection**.

- **DIAL (default):** needs EPAM VPN. Use `GET https://ai-proxy.lab.epam.com/openai/models` with your key to list model names and set the **Model** field. Personal DIAL keys are for individual use: each learner uses their own, never a shared one.
- **Other providers:** choose OpenAI-compatible or Anthropic and enter that key and model.
- **No key?** The Playground's offline demo and the whole quiz/learn/progress flow work without one.

## Production

```bash
cd app/frontend && npm run build        # FastAPI then serves frontend/dist at /
```
Host on an internal network over HTTPS (keys are sent per request).

## Tests

```bash
cd app/backend && python -m unittest discover -s tests    # offline, no key needed
```

## Claude Code agents and skills

```powershell
powershell -File claude-config\install.ps1     # or: bash claude-config/install.sh
```
Installs `cca-tutor`, `question-author`, `milestone-reviewer`, `content-auditor` and the `add-question`, `review-milestone`, `run-boss-battle`, `update-progress` skills into `.claude/`.

## Docs
`PLAN.md` programme plan · `PROGRESS.md` build tracker · `docs/decisions/` ADRs · `docs/architecture.html` diagram.

Independent study aid, not affiliated with Anthropic. Hands-on labs: [aderegil/claude-certified-architect](https://github.com/aderegil/claude-certified-architect) (CC BY-NC-ND, linked not copied).
