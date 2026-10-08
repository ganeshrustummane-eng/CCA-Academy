import React, { useState } from "react";
import { api } from "../api.js";
import { Icon, Load, Pill, askAI, goto, useLoad } from "./ui.jsx";

export default function Learn({ params }) {
  const cur = useLoad(() => api.curriculum());
  const dash = useLoad(() => api.dashboard());
  const [open, setOpen] = useState(params?.get("task") ?? null);

  return (
    <Load state={cur} lines={6}>{(data) => (
      <div className="stack" style={{ gap: "var(--s4)" }}>
        {data.glossary?.length ? (
          <details className="card" open={!dash.data?.tasks || !Object.values(dash.data.tasks).some((s) => s.attempts)}>
            <summary><h2 style={{ display: "inline" }}>Start here · the basics</h2></summary>
            <p className="note">New to LLM APIs? These are the words every task below uses.</p>
            <dl className="glossary">
              {data.glossary.map((g) => (
                <div key={g.term}><dt><b>{g.term}</b></dt><dd className="note">{g.means}</dd></div>
              ))}
            </dl>
          </details>
        ) : null}
        {data.domains.map((dom) => (
          <section key={dom.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{dom.id} · {dom.title}</h2>
              <Pill>{dom.weight}% of exam</Pill>
            </div>
            {dom.tasks.map((t) => {
              const stat = dash.data?.tasks?.[t.id];
              const isOpen = open === t.id;
              return (
                <div key={t.id} className="task">
                  <button className="btn link taskhead" onClick={() => setOpen(isOpen ? null : t.id)}
                    aria-expanded={isOpen}>
                    <Icon name={isOpen ? "down" : "right"} />
                    <span className="grow">
                      <span className="mono note">{t.id}</span> {t.title}
                    </span>
                    {stat?.mastered ? <Pill tone="ok"><Icon name="check" /> mastered</Pill>
                      : stat?.attempts ? <Pill tone="warn">{Math.round((stat.correct / stat.attempts) * 100)}%</Pill>
                        : <Pill>{t.lab}</Pill>}
                  </button>
                  {isOpen && (
                    <div className="taskbody">
                      <p>{t.summary}</p>
                      {t.example ? (
                        <div>
                          <h4>Worked example</h4>
                          <p className="note">{t.example.why}</p>
                          <pre className="code">{t.example.code}</pre>
                        </div>
                      ) : null}
                      <div>
                        <h4>What is tested</h4>
                        <ul className="rules">{t.rules.map((r) => <li key={r}>{r}</li>)}</ul>
                      </div>
                      <div>
                        <h4>Exam traps</h4>
                        <ul className="traps">{t.traps.map((r) => <li key={r}>{r}</li>)}</ul>
                      </div>
                      <div className="row">
                        <button className="btn primary sm" onClick={() => goto("practice", { task: t.id })}>
                          <Icon name="target" /> Practise this task
                        </button>
                        <button className="btn sm" onClick={() => askAI(`Explain task ${t.id} "${t.title}" step by step with a worked example and code.`, t.id)}>
                          <Icon name="spark" /> Explain with AI
                        </button>
                        <button className="btn sm" onClick={() => goto("tutor", { domain: dom.id })}>
                          <Icon name="message" /> Ask the tutor
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    )}</Load>
  );
}
