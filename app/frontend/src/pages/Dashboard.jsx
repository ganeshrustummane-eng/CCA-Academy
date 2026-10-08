import React from "react";
import { api } from "../api.js";
import { Bar, EmptyState, Icon, Load, Pill, Skeleton, Tile, goto, useLoad } from "./ui.jsx";

export default function Dashboard() {
  const dash = useLoad(() => api.dashboard());
  const cur = useLoad(() => api.curriculum());

  return (
    <Load state={dash} lines={5}>{(d) => {
      const lvl = d.level;
      const span = lvl.next_at ? lvl.next_at - lvl.floor : 1;
      const domains = cur.data?.domains ?? [];
      const mastered = Object.values(d.tasks).filter((t) => t.mastered).length;
      const total = Object.keys(d.tasks).length;
      const passed = d.milestones.filter((m) => m.status === "passed").length;

      return (
        <div className="stack" style={{ gap: "var(--s4)" }}>
          <section className="card hero">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <Pill tone="accent">{lvl.name}</Pill>
                <h2 style={{ fontSize: "var(--t-3xl)", marginTop: "var(--s2)" }} className="tnum">{d.xp} XP</h2>
                <p className="note">
                  {lvl.next_at
                    ? `${lvl.next_at - d.xp} XP to ${lvl.next_name}`
                    : "Top level reached."}
                </p>
              </div>
              <div className="row">
                <button className="btn primary" onClick={() => goto("path")}>
                  <Icon name="path" /> Continue learning path
                </button>
                <button className="btn" onClick={() => goto("practice")}>
                  <Icon name="target" /> Practise
                </button>
                <button className="btn" onClick={() => goto("milestones")}>
                  <Icon name="clipboard" /> Milestones
                </button>
              </div>
            </div>
            {lvl.next_at ? (
              <div style={{ marginTop: "var(--s4)" }}>
                <div className="bar lg"><div style={{ width: `${Math.round(((d.xp - lvl.floor) / span) * 100)}%` }} /></div>
              </div>
            ) : null}
          </section>

          <div className="tiles">
            <Tile k="Readiness" v={`${d.readiness.overall}%`} sub="weighted across domains" />
            <Tile k="Tasks mastered" v={`${mastered}/${total}`} sub="every question answered right" />
            <Tile k="Milestones" v={`${passed}/${d.milestones.length}`} sub="passed at 70+" />
            <Tile k="Badges" v={d.badges.length} sub={d.certified_ready ? "Certified-Ready" : "keep going"} />
          </div>

          {!d.certified_ready ? (
            <div className="banner">
              <Icon name="flag" />
              <span>
                <b>Certified-Ready</b> needs 1200 XP and 80% readiness.
                You are at {d.xp} XP and {d.readiness.overall}%.
              </span>
            </div>
          ) : (
            <div className="banner" style={{ background: "var(--ok-soft)", color: "var(--ok)", borderColor: "var(--ok)" }}>
              <Icon name="check" /> <span><b>Certified-Ready.</b> 1200+ XP and 80%+ readiness.</span>
            </div>
          )}

          <div className="grid">
            <section className="card">
              <h2>Exam readiness by domain</h2>
              {cur.loading ? <Skeleton lines={5} /> : domains.map((dom) => (
                <Bar key={dom.id} value={d.readiness.domains[dom.id] ?? 0}
                  label={`${dom.id} ${dom.title} · ${dom.weight}%`} />
              ))}
            </section>

            <section className="card">
              <h2>Weakest tasks</h2>
              {d.weakest.length === 0 ? (
                <EmptyState icon="target" title="Nothing to fix yet"
                  action={<button className="btn primary" onClick={() => goto("practice")}>Start practising</button>}>
                  Answer a few questions and your weakest task statements will show up here.
                </EmptyState>
              ) : (
                <div className="stack" style={{ gap: "var(--s2)" }}>
                  {d.weakest.map((w) => (
                    <button key={w.task} className="btn block"
                      style={{ justifyContent: "space-between" }}
                      onClick={() => goto("practice", { task: w.task })}>
                      <span>Task {w.task}</span>
                      <span className="row" style={{ gap: "var(--s2)" }}>
                        <span className={`pill ${w.accuracy < 50 ? "bad" : "warn"}`}>{w.accuracy}%</span>
                        <Icon name="right" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {d.badges.length > 0 ? (
            <section className="card">
              <h2>Badges</h2>
              <div className="badges">
                {d.badges.map((b) => (
                  <span key={b.id} className="badge" title={b.desc}><Icon name="spark" /> {b.name}</span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card">
            <h2>Milestone projects</h2>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Project</th><th className="num">Week</th>
                    <th className="num">XP</th><th className="num">Best</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.milestones.map((m) => (
                    <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => goto("milestones", { id: m.id })}>
                      <td className="mono">{m.id}</td>
                      <td>{m.title}</td>
                      <td className="num">{m.week}</td>
                      <td className="num">{m.xp}</td>
                      <td className="num">{m.best ? Math.round(m.best) : "—"}</td>
                      <td className={`st-${m.status}`}>{m.status.replace("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
    }}</Load>
  );
}
