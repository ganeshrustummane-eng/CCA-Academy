import React from "react";
import { api } from "../api.js";
import { Icon, Load, Pill, askAI, goto, useLoad } from "./ui.jsx";

/* The structured route through the course: one milestone per stop, ordered by week.
   Each stop is learn the tasks -> practise them -> build -> get reviewed. Everything
   here is derived from content + dashboard, so it needs no state of its own. */
export default function Path() {
  const ms = useLoad(() => api.milestones());
  const dash = useLoad(() => api.dashboard());
  const cur = useLoad(() => api.curriculum());

  return (
    <Load state={ms} lines={6}>{(data) => {
      const stats = dash.data?.tasks ?? {};
      const status = Object.fromEntries((dash.data?.milestones ?? []).map((m) => [m.id, m]));
      const title = Object.fromEntries((cur.data?.domains ?? []).flatMap((d) => d.tasks.map((t) => [t.id, t.title])));
      const stops = [...data.milestones].sort((a, b) => a.week - b.week);
      const current = stops.find((m) => status[m.id]?.status !== "passed")?.id;

      return (
        <div className="stack" style={{ gap: "var(--s4)" }}>
          <section className="card stop">
            <div className="row" style={{ gap: "var(--s2)" }}>
              <span className="stepnum">0</span>
              <b>Start here · the basics</b>
            </div>
            <p className="note">
              New to LLM APIs? Read the {cur.data?.glossary?.length ?? ""} key terms first: tool_use, stop_reason,
              subagents, hooks, MCP. Each task in Curriculum also has a worked example you can read without an API key.
            </p>
            <button className="btn sm" onClick={() => goto("learn")}><Icon name="book" /> Read the basics</button>
          </section>
          {stops.map((m, n) => {
            const st = status[m.id];
            const done = st?.status === "passed";
            const mastered = m.tasks.filter((t) => stats[t]?.mastered).length;
            const nextTask = m.tasks.find((t) => !stats[t]?.mastered) ?? m.tasks[0];
            return (
              <details key={m.id} className={`card stop${m.id === current ? " current" : ""}`} open={m.id === current}>
                <summary className="row" style={{ justifyContent: "space-between" }}>
                  <span className="row" style={{ gap: "var(--s2)" }}>
                    <span className={`stepnum${done ? " ok" : ""}`}>{done ? <Icon name="check" /> : n + 1}</span>
                    <b>Week {m.week} · {m.id} {m.title}</b>
                  </span>
                  <span className="row" style={{ gap: "var(--s2)" }}>
                    {m.id === current ? <Pill tone="accent">you are here</Pill> : null}
                    <Pill tone={done ? "ok" : st?.status === "in_progress" ? "warn" : undefined}>
                      {done ? "passed" : st?.status === "in_progress" ? "in progress" : "to do"}
                    </Pill>
                  </span>
                </summary>
                <p className="note">{m.brief}</p>
                <ol className="steps">
                  <li>
                    <b>Learn the concepts.</b> Read each task: what is tested and the exam traps.
                    <div className="row" style={{ gap: "var(--s1)", marginTop: "var(--s1)" }}>
                      {m.tasks.map((t) => (
                        <button key={t} className="btn sm" onClick={() => goto("learn", { task: t })} title={title[t]}>
                          {stats[t]?.mastered ? <Icon name="check" /> : null} {t} {title[t] ?? ""}
                        </button>
                      ))}
                    </div>
                  </li>
                  <li>
                    <b>Practise until mastered.</b> {mastered}/{m.tasks.length} tasks mastered.
                    <div className="row" style={{ gap: "var(--s1)", marginTop: "var(--s1)" }}>
                      <button className="btn sm" onClick={() => goto("practice", { task: nextTask })}>
                        <Icon name="target" /> Practise {nextTask}
                      </button>
                      <button className="btn sm" onClick={() => askAI(`Teach me task ${nextTask} with a short worked example and code.`, nextTask)}>
                        <Icon name="spark" /> Explain {nextTask} with AI
                      </button>
                    </div>
                  </li>
                  <li>
                    <b>Build the milestone.</b> Follow its step-by-step plan ({m.steps?.length ?? 0} steps).
                    <div style={{ marginTop: "var(--s1)" }}>
                      <button className="btn sm primary" onClick={() => goto("milestones", { id: m.id })}>
                        <Icon name="clipboard" /> Open {m.id}
                      </button>
                    </div>
                  </li>
                  <li>
                    <b>Submit for review.</b> Score 70 or more to pass and earn up to {m.xp} XP.
                    {st?.best ? <span className="note"> Best so far: {Math.round(st.best)}.</span> : null}
                  </li>
                </ol>
              </details>
            );
          })}

          <section className="card stop">
            <div className="row" style={{ gap: "var(--s2)" }}>
              <span className="stepnum">{stops.length + 1}</span>
              <b>Final check · timed mock exam</b>
            </div>
            <p className="note">
              60 questions, 90 minutes, pass mark 700/1000. Certified-Ready needs 1200 XP and 80% readiness.
            </p>
            <button className="btn sm primary" onClick={() => goto("exam")}><Icon name="timer" /> Take the mock exam</button>
          </section>
        </div>
      );
    }}</Load>
  );
}
