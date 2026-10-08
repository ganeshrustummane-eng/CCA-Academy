import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { ErrorBox, Icon, Rich, Skeleton } from "./ui.jsx";

const QUICK = [
  "Explain this step by step with example code.",
  "I'm stuck. What should I do next?",
  "What is the most common mistake here?",
];

/* Floating "Ask AI" panel on every page. Context comes from the URL (task/id/domain)
   or from an explicit askAI(prompt, ref) call; the server resolves it to grounding. */
export default function AskAI({ route, params }) {
  const urlRef = params.get("task") || params.get("id") || params.get("domain") || "";
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState(urlRef);
  const [history, setHistory] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const logRef = useRef(null);

  useEffect(() => { setRef(urlRef); }, [urlRef]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [history, busy]);

  const send = async (message, at = ref) => {
    message = message.trim();
    if (!message || busy) return;
    setBusy(true); setError(null); setText("");
    const next = [...history, { role: "user", content: message }];
    setHistory(next);
    try {
      const r = await api.ask(message, at, route, history);
      setHistory([...next, { role: "assistant", content: r.reply }]);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  // Latest send/state via a ref so the listener is registered once.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const on = (e) => {
      const at = e.detail?.ref ?? urlRef;
      setOpen(true); setRef(at);
      if (e.detail?.prompt) sendRef.current(e.detail.prompt, at);
    };
    window.addEventListener("cca-ask", on);
    return () => window.removeEventListener("cca-ask", on);
  }, [urlRef]);

  if (!open) {
    return (
      <button className="btn primary fab" onClick={() => setOpen(true)} title="Stuck? Ask AI">
        <Icon name="spark" /> Ask AI
      </button>
    );
  }

  return (
    <aside className="askpanel card" aria-label="Ask AI">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}><Icon name="spark" /> Ask AI</h3>
        <div className="row" style={{ gap: "var(--s1)" }}>
          <button className="btn ghost sm" onClick={() => setHistory([])} disabled={!history.length}>Clear</button>
          <button className="btn ghost sm" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" /></button>
        </div>
      </div>
      <p className="note">
        {ref ? <>Context: <b className="mono">{ref}</b> on {route}</> : <>Context: {route} page</>}
      </p>

      <div className="chat" ref={logRef}>
        {history.length === 0 && !busy ? (
          <div className="stack" style={{ gap: "var(--s2)" }}>
            <p className="note">Stuck anywhere? Ask in your own words, or start with one of these:</p>
            {QUICK.map((q) => <button key={q} className="btn sm" onClick={() => send(q)}>{q}</button>)}
          </div>
        ) : null}
        {history.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <span className="who">{m.role === "user" ? "You" : "AI"}</span>
            {m.role === "user" ? <pre>{m.content}</pre> : <Rich text={m.content} />}
          </div>
        ))}
        {busy ? <div className="msg"><span className="who">AI</span><Skeleton lines={2} /></div> : null}
      </div>

      <ErrorBox error={error} />
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(text); }}
        placeholder="Ask anything. Ctrl+Enter to send" />
      <div className="row end">
        <button className="btn primary" onClick={() => send(text)} disabled={busy || !text.trim()}>
          {busy ? "Thinking..." : "Send"}
        </button>
      </div>
    </aside>
  );
}
