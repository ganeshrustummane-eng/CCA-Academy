---
name: add-question
description: Add one or more original practice questions for a CCA task statement to the question bank. Use when someone says "add a question", "we need more questions for 2.2", or wants to grow the bank.
argument-hint: <task id, e.g. 2.2> [how many]
allowed-tools: Read, Edit, Grep, Bash
---
1. Delegate drafting to the `question-author` agent with the task id and count (default 3).
2. Review the result yourself: four options, one defensible answer, a reason per option, no real exam wording.
3. Run `cd app/backend && python -m unittest discover -s tests`.
4. Add a line to `PROGRESS.md` under Content with the new question count.
