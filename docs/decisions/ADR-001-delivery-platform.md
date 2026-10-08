# ADR-001: Delivery platform is a GitHub repo with CI-driven gamification

**Status:** Accepted

## Context
15-50 engineers, 3-4 hrs/week. They already live in GitHub. The user chose repo-based delivery.

## Decision
Use a single GitHub repo. Progress is recorded as PRs/commits; GitHub Actions compute XP and publish `LEADERBOARD.md`.

## Options considered
- **Repo + Actions (chosen):** no hosting, auditable, matches developer workflow.
- Web quiz app: nicer UX, but hosting, auth and maintenance cost.
- Slack bot: good nudging, weak for lab evidence.

## Consequences
+ Zero infra, versioned history. - Less polished UX; Slack webhook added only for the weekly digest.
