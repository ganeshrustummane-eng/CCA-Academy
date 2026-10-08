---
paths: ["app/backend/content/*.yaml"]
---
# Editing content YAML

## Never use inline flow mappings for prose
An unquoted flow scalar **ends at the first comma**, so the rest of the sentence silently
becomes a key with value `None`. This corrupted 16 of 38 rubric criteria before it was caught:

```yaml
# WRONG - `check` truncates at "signal", and the remainder becomes a bogus None key
- {id: stop-signal, weight: 30, check: Loop stops on the end signal, with no text parsing.}

# RIGHT - block mapping with a folded scalar; commas and colons are safe inside it
- id: stop-signal
  weight: 30
  check: >-
    Loop stops on the end signal, with no text parsing.
```
Use block mappings with `>-` for every multi-word value in `rubric`, `why`, `options` and any
new content file. It never needs escaping and it survives rewording.

## Other rules
- Quote or reword any value containing `: ` (colon + space); it breaks YAML parsing.
- `questions.yaml`: unique `id` as `q-<task>-<letter>`, `task` must exist in curriculum, options A-D, `why` has A-D.
- `milestones.yaml`: rubric weights sum to 100; every task id must exist; every one of the 30 tasks must be covered by at least one milestone.
- After edits run the backend unit tests; they enforce all of the above, including
  `test_rubric_entries_have_exact_keys` and `test_no_none_values_anywhere_in_content`, which
  reject the comma bug in **any** file under `content/`.
