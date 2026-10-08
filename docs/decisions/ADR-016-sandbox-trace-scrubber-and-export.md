# ADR-016: Agent sandbox trace scrubber and Python export are frontend-only

**Status:** Accepted

## Decision
The Playground's trace was a flat list; it now has a step scrubber (range input + prev/next)
so a learner can walk one turn/tool-call/hook at a time instead of reading the whole run at
once. `GET /api/playground/tools` exposes the real `TOOLS`/`SYSTEM` the backend agent uses, shown
in a collapsible reference panel — no duplication of the schema in the frontend.

"Export as Python" (`tracesToPython` in `ui.jsx`) needs no backend endpoint: every value it uses
(system prompt, tool schemas, the user message, the recorded trace) is already in the browser
after a run. It renders an Anthropic-SDK-shaped script with the real tool loop plus the actual
trace as trailing comments, downloaded as a `.py` file via a `Blob` + anchor click — the same
pattern as the existing `CopyButton`.

## Consequences
+ No new backend surface for export; one small pure function, easy to unit-test if it grows.
- The exported script is illustrative (`run_tool` is a stub comment, not wired to real tools);
  good enough to teach the loop shape, not meant to run unmodified.
