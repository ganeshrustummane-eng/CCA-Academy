# ADR-009: Provider-agnostic LLM layer, DIAL default, bring-your-own key

**Status:** Accepted

## Context
EPAM DIAL is the org-supported gateway (OpenAI-compatible via AzureOpenAI client, needs VPN). Learners may prefer other providers. The issued DIAL key is a PERSONAL key: individual use only, reduced limits, must not back team workloads.

## Decision
- `cca/llm.py` defines a neutral message/tool format and normalises `finish_reason`/`stop_reason` to `tool_use | end_turn | max_tokens`. Clients: DIAL (AzureOpenAI), OpenAI-compatible, Anthropic, and a Mock for tests and the offline demo.
- Default provider `dial`, endpoint `https://ai-proxy.lab.epam.com`, api version `2025-04-01-preview`, model configurable (`LLM_MODEL`; list models with the DIAL `/openai/models` endpoint).
- Each learner pastes their own key in Settings. It is kept in sessionStorage, sent per request as `X-LLM-Key`, never stored or logged. Provider errors are sanitised so keys cannot leak into responses.
- A server-wide key is optional and only for a team/regular DIAL key, never a personal one. Per-user hourly call cap protects shared limits (429 handling).
- Keys are never committed; `.env.example` has placeholders only.

## Consequences
+ Works for DIAL, OpenAI-style and Anthropic users; testable offline. - A pasted key transits the app server; use HTTPS/internal hosting only.
- Newer models may restrict `temperature`; clients omit it unless set.
