import React, { useState } from "react";
import { TRACKS, api, settings, theme as themeStore } from "../api.js";
import { ErrorBox, Icon, Pill } from "./ui.jsx";

/* One form, two entry points: this page and Onboard. */
export function AccountForm({ cfg, onSave, submitLabel = "Save" }) {
  const [s, setS] = useState(cfg);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = async () => {
    setError(null); setBusy(true);
    try {
      settings.save(s);
      await api.upsertUser(s.name, s.squad, s.track);
      onSave(s);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const test = async () => {
    setError(null); setMsg("Testing..."); setBusy(true);
    try {
      settings.save(s);
      const r = await api.testLlm();
      setMsg(`Connected. The model replied: ${r.reply}`);
    } catch (e) { setMsg(""); setError(e); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: "var(--s4)" }}>
      <section className="card">
        <h2>You</h2>
        <div className="form">
          <label className="field">Your name
            <input value={s.name} onChange={up("name")} placeholder="e.g. Ganesh R" />
          </label>
          <label className="field">Squad (optional)
            <input value={s.squad} onChange={up("squad")} placeholder="e.g. Red Team" />
          </label>
          <div className="field">
            Role track
            <div className="stack" style={{ gap: "var(--s2)", marginTop: "var(--s1)" }}>
              {TRACKS.map((t) => (
                <label key={t.id} className="check" style={{ alignItems: "flex-start" }}>
                  <input type="radio" name="track" value={t.id}
                    checked={s.track === t.id} onChange={up("track")} style={{ marginTop: 3 }} />
                  <span>
                    <b style={{ color: "var(--text)" }}>{t.label}</b>
                    <span style={{ display: "block" }}>{t.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>AI provider</h2>
        <p className="note">
          Needed for the tutor, AI question generation, milestone review and the labs.
          Practice, the curriculum and your progress all work without a key.
        </p>
        <div className="form" style={{ marginTop: "var(--s4)" }}>
          <label className="field">Provider
            <select value={s.provider} onChange={up("provider")}>
              <option value="dial">EPAM DIAL (needs EPAM VPN)</option>
              <option value="openai">OpenAI-compatible</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          <label className="field">Model / deployment name
            <input value={s.model} onChange={up("model")} placeholder="leave blank for the server default" />
          </label>
          <label className="field">API key
            <input type="password" value={s.key} onChange={up("key")}
              placeholder="kept in this browser tab only" autoComplete="off" />
          </label>
        </div>
        <p className="note" style={{ marginTop: "var(--s3)" }}>
          Your key stays in this tab's session storage and is sent with each AI request.
          The server never stores or logs it. DIAL personal keys are for individual use —
          use your own and do not share it.
        </p>
      </section>

      <ErrorBox error={error} />
      {msg ? <p className="ok"><Icon name="check" /> {msg}</p> : null}

      <div className="row">
        <button className="btn primary" onClick={save} disabled={busy || !s.name.trim()}>{submitLabel}</button>
        <button className="btn" onClick={test} disabled={busy || !s.name.trim()}>
          <Icon name="play" /> Test connection
        </button>
      </div>
    </div>
  );
}

export default function Settings({ cfg, onSave }) {
  const [mode, setMode] = useState(themeStore.load);
  return (
    <div className="stack" style={{ gap: "var(--s4)" }}>
      <AccountForm cfg={cfg} onSave={onSave} />
      <section className="card">
        <h2>Appearance</h2>
        <div className="row">
          {["light", "dark", "system"].map((m) => (
            <button key={m} className={`btn${mode === m ? " primary" : ""}`}
              onClick={() => setMode(themeStore.apply(m))}>
              <Icon name={m === "dark" ? "moon" : m === "light" ? "sun" : "sliders"} />
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>About</h2>
        <p className="note">
          CCA Academy is an independent study aid. All questions, milestones and labs are original
          content. <Pill>not affiliated with Anthropic</Pill>
        </p>
      </section>
    </div>
  );
}
