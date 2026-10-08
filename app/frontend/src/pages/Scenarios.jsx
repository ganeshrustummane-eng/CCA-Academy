import React, { useState } from "react";
import { api } from "../api.js";
import { Bar, ErrorBox, Load, Pill, useLoad } from "./ui.jsx";

const LETTERS = ["A", "B", "C", "D"];

export default function Scenarios({ params }) {
  const state = useLoad(() => api.scenarios());
  const [sel, setSel] = useState(params?.get("id") ?? "SC1");
  const [choices, setChoices] = useState({});
  const [rationale, setRationale] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = (did, letter) => setChoices((c) => ({ ...c, [did]: letter }));

  const submit = async () => {
    setErr(null); setBusy(true); setResult(null);
    try { setResult(await api.scenarioReview(sel, choices, rationale)); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <Load state={state} lines={6}>{(data) => {
      const sc = data.scenarios.find((x) => x.id === sel) ?? data.scenarios[0];
      const resultById = Object.fromEntries((result?.decisions ?? []).map((d) => [d.id, d]));
      return (
        <div className="split">
          <aside className="card">
            <h3>Scenarios</h3>
            <div className="stack" style={{ gap: "var(--s1)" }}>
              {data.scenarios.map((x) => (
                <button key={x.id} className={`btn block${sel === x.id ? " primary" : " ghost"}`}
                  style={{ justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                  onClick={() => { setSel(x.id); setResult(null); setChoices({}); setRationale(""); }}>
                  <span className="mono">{x.id}</span> {x.title}
                </button>
              ))}
            </div>
          </aside>

          <section className="stack" style={{ gap: "var(--s4)" }}>
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2>{sc.id} · {sc.title}</h2>
                <Pill tone="accent">{sc.xp} XP</Pill>
              </div>
              <p>{sc.brief}</p>
            </div>

            {sc.decisions.map((d) => {
              const r = resultById[d.id];
              return (
                <div key={d.id} className="card">
                  <h4>{d.question}</h4>
                  <div className="options">
                    {LETTERS.filter((k) => d.options[k] !== undefined).map((k) => {
                      let cls = choices[d.id] === k ? "primary" : "ghost";
                      if (r) {
                        if (k === r.correct_answer) cls = "right";
                        else if (k === r.chosen) cls = "wrong";
                        else cls = "muted";
                      }
                      return (
                        <button key={k} className={`btn opt ${cls}`} disabled={!!result}
                          onClick={() => pick(d.id, k)}>
                          <span className="key">{k}</span>
                          <span>{d.options[k]}</span>
                        </button>
                      );
                    })}
                  </div>
                  {r ? (
                    <p className="note" style={{ marginTop: "var(--s2)" }}>
                      {r.is_correct ? "Correct" : `Best choice: ${r.correct_answer}`} · chosen option costs{" "}
                      <b>${r.cost.toLocaleString()}/mo</b>
                    </p>
                  ) : null}
                </div>
              );
            })}

            <div className="card">
              <h3>Rationale</h3>
              <p className="note">
                Explain why you made these choices, including cost and risk trade-offs. An
                independent reviewer scores the rationale against the rubric; the decisions
                themselves are graded automatically.
              </p>
              <textarea rows={6} style={{ marginTop: "var(--s3)" }}
                placeholder="We routed FAQ traffic to a small model because..."
                value={rationale} onChange={(e) => setRationale(e.target.value)} />
              <div className="row" style={{ marginTop: "var(--s3)" }}>
                <button className="btn primary" onClick={submit} disabled={busy}>
                  {busy ? "Reviewing..." : "Submit for review"}
                </button>
              </div>
              <ErrorBox error={err} />
            </div>

            {result ? (
              <div className="card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3>Review</h3>
                  <div className="row" style={{ gap: "var(--s2)" }}>
                    <Pill tone={result.passed ? "ok" : "bad"}>{result.passed ? "Passed" : "Not yet"}</Pill>
                    <Pill tone="accent">+{result.xp_gained} XP</Pill>
                  </div>
                </div>
                <div className="tiles" style={{ margin: "var(--s3) 0" }}>
                  <div className="tile"><div className="k">Score</div><div className="v tnum">{result.score}</div><div className="sub">pass mark 70</div></div>
                  <div className="tile"><div className="k">Decisions</div><div className="v tnum">{result.decision_score}%</div></div>
                  <div className="tile"><div className="k">Monthly cost</div><div className="v tnum">${result.monthly_cost.toLocaleString()}</div></div>
                </div>
                <p>{result.summary}</p>
                {result.criteria.map((c) => (
                  <div key={c.id} className="crit">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <b className="mono">{c.id}</b>
                      <span className="note tnum">{c.score}/100 · weight {c.weight}%</span>
                    </div>
                    <Bar value={c.score} tone={c.score >= 70 ? "ok" : c.score >= 40 ? "warn" : "bad"} label="" />
                    <div className="note">{c.evidence}</div>
                    {c.fix ? <div style={{ fontSize: "var(--t-sm)", marginTop: "var(--s1)" }}><b>Fix:</b> {c.fix}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      );
    }}</Load>
  );
}
