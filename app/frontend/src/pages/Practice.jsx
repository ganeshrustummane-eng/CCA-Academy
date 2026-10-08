import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { EmptyState, ErrorBox, Icon, Pill, askAI, goto, useLoad } from "./ui.jsx";

const LETTERS = ["A", "B", "C", "D"];
const MISTAKES = "mistakes";   // focus value for "only what I last got wrong" (ADR-019)

export default function Practice({ params }) {
  const cur = useLoad(() => api.curriculum());
  const dash = useLoad(() => api.dashboard());
  const tasks = Object.fromEntries((cur.data?.domains ?? []).flatMap((d) => d.tasks.map((t) => [t.id, t])));
  const [task, setTask] = useState(params?.get("task") ?? "");
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState({ right: 0, total: 0, xp: 0 });

  const start = async (t = task) => {
    setError(null); setResult(null); setIdx(0); setScore({ right: 0, total: 0, xp: 0 });
    try {
      const r = await api.quizNext(5, t === MISTAKES ? { mistakes: true } : t ? { task: t } : null);
      setQuestions(r.questions);
    } catch (e) { setError(e); }
  };

  useEffect(() => { start(params?.get("task") ?? ""); /* eslint-disable-next-line */ }, []);

  const q = questions[idx];
  const finished = questions.length > 0 && idx >= questions.length;

  const choose = async (letter) => {
    if (result || busy || !q) return;
    setBusy(true); setError(null);
    try {
      const r = await api.answer(q.id, letter);
      setResult({ ...r, chosen: letter });
      setScore((s) => ({ right: s.right + (r.correct ? 1 : 0), total: s.total + 1, xp: s.xp + r.xp_gained }));
      dash.reload();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const next = () => { setResult(null); setIdx(idx + 1); };

  /* Answer with 1-4 or A-D, advance with Enter. Keeps a drilling session on the keyboard. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, select")) return;
      if (result && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); return; }
      if (result || !q) return;
      const byNum = LETTERS[Number(e.key) - 1];
      const byLetter = LETTERS.includes(e.key.toUpperCase()) ? e.key.toUpperCase() : null;
      const letter = byNum ?? byLetter;
      if (letter) { e.preventDefault(); choose(letter); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, q, busy, idx]);

  const generate = async () => {
    if (!task || task === MISTAKES) { setError(new Error("Pick a task first, then generate a question for it.")); return; }
    setBusy(true); setError(null);
    try {
      const gen = await api.generate(task);
      const at = idx + (result ? 1 : 0);
      setQuestions((qs) => [...qs.slice(0, at), gen, ...qs.slice(at)]);
      if (result) { setIdx(idx + 1); setResult(null); }
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: "var(--s4)" }}>
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <label className="field" style={{ minWidth: 260 }}>Focus
            <select value={task} onChange={(e) => { setTask(e.target.value); start(e.target.value); }}>
              <option value="">All tasks — weak-first</option>
              <option value={MISTAKES}>My mistakes ({dash.data?.mistakes ?? 0})</option>
              {(cur.data?.domains ?? []).map((d) => (
                <optgroup key={d.id} label={`${d.id} ${d.title}`}>
                  {d.tasks.map((t) => <option key={t.id} value={t.id}>{t.id} {t.title}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="row">
            <Pill tone={score.total && score.right === score.total ? "ok" : undefined}>
              {score.right}/{score.total} correct
            </Pill>
            <Pill tone="accent">+{score.xp} XP</Pill>
            <button className="btn" onClick={() => start()}>New set</button>
            <button className="btn" onClick={generate} disabled={busy} title="Generate one extra question with your own API key">
              <Icon name="spark" /> AI question
            </button>
          </div>
        </div>
        <p className="note" style={{ marginTop: "var(--s3)" }}>
          Press <code>1</code>–<code>4</code> to answer, <code>Enter</code> for the next question.
        </p>
      </section>

      <ErrorBox error={error} />

      {questions.length === 0 && !error && task === MISTAKES ? (
        <section className="card">
          <EmptyState icon="check" title="Nothing to review"
            action={<button className="btn primary" onClick={() => { setTask(""); start(""); }}>Practise all tasks</button>}>
            Every question you have answered, your latest answer was right. Questions you miss land here.
          </EmptyState>
        </section>
      ) : questions.length === 0 && !error ? (
        <section className="card">
          <EmptyState icon="target" title="No questions for this focus"
            action={<button className="btn primary" onClick={() => start("")}>Practise all tasks</button>}>
            This task statement has no questions in the bank yet. Try all tasks, or generate one with AI.
          </EmptyState>
        </section>
      ) : null}

      {finished ? (
        <section className="card">
          <h2>Set complete</h2>
          <div className="tiles" style={{ margin: "var(--s4) 0" }}>
            <div className="tile"><div className="k">Correct</div><div className="v tnum">{score.right}/{score.total}</div></div>
            <div className="tile"><div className="k">XP earned</div><div className="v tnum">+{score.xp}</div></div>
          </div>
          <button className="btn primary" onClick={() => start()}>Another set</button>
        </section>
      ) : null}

      {q && !finished ? (
        <section className="card">
          <div className="qmeta">
            <Pill>{idx + 1} of {questions.length}</Pill>
            <Pill tone="accent">task {q.task}</Pill>
            <span className="note">{q.scenario}</span>
            {q.id.startsWith("gen-") ? <Pill tone="warn"><Icon name="spark" /> AI-generated</Pill> : null}
          </div>
          <p className="stem">{q.stem}</p>

          <div className="options">
            {LETTERS.filter((k) => q.options[k] !== undefined).map((k) => {
              let cls = "";
              if (result) {
                if (k === result.answer) cls = "right";
                else if (k === result.chosen) cls = "wrong";
                else cls = "muted";
              }
              return (
                <button key={k} className={`btn opt ${cls}`} disabled={!!result || busy} onClick={() => choose(k)}>
                  <span className="key">{k}</span>
                  <span>{q.options[k]}</span>
                </button>
              );
            })}
          </div>

          {result ? (
            <div className="why">
              <div className="row">
                {result.correct
                  ? <Pill tone="ok"><Icon name="check" /> Correct · +{result.xp_gained} XP</Pill>
                  : <Pill tone="bad"><Icon name="x" /> The answer is {result.answer}</Pill>}
              </div>
              <div>
                <h4>Why each option</h4>
                <ul>
                  {LETTERS.filter((k) => result.why[k] !== undefined).map((k) => (
                    <li key={k} className={k === result.answer ? "ok" : undefined}>
                      <b>{k}</b><span>{result.why[k]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {!result.correct && tasks[q.task] ? (
                <div>
                  <h4>The trap this tests · {q.task} {tasks[q.task].title}</h4>
                  <ul className="traps">{tasks[q.task].traps.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              ) : null}
              <div className="row">
                {!result.correct ? (
                  <button className="btn" onClick={() => goto("learn", { task: q.task })}>
                    <Icon name="book" /> Re-read task {q.task}
                  </button>
                ) : null}
                <button className="btn" onClick={() => askAI(`I chose ${result.chosen}; the answer is ${result.answer}. Explain the concept behind this question with an example and code.`, q.id)}>
                  <Icon name="spark" /> Explain with AI
                </button>
                <button className="btn primary" onClick={next}>
                  {idx + 1 >= questions.length ? "Finish set" : "Next question"} <Icon name="right" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
