import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { DownloadButton, EmptyState, ErrorBox, Icon, Pill, Skeleton, tracesToPython, useLoad } from "./ui.jsx";

export function Tutor({ params }) {
  const cur = useLoad(() => api.curriculum());
  const [domain, setDomain] = useState(params?.get("domain") ?? "D1");
  const [history, setHistory] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [history, busy]);

  const send = async (override) => {
    const message = (override ?? text).trim();
    if (!message || busy) return;
    setBusy(true); setError(null); setText("");
    const next = [...history, { role: "user", content: message }];
    setHistory(next);
    try {
      const r = await api.tutor(domain, message, history);
      setHistory([...next, { role: "assistant", content: r.reply }]);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const domains = cur.data?.domains ?? [];
  const here = domains.find((d) => d.id === domain);

  return (
    <div className="stack" style={{ gap: "var(--s4)" }}>
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <label className="field" style={{ minWidth: 280 }}>Domain
            <select value={domain} onChange={(e) => { setDomain(e.target.value); setHistory([]); }}>
              {(domains.length ? domains : [{ id: "D1", title: "" }]).map((d) => (
                <option key={d.id} value={d.id}>{d.id} {d.title}</option>
              ))}
            </select>
          </label>
          <div className="row">
            {here ? <Pill>{here.tasks.length} task statements</Pill> : null}
            <button className="btn" onClick={() => setHistory([])} disabled={!history.length}>Clear</button>
            <button className="btn primary" disabled={busy}
              onClick={() => send("Teach me this domain step by step. Start with the first task statement, then ask me a check question.")}>
              <Icon name="spark" /> Start lesson
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="chat" ref={logRef}>
          {history.length === 0 && !busy ? (
            <EmptyState icon="message" title="Ask anything about this domain">
              The tutor is grounded in this domain's task statements only, so it will not wander.
              Press Start lesson to be walked through it.
            </EmptyState>
          ) : null}
          {history.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <span className="who">{m.role === "user" ? "You" : "Tutor"}</span>
              <pre>{m.content}</pre>
            </div>
          ))}
          {busy ? <div className="msg"><span className="who">Tutor</span><Skeleton lines={2} /></div> : null}
        </div>
      </section>

      <ErrorBox error={error} />

      <section className="card">
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
          placeholder="Type your answer or question — Ctrl+Enter to send" />
        <div className="row end" style={{ marginTop: "var(--s2)" }}>
          <span className="note">Ctrl+Enter to send</span>
          <button className="btn primary" onClick={() => send()} disabled={busy || !text.trim()}>
            {busy ? "Thinking..." : "Send"}
          </button>
        </div>
      </section>
    </div>
  );
}

const TRACE_LABEL = {
  model: "Model", tool: "Tool", gate: "Gate blocked",
  hook: "Pre-tool hook", normalise: "Post-tool hook", bug: "Anti-pattern fired",
};

