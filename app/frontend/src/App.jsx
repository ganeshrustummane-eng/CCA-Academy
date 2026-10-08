import React, { useEffect, useState } from "react";
import { settings, theme as themeStore } from "./api.js";
import { Icon, goto, useHashRoute } from "./pages/ui.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Learn from "./pages/Learn.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Settings from "./pages/Settings.jsx";
import Onboard from "./pages/Onboard.jsx";
import Practice from "./pages/Practice.jsx";
import Milestones from "./pages/Milestones.jsx";
import PromptLab from "./pages/PromptLab.jsx";
import Scenarios from "./pages/Scenarios.jsx";
import { Tutor, Playground } from "./pages/Ai.jsx";
import Exam from "./pages/Exam.jsx";
import Path from "./pages/Path.jsx";
import AskAI from "./pages/Ask.jsx";

/* Adding a page is one entry here plus one import above. `how` is the numbered
   "How this tab works" panel shown under the blurb. */
const PAGES = {
  path: {
    label: "Learning path", icon: "path", group: "Learn", title: "Your learning path", Page: Path,
    blurb: "The course in order. Each week: learn the tasks, practise them, build the milestone, get it reviewed.",
    how: [
      "Work top to bottom. The stop marked \"you are here\" is the first milestone you haven't passed yet.",
      "Learn: open each task in Curriculum and read what is tested and the exam traps.",
      "Practise: drill those tasks until they show as mastered. Use \"Explain with AI\" if a concept won't stick.",
      "Build: open the milestone and follow its step-by-step plan, then submit your files for review.",
      "Finish with the timed mock exam once every stop is passed.",
    ],
  },
  dashboard: {
    label: "Dashboard", icon: "gauge", group: "Learn", title: "Dashboard", Page: Dashboard,
    how: [
      "XP and level go up as you answer questions correctly and pass milestones.",
      "Readiness is your mastery weighted by each domain's share of the exam. Aim for 80%.",
      "Weakest tasks are where to practise next. Click one to drill it.",
    ],
  },
  learn: {
    label: "Curriculum", icon: "book", group: "Learn", title: "Curriculum", Page: Learn,
    blurb: "Five domains, 30 task statements. Each one lists the rules that are tested and the traps that are set.",
    how: [
      "New to LLM APIs? Start with \"The basics\" card at the top.",
      "Expand a task to read its summary, a worked example, the rules that are tested, and the common exam traps.",
      "Press \"Explain with AI\" for a worked example with code, grounded in that task.",
      "Press \"Practise this task\" to drill questions on it straight away.",
    ],
  },
  tutor: {
    label: "Tutor", icon: "message", group: "Learn", title: "AI tutor", Page: Tutor,
    blurb: "A tutor grounded in one domain at a time. Needs your API key.",
    how: [
      "Pick a domain, then press Start lesson for a guided walkthrough with check questions.",
      "Answer in your own words. The tutor corrects you and moves to the next point.",
      "For a quick one-off question on any page, use the Ask AI button in the corner instead.",
    ],
  },
  practice: {
    label: "Practice", icon: "target", group: "Practise", title: "Practice", Page: Practice,
    blurb: "Weak-first questions. Missed answers come back more often; mastered ones fade away.",
    how: [
      "Pick a focus task or leave it on all tasks. Answer with 1-4 or A-D.",
      "After answering, read why each option is right or wrong. Press \"Explain with AI\" for a deeper example.",
      "A task is mastered while your latest answer to each of its questions is correct. A later miss un-masters it.",
      "Pick \"My mistakes\" to drill only the questions you last got wrong, including ones from the mock exam.",
    ],
  },
  exam: {
    label: "Mock exam", icon: "timer", group: "Practise", title: "Mock exam", Page: Exam,
    blurb: "A timed, exam-shaped sitting. Ask AI is switched off here.",
    how: [
      "60 questions in 90 minutes, weighted like the real exam's domains. Pass mark 700/1000.",
      "You only see results at the end. XP is paid once, for improving on your best score.",
    ],
  },
  milestones: {
    label: "Milestones", icon: "clipboard", group: "Build", title: "Milestone projects", Page: Milestones,
    blurb: "Build it locally, submit the files, get scored against the rubric by an independent reviewer.",
    how: [
      "Pick a project. Read the brief, deliverables and rubric so you know how it is graded.",
      "Follow the step-by-step plan and tick steps off as you go. Each step has an Ask AI button.",
      "Still stuck? Open the approach guide. After one honest attempt, compare with the reference solution. XP already earned stays; later submissions earn no more.",
      "Paste or upload your files and submit. 70 or more passes.",
    ],
  },
  lab: {
    label: "Prompt/Tool Lab", icon: "flask", group: "Build", title: "Prompt/Tool Lab", Page: PromptLab,
    blurb: "Write a system prompt and tool definitions for a scenario, get scored against the rubric by an independent reviewer.",
    how: [
      "Read the lab brief and rubric.",
      "Write the system prompt and the tool definitions as JSON, then submit.",
      "Use each criterion's fix note to revise and resubmit. XP is only paid for improvement.",
    ],
  },
  scenarios: {
    label: "Architecture Scenarios", icon: "scale", group: "Build", title: "Architecture scenarios", Page: Scenarios,
    blurb: "Business cases with model-tier, caching, batch-vs-stream and RAG-vs-tools trade-offs. Decisions are graded automatically; your written rationale is reviewed by AI.",
    how: [
      "Read the business case, then pick an option for each decision.",
      "Write a rationale explaining the trade-offs. This part is reviewed by AI.",
      "Your score is half decisions, half rationale. The monthly cost of your choices is shown too.",
    ],
  },
  playground: {
    label: "Agent sandbox", icon: "workflow", group: "Build", title: "Agent sandbox", Page: Playground,
    blurb: "Run a support agent and watch the loop. Flip the guards off to see exactly how it breaks.",
    how: [
      "Run with all guards on and step through the trace.",
      "Turn a guard off (gate, hook, normalise, or the loop mode) and run again to see what breaks.",
      "Export the run as Python to see the same loop as real SDK code.",
    ],
  },
  leaderboard: { label: "Leaderboard", icon: "trophy", group: "Progress", title: "Leaderboard", Page: Leaderboard },
  settings: { label: "Settings", icon: "sliders", group: "Progress", title: "Settings", Page: Settings },
};

