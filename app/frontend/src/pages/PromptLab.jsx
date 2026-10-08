import React, { useState } from "react";
import { api } from "../api.js";
import { Bar, ErrorBox, Load, Pill, useLoad } from "./ui.jsx";

const TOOLS_PLACEHOLDER = `[
  {
    "name": "get_order_status",
    "description": "...",
    "parameters": { "type": "object", "properties": {} }
  }
]`;

export default function PromptLab({ params }) {
  const state = useLoad(() => api.labs());
  const [sel, setSel] = useState(params?.get("id") ?? "L1");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [toolsText, setToolsText] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    let tools;
    try {
      tools = toolsText.trim() ? JSON.parse(toolsText) : [];
    } catch {
      setErr(new Error("Tool definitions must be valid JSON (an array of tool objects)."));
      return;
    }
    setBusy(true); setResult(null);
    try { setResult(await api.labReview(sel, systemPrompt, tools)); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <Load state={state} lines={6}>{(data) => {
      const l = data.labs.find((x) => x.id === sel) ?? data.labs[0];
      return (
        <div className="split">
          <aside className="card">
            <h3>Exercises</h3>
            <div className="stack" style={{ gap: "var(--s1)" }}>
              {data.labs.map((x) => (
                <button key={x.id} className={`btn block${sel === x.id ? " primary" : " ghost"}`}
                  style={{ justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                  onClick={() => { setSel(x.id); setResult(null); }}>
                  <span className="mono">{x.id}</span> {x.title}
                </button>
              ))}
            </div>
          </aside>

          <section className="stack" style={{ gap: "var(--s4)" }}>
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2>{l.id} · {l.title}</h2>
                <Pill tone="accent">{l.xp} XP</Pill>
              </div>
              <p>{l.brief}</p>
              <p className="note">Covers tasks {l.tasks.join(", ")} · pass mark 70</p>
              <h4>Rubric</h4>
              <div>
                {l.rubric.map((c) => (
                  <div key={c.id} className="crit">
                    <div className="row" style={{ gap: "var(--s2)" }}>
                      <Pill tone="accent">{c.weight}%</Pill><b className="mono">{c.id}</b>
                    </div>
                    <div className="note" style={{ marginTop: "var(--s1)" }}>{c.check}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Submit for review</h3>
              <p className="note">
                Write a system prompt and the tool definitions it would use. An independent
                reviewer instance scores them against the rubric above. Never include API
                keys or secrets.
              </p>
              <div className="stack" style={{ gap: "var(--s3)", marginTop: "var(--s4)" }}>
                <label className="field">System prompt
                  <textarea rows={8} placeholder="You are an agent that..."
                    value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
                </label>
                <label className="field">Tool definitions (JSON array)
                  <textarea rows={10} className="mono" placeholder={TOOLS_PLACEHOLDER}
                    value={toolsText} onChange={(e) => setToolsText(e.target.value)} />
                </label>
              </div>
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
