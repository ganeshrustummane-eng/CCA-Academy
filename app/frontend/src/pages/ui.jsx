import React, { useEffect, useState } from "react";

/* ----------------------------------------------------------- hash router ----
   Lives here rather than in App.jsx so pages can navigate without importing App
   (which imports them back). The backend serves dist/ with StaticFiles at "/",
   so history routing would need a catch-all rewrite; hash routing needs nothing
   and still gives deep links, refresh-in-place and the back button. */
export const goto = (route, params) => {
  const q = params ? `?${new URLSearchParams(params)}` : "";
  window.location.hash = `${route}${q}`;
};

export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, "");
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const on = () => { setHash(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const [path, qs] = hash.split("?");
  return { route: path || "dashboard", params: new URLSearchParams(qs || "") };
}

/* ---------------------------------------------------------------- icons ----
   Inline stroke paths at 24x24. A dependency for ~20 path strings is not worth
   the install, and these inherit currentColor so they theme for free. */
const PATHS = {
  gauge: ["M3.5 18a9 9 0 1 1 17 0", "M12 14l4-4"],
  book: ["M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z", "M4 19a2 2 0 0 0 2 2h13"],
  target: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z", "M12 11.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"],
  timer: ["M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M12 9v4l2.5 2.5", "M9 2h6"],
  flask: ["M9 3v6l-5 9a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3l-5-9V3", "M8 3h8", "M6.6 15h10.8"],
  workflow: ["M4 4h6v6H4z", "M14 14h6v6h-6z", "M10 7h3a1 1 0 0 1 1 1v6"],
  scale: ["M12 3v3", "M5 7h14", "M5 7l-3 7h6z", "M19 7l-3 7h6z", "M9 20h6"],
  clipboard: ["M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2", "M9 3h6v3H9z", "m9 14 2 2 4-4"],
  message: ["M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"],
  trophy: ["M7 4h10v5a5 5 0 0 1-10 0z", "M7 6H5a2 2 0 0 0 0 4h2", "M17 6h2a2 2 0 0 1 0 4h-2", "M10 20h4", "M12 14v6"],
  sliders: ["M4 7h7", "M15 7h5", "M4 17h3", "M11 17h9", "M13 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", "M9 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"],
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2", "M12 20v2", "M2 12h2", "M20 12h2", "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M19.1 4.9l-1.4 1.4", "M6.3 17.7l-1.4 1.4"],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
  right: ["m9 18 6-6-6-6"],
  left: ["m15 18-6-6 6-6"],
  down: ["m6 9 6 6 6-6"],
  check: ["m5 13 4 4L19 7"],
  x: ["M6 6l12 12", "M18 6 6 18"],
  alert: ["M12 3 2 20h20z", "M12 9v5", "M12 17.5h.01"],
  copy: ["M9 9h10v12H9z", "M15 5H5v10"],
  play: ["m7 4 12 8-12 8z"],
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  flag: ["M5 21V4h13l-2 4 2 4H5"],
  download: ["M12 3v12", "m7 11 5 5 5-5", "M4 21h16"],
  path: ["M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7", "M12 17h.01"],
  inbox: ["M4 13h4l2 3h4l2-3h4", "M4 13 6.5 5h11L20 13v6H4z"],
};

export function Icon({ name, size = 16, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}

/* ------------------------------------------------------------ primitives ---- */
export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <Icon name="alert" /> <span>{String(error.message ?? error)}</span>
    </div>
  );
}

export function Bar({ value, max = 100, label, tone }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="barrow">
      <span className="barlabel" title={label}>{label}</span>
      <div className="bar">
        <div style={{ width: `${pct}%`, background: tone ? `var(--${tone})` : undefined }} />
      </div>
      <span className="barval">{pct}%</span>
    </div>
  );
}

export function Tile({ k, v, sub }) {
  return (
    <div className="tile">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function Pill({ tone, children }) {
  return <span className={`pill${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function Skeleton({ lines = 3 }) {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <span className="sr">Loading</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - i * 12}%`, height: i === 0 ? 20 : 14 }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={32} />
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function CopyButton({ text, label = "Copy", className = "btn sm" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <button className={className} onClick={copy}>
      <Icon name={done ? "check" : "copy"} /> {done ? "Copied" : label}
    </button>
  );
}

export function DownloadButton({ text, filename, label = "Export", className = "btn sm" }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/x-python" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button className={className} onClick={download}>
      <Icon name="download" /> {label}
    </button>
  );
}

/* Turns one playground trace into a runnable-ish Anthropic SDK script, so a learner
   can see the same tool loop they just watched expressed as real client code. */
export function tracesToPython(system, tools, message, trace) {
  const py = (v) => JSON.stringify(v, null, 4).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
  const lines = [
    "from anthropic import Anthropic",
    "",
    "client = Anthropic()",
    `SYSTEM = ${JSON.stringify(system)}`,
    `TOOLS = ${py(tools)}`,
    "",
    `messages = [{"role": "user", "content": ${JSON.stringify(message)}}]`,
    "",
    "# Loop on stop_reason, not on the presence of text — a model can emit both",
    "# commentary and a tool call in the same turn.",
    "while True:",
    "    resp = client.messages.create(model=\"claude-opus-4-6\", system=SYSTEM, messages=messages,",
    "                                   tools=TOOLS, max_tokens=700)",
    "    messages.append({\"role\": \"assistant\", \"content\": resp.content})",
    "    if resp.stop_reason != \"tool_use\":",
    "        break",
    "    tool_results = []",
    "    for block in resp.content:",
    "        if block.type != \"tool_use\":",
    "            continue",
    "        result = run_tool(block.name, block.input)  # your own dispatch, as traced below",
    "        tool_results.append({\"type\": \"tool_result\", \"tool_use_id\": block.id, \"content\": str(result)})",
    "    messages.append({\"role\": \"user\", \"content\": tool_results})",
    "",
    "# --- this run's actual trace, for reference ---",
  ];
  for (const t of trace) {
    if (t.type === "model") {
      lines.push(`# turn ${t.turn}: stop_reason=${t.stop_reason}${t.text ? `, text=${JSON.stringify(t.text)}` : ""}`);
    } else if (t.type === "tool") {
      lines.push(`#   run_tool(${JSON.stringify(t.name)}, ${JSON.stringify(t.arguments)}) -> ${JSON.stringify(t.result)}`);
    } else {
      lines.push(`#   [${t.type}] ${t.text}`);
    }
  }
  return lines.join("\n") + "\n";
}

/* AI replies: ``` fenced blocks render as code, everything else as wrapped text. */
export function Rich({ text }) {
  return String(text).split(/```[\w-]*\n?/).map((part, i) =>
    i % 2 ? <pre key={i} className="code">{part.replace(/\n$/, "")}</pre> : <pre key={i}>{part}</pre>);
}

/* Opens the global Ask AI panel from anywhere. `ref` is a task, milestone, lab,
   scenario, domain or question id; the server turns it into grounding. */
export const askAI = (prompt, ref) =>
  window.dispatchEvent(new CustomEvent("cca-ask", { detail: { prompt, ref } }));

/* Small data-loading hook: { data, error, loading, reload } */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error) => live && setState({ data: null, error, loading: false }),
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

/* Renders the loading/error/ready states of a useLoad result so pages stop
   repeating `if (loading) return <p>Loading...</p>`. */
export function Load({ state, lines, children }) {
  if (state.loading) return <div className="card"><Skeleton lines={lines} /></div>;
  if (state.error) return <ErrorBox error={state.error} />;
  return children(state.data);
}