const GROUPS = ["Learn", "Practise", "Build", "Progress"];

export default function App() {
  const [cfg, setCfg] = useState(settings.load());
  const [mode, setMode] = useState(themeStore.load);
  const { route, params } = useHashRoute();

  const entry = PAGES[route] ?? PAGES.dashboard;
  const needsName = !cfg.name && route !== "settings";

  const toggleTheme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    setMode(themeStore.apply(dark ? "light" : "dark"));
  };

  const Page = entry.Page;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">C</span>
          <div>
            <b>CCA Academy</b>
            <span>Claude Certified Architect</span>
          </div>
        </div>

        {GROUPS.map((g) => {
          const items = Object.entries(PAGES).filter(([, p]) => p.group === g);
          if (!items.length) return null;
          return (
            <nav key={g} className="navgroup" aria-label={g}>
              <h4>{g}</h4>
              {items.map(([id, p]) => (
                <button key={id} className="navlink" onClick={() => goto(id)}
                  aria-current={route === id ? "page" : undefined}>
                  <Icon name={p.icon} /> <span>{p.label}</span>
                </button>
              ))}
            </nav>
          );
        })}

        <div className="sidebar-foot">
          <button className="navlink" onClick={toggleTheme}
            title={mode === "system" ? "Following your system theme" : `Theme: ${mode}`}>
            <Icon name={document.documentElement.dataset.theme === "dark" ? "sun" : "moon"} />
            <span>{document.documentElement.dataset.theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>

      <div className="col">
        <header className="topbar">
          <h1>{needsName ? "Welcome" : entry.title}</h1>
          <div className="spacer" />
          {cfg.name ? (
            <>
              <span className="pill accent">{cfg.track}</span>
              <span className="note">{cfg.name}</span>
            </>
          ) : <span className="note">not signed in</span>}
        </header>

        <main className="content">
          {needsName ? (
            <Onboard cfg={cfg} onSave={(c) => { setCfg(c); goto("path"); }} />
          ) : (
            <>
              {entry.blurb || entry.how ? (
                <div className="page-head">
                  {entry.blurb ? <p>{entry.blurb}</p> : null}
                  {entry.how ? (
                    <details className="how">
                      <summary><Icon name="help" /> How this tab works</summary>
                      <ol>{entry.how.map((h) => <li key={h}>{h}</li>)}</ol>
                    </details>
                  ) : null}
                </div>
              ) : null}
              <Page params={params} cfg={cfg} onSave={setCfg} />
            </>
          )}
        </main>

        {!needsName && route !== "exam" ? <AskAI route={route} params={params} /> : null}

        <footer>
          Independent study aid, not affiliated with Anthropic. Practice questions are original,
          not real exam items. Hands-on labs live in the{" "}
          <a href="https://github.com/aderegil/claude-certified-architect" target="_blank" rel="noreferrer">upstream repo</a>.
        </footer>
      </div>
    </div>
  );
}