export function Playground() {
  const toolsState = useLoad(() => api.playgroundTools());
  const [opts, setOpts] = useState({ loop_mode: "correct", gate: true, hook: true, normalise: true });
  const [message, setMessage] = useState("I'd like a refund of $750 for order O2. My customer id is C100, email jane@example.com.");
  const [out, setOut] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (demo) => {
    setBusy(true); setError(null); setOut(null);
    try {
      const r = await api.playground({ ...opts, message, demo });
      setOut(r); setStep(r.trace.length - 1);
    }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  const toggle = (k) => (e) => setOpts({ ...opts, [k]: e.target.checked });
  const guardsOff = !opts.gate || !opts.hook || opts.loop_mode !== "correct";

  return (
    <div className="stack" style={{ gap: "var(--s4)" }}>
      <section className="card">
        <h2>Customer support agent</h2>
        <p className="note">
          Three tools, a $500 refund limit and a verify-before-refund prerequisite.
          Turn the guards off and watch the same request succeed when it should not.
        </p>
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
          style={{ marginTop: "var(--s4)" }} />

        <div className="stack" style={{ gap: "var(--s3)", marginTop: "var(--s4)" }}>
          <label className="field" style={{ maxWidth: 420 }}>Loop termination
            <select value={opts.loop_mode} onChange={(e) => setOpts({ ...opts, loop_mode: e.target.value })}>
              <option value="correct">Correct — stop on the end_turn signal</option>
              <option value="text_check">Anti-pattern — stop as soon as text is present</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={opts.gate} onChange={toggle("gate")} />
            Prerequisite gate — verify ownership before any refund</label>
          <label className="check"><input type="checkbox" checked={opts.hook} onChange={toggle("hook")} />
            Pre-tool hook — block refunds over $500 and escalate</label>
          <label className="check"><input type="checkbox" checked={opts.normalise} onChange={toggle("normalise")} />
            Post-tool hook — normalise timestamps and status codes</label>
        </div>

        {guardsOff ? (
          <div className="banner" style={{ marginTop: "var(--s4)" }}>
            <Icon name="alert" /> <span>A guard is off. This run is expected to misbehave — that is the lesson.</span>
          </div>
        ) : null}

        <div className="row" style={{ marginTop: "var(--s4)" }}>
          <button className="btn primary" onClick={() => run(true)} disabled={busy}>
            <Icon name="play" /> Run offline demo
          </button>
          <button className="btn" onClick={() => run(false)} disabled={busy}>
            <Icon name="spark" /> Run with live model
          </button>
          <span className="note">The offline demo needs no API key.</span>
        </div>
      </section>

      {toolsState.data ? (
        <details className="card">
          <summary><b>Tools available to the agent</b></summary>
          <div className="stack" style={{ gap: "var(--s2)", marginTop: "var(--s3)" }}>
            {toolsState.data.tools.map((t) => (
              <div key={t.name}><code>{t.name}</code> <span className="note">{t.description}</span></div>
            ))}
          </div>
        </details>
      ) : null}

      <ErrorBox error={error} />
      {busy ? <section className="card"><Skeleton lines={5} /></section> : null}

      {out ? (
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>Trace</h3>
            <div className="row" style={{ gap: "var(--s2)" }}>
              <Pill tone={out.stopped_by === "end_turn" ? "ok" : "warn"}>stopped by {out.stopped_by}</Pill>
              <Pill tone={out.refunds.length ? "bad" : "ok"}>
                {out.refunds.length} refund{out.refunds.length === 1 ? "" : "s"} executed
              </Pill>
              <DownloadButton filename="agent_run.py" label="Export as Python"
                text={tracesToPython(toolsState.data?.system ?? "", toolsState.data?.tools ?? [], message, out.trace)} />
            </div>
          </div>
          {out.final ? <p style={{ marginTop: "var(--s3)" }}><b>Final reply:</b> {out.final}</p> : null}

          <div className="row" style={{ marginTop: "var(--s4)", gap: "var(--s2)" }}>
            <button className="btn sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step <= 0}>
              <Icon name="left" /> Prev
            </button>
            <input type="range" min={0} max={out.trace.length - 1} value={step}
              onChange={(e) => setStep(Number(e.target.value))} style={{ flex: 1 }} />
            <button className="btn sm" onClick={() => setStep((s) => Math.min(out.trace.length - 1, s + 1))}
              disabled={step >= out.trace.length - 1}>
              Next <Icon name="right" />
            </button>
            <span className="note">step {step + 1}/{out.trace.length}</span>
          </div>

          <ol className="trace" style={{ marginTop: "var(--s4)" }}>
            {out.trace.slice(0, step + 1).map((t, i) => (
              <li key={i} className={`t-${t.type}`} style={i === step ? { outline: "2px solid var(--accent)", borderRadius: 8 } : undefined}>
                <span className="dot" />
                <div className="lbl">{TRACE_LABEL[t.type] ?? t.type}</div>
                <div className="body">
                  {t.type === "model" ? (
                    <>turn {t.turn} · stop_reason <code>{t.stop_reason}</code>
                      {t.text ? <> · “{t.text}”</> : null}
                      {t.tool_calls?.length ? <> · calls <code>{t.tool_calls.map((c) => c.name).join(", ")}</code></> : null}</>
                  ) : t.type === "tool" ? (
                    <><code>{t.name}({JSON.stringify(t.arguments)})</code>
                      <div className="note mono" style={{ marginTop: 2 }}>→ {JSON.stringify(t.result)}</div></>
                  ) : t.text}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
