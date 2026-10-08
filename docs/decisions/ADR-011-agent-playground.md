# ADR-011: Simulated support agent with toggleable guards

**Status:** Accepted

## Decision
The Playground runs a real agentic loop over simulated tools (verify_customer, lookup_order, process_refund). Toggles: loop termination (correct vs text-check anti-pattern), prerequisite gate, refund-limit hook, PostToolUse normalisation. An offline scripted demo runs without any API key.
Safety cap of 10 turns exists as a backstop only and is reported as `safety_cap` when hit.

## Consequences
+ Learners see exam anti-patterns fail (e.g. a refund executed with the gate off) without risk. - Simulated data only; it teaches mechanics, not production hardening.
