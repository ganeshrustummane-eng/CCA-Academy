---
name: update-progress
description: Refresh PROGRESS.md (programme build tracker) from the repo state. Use at the end of a working session or before a status update.
allowed-tools: Read, Edit, Grep, Bash
---
1. Count tasks, questions per domain and milestones from the content YAML.
2. Run the backend unit tests and record pass/fail honestly.
3. Tick or untick items in PROGRESS.md; add dated notes for anything blocked.
4. If a decision was made, make sure an ADR exists in `docs/decisions/`.
