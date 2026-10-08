---
name: review-milestone
description: Get an independent rubric review of a milestone project (M1-M8). Use when a learner finishes a project and wants feedback outside the web app.
argument-hint: <milestone id> <path to the learner's project folder>
context: fork
allowed-tools: Read, Grep, Glob
---
Runs in a forked context so the reviewer has no memory of how the work was produced.
1. Launch the `milestone-reviewer` agent with the milestone id and project path.
2. Return only its scored table and the three highest-impact fixes.
3. Tell the learner to submit the corrected files in the app to record XP.
