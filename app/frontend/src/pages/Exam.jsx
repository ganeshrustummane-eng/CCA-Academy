import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { Bar, EmptyState, ErrorBox, Icon, Load, Pill, Skeleton, goto, useLoad } from "./ui.jsx";

const LETTERS = ["A", "B", "C", "D"];
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export default function Exam() {
  const history = useLoad(() => api.examHistory());
  const [sitting, setSitting] = useState(null);   // { exam_id, questions, seconds }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (result) return <Results result={result} onDone={() => { setResult(null); setSitting(null); history.reload(); }} />;
  if (sitting) {
    return <Sitting sitting={sitting} onFinish={setResult} onAbandon={() => setSitting(null)} />;
  }

  const start = async () => {
    setBusy(true); setError(null);
    try { setSitting(await api.examStart()); } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <Load state={history} lines={5}>{(data) => (
      <div className="stack" style={{ gap: "var(--s4)" }}>
        <section className="card hero">
          <h2>Timed mock exam</h2>
          <p className="note" style={{ maxWidth: "62ch" }}>
            {data.questions} questions in {Math.round(data.seconds / 60)} minutes, sampled across the
            five domains in the same proportions as the real blueprint. Scored out of 1000 with a
            pass mark of {data.pass_mark}. Questions are drawn uniformly, not weak-first, so the
            score measures readiness rather than your worst material.
          </p>
          <div className="row" style={{ marginTop: "var(--s4)" }}>
            <button className="btn primary" onClick={start} disabled={busy}>
              <Icon name="clock" /> {busy ? "Building..." : "Start exam"}
            </button>
            <span className="note">XP is awarded once per exam, for improvement only.</span>
          </div>
        </section>

        <ErrorBox error={error} />

        <section className="card">
          <h3>Previous attempts</h3>
          {data.exams.length === 0 ? (
            <EmptyState icon="clock" title="No attempts yet">
              Sit one once you have drilled a few domains. Practice answers and exam answers are
              tracked separately, so an exam never inflates your readiness score.
            </EmptyState>
          ) : (
            <table className="tbl">
              <thead><tr><th>Score</th><th>Result</th><th>Taken</th></tr></thead>
              <tbody>
                {data.exams.map((e) => (
                  <tr key={e.exam_id}>
                    <td className="tnum">{e.score} / 1000</td>
                    <td><Pill tone={e.passed ? "ok" : "bad"}>{e.passed ? "Passed" : "Not yet"}</Pill></td>
                    <td className="note">{new Date(e.finished * 1000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    )}</Load>
  );
}

function Sitting({ sitting, onFinish, onAbandon }) {
  const { questions, seconds, exam_id } = sitting;
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(seconds);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submitted = useRef(false);

  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;

  /* The countdown is a courtesy, not the control: the server stamps `started` and flags a
     late submission itself, so stopping the clock here cannot buy extra time. */
  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true); setError(null);
    try { onFinish(await api.examSubmit(exam_id, answers)); }
    catch (e) { submitted.current = false; setError(e); setBusy(false); }
  };

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) { clearInterval(t); submit(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, select")) return;
      const letter = LETTERS[Number(e.key) - 1] ?? (LETTERS.includes(e.key.toUpperCase()) ? e.key.toUpperCase() : null);
      if (letter) { e.preventDefault(); setAnswers((a) => ({ ...a, [q.id]: letter })); return; }
      if (e.key === "Enter" || e.key === "ArrowRight") setIdx((i) => Math.min(questions.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key.toLowerCase() === "f") setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, questions.length]);

  return (
    <div className="stack" style={{ gap: "var(--s4)" }}>
      <section className="card exam-bar">
        <div className="row" style={{ gap: "var(--s2)" }}>
          <Pill tone={left < 300 ? "bad" : left < 900 ? "warn" : undefined}>
            <Icon name="clock" /> <span className="tnum">{mmss(left)}</span>
          </Pill>
          <Pill>{answeredCount} of {questions.length} answered</Pill>
          {Object.values(flagged).some(Boolean)
            ? <Pill tone="warn">{Object.values(flagged).filter(Boolean).length} flagged</Pill> : null}
        </div>
        <button className="btn primary" onClick={() => setConfirming(true)} disabled={busy}>Submit exam</button>
      </section>

      <div className="split">
        <aside className="card">
          <h3>Questions</h3>
          <div className="palette">
            {questions.map((x, i) => (
              <button key={x.id} aria-label={`Question ${i + 1}`} aria-current={i === idx}
                className={`pal${answers[x.id] ? " done" : ""}${flagged[x.id] ? " flag" : ""}${i === idx ? " here" : ""}`}
                onClick={() => setIdx(i)}>{i + 1}</button>
            ))}
          </div>
          <p className="note" style={{ marginTop: "var(--s3)" }}>
            <code>1</code>–<code>4</code> to answer, <code>F</code> to flag, arrows to move.
          </p>
        </aside>

        <section className="card">
          <div className="qmeta">
            <Pill>{idx + 1} of {questions.length}</Pill>
            <Pill tone="accent">task {q.task}</Pill>
            <span className="note">{q.scenario}</span>
            <button className={`btn sm${flagged[q.id] ? " primary" : " ghost"}`}
              onClick={() => setFlagged({ ...flagged, [q.id]: !flagged[q.id] })}>
              <Icon name="flag" /> {flagged[q.id] ? "Flagged" : "Flag"}
            </button>
          </div>
          <p className="stem">{q.stem}</p>
          <div className="options">
            {LETTERS.filter((k) => q.options[k] !== undefined).map((k) => (
              <button key={k} className={`btn opt${answers[q.id] === k ? " chosen" : ""}`}
                onClick={() => setAnswers({ ...answers, [q.id]: k })}>
                <span className="key">{k}</span><span>{q.options[k]}</span>
              </button>
            ))}
          </div>
          {/* No correctness during the exam -- the API does not return it either. */}
          <div className="row" style={{ marginTop: "var(--s4)", justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Back</button>
            <button className="btn" onClick={() => setIdx(Math.min(questions.length - 1, idx + 1))}
              disabled={idx === questions.length - 1}>Next <Icon name="right" /></button>
          </div>
        </section>
      </div>

      <ErrorBox error={error} />

      {confirming ? (
        <section className="card">
          <h3>Submit now?</h3>
          <p className="note">
            {questions.length - answeredCount === 0
              ? "All questions answered."
              : `${questions.length - answeredCount} question(s) are unanswered and will be marked wrong.`}
          </p>
          <div className="row" style={{ marginTop: "var(--s3)" }}>
            <button className="btn primary" onClick={submit} disabled={busy}>
              {busy ? "Scoring..." : "Yes, submit"}
            </button>
            <button className="btn" onClick={() => setConfirming(false)} disabled={busy}>Keep working</button>
            <button className="btn ghost" onClick={onAbandon} disabled={busy}>Abandon without submitting</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Results({ result, onDone }) {
  const [filter, setFilter] = useState("wrong");
  const shown = useMemo(
    () => result.review.filter((r) => (filter === "wrong" ? !r.correct : filter === "all" ? true : r.domain === filter)),
    [result, filter],
  );
  // Study plan: the three tasks with the most misses (ADR-019).
  const plan = useMemo(() => {
    const misses = {};
    result.review.filter((r) => !r.correct).forEach((r) => { misses[r.task] = (misses[r.task] ?? 0) + 1; });
    return Object.entries(misses).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [result]);

  return (
    <div className="stack" style={{ gap: "var(--s4)" }}>
      <section className="card hero">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>{result.score} / 1000</h2>
          <div className="row" style={{ gap: "var(--s2)" }}>
            <Pill tone={result.passed ? "ok" : "bad"}>
              <Icon name={result.passed ? "check" : "x"} /> {result.passed ? "Passed" : "Not yet: here is your plan"}
            </Pill>
            <Pill tone="accent">+{result.xp_gained} XP</Pill>
            {result.late ? <Pill tone="warn">Submitted after time</Pill> : null}
          </div>
        </div>
        <div className="tiles" style={{ marginTop: "var(--s4)" }}>
          <div className="tile"><div className="k">Correct</div><div className="v tnum">{result.correct}/{result.total}</div></div>
          <div className="tile"><div className="k">Pass mark</div><div className="v tnum">{result.pass_mark}</div></div>
          <div className="tile"><div className="k">Time taken</div><div className="v tnum">{mmss(result.seconds_taken)}</div></div>
        </div>
      </section>

      {plan.length ? (
        <section className="card">
          <h3>What to learn next</h3>
          <p className="note">The tasks you missed most. Re-read each one, then drill it until it shows as mastered.</p>
          {plan.map(([t, n]) => (
            <div key={t} className="row" style={{ justifyContent: "space-between", marginTop: "var(--s2)" }}>
              <span><b className="mono">{t}</b> <span className="note">{n} missed</span></span>
              <span className="row" style={{ gap: "var(--s2)" }}>
                <button className="btn sm" onClick={() => goto("learn", { task: t })}><Icon name="book" /> Learn</button>
                <button className="btn sm primary" onClick={() => goto("practice", { task: t })}><Icon name="target" /> Practise</button>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card">
        <h3>By domain</h3>
        {Object.entries(result.per_domain).map(([d, pct]) => (
          <Bar key={d} value={pct} label={d} tone={pct >= 70 ? "ok" : pct >= 50 ? "warn" : "bad"} />
        ))}
        <p className="note" style={{ marginTop: "var(--s3)" }}>
          Exam answers do not move your readiness score — they steer which questions Practice
          serves you next instead.
        </p>
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>Review</h3>
          <div className="row" style={{ gap: "var(--s2)" }}>
            {["wrong", "all", ...Object.keys(result.per_domain)].map((f) => (
              <button key={f} className={`btn sm${filter === f ? " primary" : " ghost"}`} onClick={() => setFilter(f)}>
                {f === "wrong" ? `Missed (${result.total - result.correct})` : f === "all" ? "All" : f}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon="check" title="Nothing missed in this slice">Pick another filter to review the rest.</EmptyState>
        ) : shown.map((r) => (
          <div key={r.qid} className="crit">
            <div className="row" style={{ gap: "var(--s2)" }}>
              <Pill tone={r.correct ? "ok" : "bad"}>{r.correct ? "Correct" : r.chosen ? `You chose ${r.chosen}` : "Unanswered"}</Pill>
              <Pill tone="accent">task {r.task}</Pill>
              {!r.correct ? (
                <button className="btn sm ghost" onClick={() => goto("learn", { task: r.task })}>
                  <Icon name="book" /> Re-read {r.task}
                </button>
              ) : null}
            </div>
            <p className="stem" style={{ fontSize: "var(--t-md)" }}>{r.stem}</p>
            <ul>
              {LETTERS.filter((k) => r.options[k] !== undefined).map((k) => (
                <li key={k} className={k === r.answer ? "ok" : undefined}>
                  <b>{k}</b><span>{r.options[k]} — {r.why[k]}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <div className="row">
        <button className="btn primary" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}
