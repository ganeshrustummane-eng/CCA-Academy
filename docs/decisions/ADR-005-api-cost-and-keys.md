# ADR-005: Shared org workspace with per-user budget caps

**Status:** Accepted (budget figures to be set by finance)

## Context
Labs need Anthropic API keys; Labs 02 and 05 need Claude Code. 15-50 users.

## Decision
- One Anthropic Console workspace for the programme; one key per participant with a spend limit.
- Default to the smallest model that works for labs (Haiku) unless a lab needs more.
- Batch API used only in Lab 06 (also teaches the 50% saving).
- Keys in `.env`, never committed; `.gitignore` and pre-commit secret scan enforced.

## Consequences
+ Predictable spend, no personal cards. - Needs an admin to provision keys at kickoff.
