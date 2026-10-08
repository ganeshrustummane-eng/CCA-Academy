import React from "react";
import { AccountForm } from "./Settings.jsx";
import { Icon } from "./ui.jsx";

/* Replaces the old dead end, where a new learner was told "Set your name in
   Settings" with no way to get there. */
export default function Onboard({ cfg, onSave }) {
  return (
    <div className="stack" style={{ gap: "var(--s4)" }}>
      <section className="card hero">
        <h2 style={{ fontSize: "var(--t-2xl)" }}>Welcome to CCA Academy</h2>
        <p className="note" style={{ maxWidth: "60ch" }}>
          A practice ground for the Claude Certified Architect (Foundations) exam: five domains,
          30 task statements, a weak-first question bank, timed mock exams, hands-on labs and
          milestone projects reviewed against a rubric.
        </p>
        <div className="row" style={{ marginTop: "var(--s4)", gap: "var(--s5)" }}>
          <span className="note"><Icon name="book" /> Learn the rules and the traps</span>
          <span className="note"><Icon name="target" /> Drill what you keep missing</span>
          <span className="note"><Icon name="flask" /> Build something you can take to work</span>
        </div>
      </section>
      <p className="note">Tell us who you are to start. Everything else can wait.</p>
      <AccountForm cfg={cfg} onSave={onSave} submitLabel="Start learning" />
    </div>
  );
}
