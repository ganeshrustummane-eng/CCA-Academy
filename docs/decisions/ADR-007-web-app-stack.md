# ADR-007: FastAPI backend + React (Vite) frontend, SQLite storage

**Status:** Accepted (supersedes the "no hosting" note in ADR-001 for the learning UI; GitHub remains the content source of truth)

## Context
The team wants a web app to learn, practise and track progress. Labs and tooling are Python; the user chose FastAPI + React.

## Decision
- Backend: FastAPI, SQLite (single file, trivial to back up), pure-Python core (`store.py`, `playground.py`) with no web dependency so it is unit-testable.
- Frontend: React 18 + Vite, no router or state library (small surface, fewer dependencies).
- In production FastAPI serves `frontend/dist`; in development Vite proxies `/api`.
- Identity: self-declared name via `X-User` header. Acceptable for an internal cohort; replace with SSO before any wider rollout (see PROGRESS.md backlog).

## Consequences
+ Two small deployables, easy local run. - No auth means anyone can use any name; leaderboard is trust-based.
- SQLite is single-writer; fine for 15-50 users, revisit above that.
