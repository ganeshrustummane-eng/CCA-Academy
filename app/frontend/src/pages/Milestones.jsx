import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, CopyButton, ErrorBox, Icon, Load, Pill, Rich, askAI, goto, useLoad } from "./ui.jsx";

const MAX_BYTES = 60_000;

/* Ticked steps are a personal checklist, so they live in localStorage, not the server. */
const stepsKey = (id) => `cca.steps.${id}`;
const loadSteps = (id) => { try { return JSON.parse(localStorage.getItem(stepsKey(id))) ?? []; } catch { return []; } };

export default function Milestones({ params }) {
  const state = useLoad(() => api.milestones());
  const dash = useLoad(() => api.dashboard());
  // Selection lives in the URL so the Ask AI panel knows which milestone you are on.
  const sel = params?.get("id") ?? "M1";
  const [done, setDone] = useState(() => loadSteps(sel));
  const [solution, setSolution] = useState(null);
  const [solBusy, setSolBusy] = useState(false);
  const [solErr, setSolErr] = useState(null);
  const [files, setFiles] = useState([{ name: "", body: "" }]);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDone(loadSteps(sel)); setResult(null); setSolution(null); setSolErr(null); }, [sel]);

  const toggleStep = (i) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try { localStorage.setItem(stepsKey(sel), JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  const reveal = async (seen) => {
    if (!seen && !window.confirm("Compare with a reference solution? Best after one honest attempt. You can still submit and be scored, but this milestone earns no more XP.")) return;
    setSolBusy(true); setSolErr(null);
    try { setSolution(await api.solution(sel)); dash.reload(); } catch (e) { setSolErr(e); } finally { setSolBusy(false); }
  };

  const upd = (i, k, v) => setFiles(files.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const drop = (i) => setFiles(files.length > 1 ? files.filter((_, j) => j !== i) : [{ name: "", body: "" }]);

  const onPick = async (e) => {
    const picked = await Promise.all([...e.target.files].map(async (f) => ({
      name: f.name, body: (await f.text()).slice(0, MAX_BYTES),
    })));
    setFiles([...files.filter((f) => f.name || f.body), ...picked]);
    e.target.value = "";
  };

  const submit = async () => {
    setBusy(true); setErr(null); setResult(null);
    const payload = {};
    files.filter((f) => f.body.trim()).forEach((f, i) => { payload[f.name.trim() || `file${i + 1}.txt`] = f.body; });
    try { setResult(await api.review(sel, payload)); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <Load state={state} lines={6}>{(data) => {
      const m = data.milestones.find((x) => x.id === sel) ?? data.milestones[0];
      const seen = dash.data?.milestones?.find((x) => x.id === m.id)?.solution_seen;
      return (
        <div className="split">
          <aside className="card">
            <h3>Projects</h3>
            <div className="stack" style={{ gap: "var(--s1)" }}>
              {data.milestones.map((x) => (
                <button key={x.id} className={`btn block${sel === x.id ? " primary" : " ghost"}`}
                  style={{ justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                  onClick={() => goto("milestones", { id: x.id })}>
                  <span className="mono">{x.id}</span> {x.title}
                </button>
              ))}
            </div>
          </aside>

          <section className="stack" style={{ gap: "var(--s4)" }}>
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2>{m.id} · {m.title}</h2>
                <div className="row" style={{ gap: "var(--s2)" }}>
                  <Pill>week {m.week}</Pill><Pill tone="accent">{m.xp} XP</Pill>
                </div>
              </div>
              <p>{m.brief}</p>
              <p className="note">Covers tasks {m.tasks.join(", ")} · pass mark 70</p>
              <h4>Deliverables</h4>
              <ul>{m.deliverables.map((d) => <li key={d} className="mono" style={{ fontSize: "var(--t-sm)" }}>{d}</li>)}</ul>
              {m.stretch ? <p className="note"><b>Stretch:</b> {m.stretch}</p> : null}
              {m.steps?.length ? (
                <>
                  <div className="row" style={{ justifyContent: "space-between", marginTop: "var(--s4)" }}>
                    <h4 style={{ margin: 0 }}>Step-by-step plan</h4>
                    <span className="note tnum">{done.filter((i) => i < m.steps.length).length}/{m.steps.length} done</span>
                  </div>
                  <ol className="steps">
                    {m.steps.map((s, i) => (
                      <li key={s} className={done.includes(i) ? "done" : undefined}>
                        <label className="row" style={{ gap: "var(--s2)", alignItems: "flex-start", flexWrap: "nowrap" }}>
                          <input type="checkbox" checked={done.includes(i)} onChange={() => toggleStep(i)} />
                          <span className="grow">{s}</span>
                        </label>
                        <button className="btn ghost sm" title="Ask AI to explain this step with example code"
                          onClick={() => askAI(`Help me with step ${i + 1} of ${m.id}: "${s}". Explain what to do and show example code.`, m.id)}>
                          <Icon name="spark" /> Ask AI
                        </button>
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
              {m.guide ? (
                <details>
                  <summary><b>Need a nudge? Approach guide</b></summary>
                  <p className="note" style={{ marginTop: "var(--s2)" }}>{m.guide}</p>
                </details>
              ) : null}
              <h4>Rubric</h4>
              <div>
                {m.rubric.map((c) => (
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
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Reference solution</h3>
                {seen ? <Pill tone="warn">viewed · no XP for {m.id}</Pill> : null}
              </div>
              <p className="note">
                Submit one honest attempt, then compare it with the reference. Spotting the gap between
                your version and a worked one is where most of the learning happens. The AI writes a fresh,
                original solution that meets this rubric, with a walkthrough. XP you already earned stays;
                later submissions are still scored but earn no more XP.
              </p>
              <div className="row" style={{ marginTop: "var(--s3)" }}>
                <button className="btn" onClick={() => reveal(seen)} disabled={solBusy}>
                  <Icon name="spark" /> {solBusy ? "Writing solution..." : solution ? "Generate another" : "Show reference solution"}
                </button>
              </div>
              <ErrorBox error={solErr} />
              {solution ? (
                <div className="stack" style={{ gap: "var(--s3)", marginTop: "var(--s4)" }}>
                  {solution.walkthrough ? <div className="msg"><span className="who">Walkthrough</span><Rich text={solution.walkthrough} /></div> : null}
                  {solution.files.map((f) => (
                    <div key={f.name} className="filebox">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <b className="mono">{f.name}</b>
                        <CopyButton text={f.body} />
                      </div>
                      <pre className="code">{f.body}</pre>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="card">
              <h3>Submit for review</h3>
              <p className="note">
                Build it locally, then paste or upload your files. An independent reviewer instance
                scores them against the rubric above. Never include API keys or secrets.
              </p>
              <div className="stack" style={{ gap: "var(--s3)", marginTop: "var(--s4)" }}>
                {files.map((f, i) => (
                  <div key={i} className="filebox">
                    <div className="row" style={{ gap: "var(--s2)" }}>
                      <input style={{ flex: 1 }} placeholder="filename, e.g. loop.py"
                        value={f.name} onChange={(e) => upd(i, "name", e.target.value)} />
                      <button className="btn ghost sm" onClick={() => drop(i)} aria-label="Remove file">
                        <Icon name="x" />
                      </button>
                    </div>
                    <textarea rows={8} placeholder="paste file contents"
                      value={f.body} onChange={(e) => upd(i, "body", e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: "var(--s3)" }}>
                <button className="btn" onClick={() => setFiles([...files, { name: "", body: "" }])}>Add file</button>
                <label className="btn upload">
                  <Icon name="download" /> Upload
                  <input type="file" multiple onChange={onPick} className="sr" />
                </label>
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
                    <Pill tone={result.passed ? "ok" : "bad"}>
                      <Icon name={result.passed ? "check" : "x"} /> {result.passed ? "Passed" : "Not yet"}
                    </Pill>
                    <Pill tone="accent">+{result.xp_gained} XP</Pill>
                    {result.solution_seen ? <Pill tone="warn">no XP: solution viewed</Pill> : null}
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
