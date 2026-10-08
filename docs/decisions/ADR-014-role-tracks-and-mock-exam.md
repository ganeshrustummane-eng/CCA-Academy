# ADR-014: Role tracks gate question levels; mock exam is isolated from mastery

**Status:** Accepted

## Decision
Four role tracks (builder/senior/architect/director) are stored per user and resolved
server-side (`store.track`, `TRACK_LEVELS`) — never from a request parameter — to decide which
question *levels* `next_questions` serves. All tracks share the same 30 task statements, so
mastery is always measured against what that track can actually see.

The mock exam (`/api/exam/start`, `/api/exam/submit`, 60Q/90min/pass 700) draws from the same
question bank but tags its answers with `mode="exam"` in the `answers` table. Practice-mastery
queries filter that column out, so sitting the exam cannot inflate (or deflate) a learner's
tracked readiness.

## Consequences
+ One question bank serves both drilling and exam simulation with no duplication.
- A learner who never meets level-3 questions (e.g. Builder track) can still show 100% readiness;
  intentional, but worth calling out if readiness numbers are compared across tracks.
