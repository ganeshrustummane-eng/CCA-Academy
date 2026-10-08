// Settings: name/squad/model persist in localStorage; the API key lives in sessionStorage only
// (cleared when the tab closes) and is sent per request, never stored by the server.
const get = (store, k, d = "") => {
  try { return store.getItem(k) ?? d; } catch { return d; }
};
const set = (store, k, v) => {
  try { store.setItem(k, v); } catch { /* storage unavailable */ }
};

// Role tracks. Same 30 tasks for everyone; the track decides which question levels
// the learner is served (resolved server-side from the stored track, never from a
// request param). Mastery is measured against the questions a track can actually see,
// so a Builder who never meets level 3 can still reach 100% readiness.
export const TRACKS = [
  { id: "builder", label: "Builder", hint: "Writing agent code day to day. Foundations and applied questions." },
  { id: "senior", label: "Senior / Lead", hint: "Full range, including architectural judgement." },
  { id: "architect", label: "Architect", hint: "Applied and architectural. Skips the foundations drills." },
  { id: "director", label: "Director", hint: "Architectural and strategic. Emphasis on scenarios over code labs." },
];

export const settings = {
  load() {
    return {
      name: get(localStorage, "cca.name"),
      squad: get(localStorage, "cca.squad"),
      track: get(localStorage, "cca.track", "senior"),
      provider: get(localStorage, "cca.provider", "dial"),
      model: get(localStorage, "cca.model"),
      key: get(sessionStorage, "cca.key"),
    };
  },
  save(s) {
    set(localStorage, "cca.name", s.name);
    set(localStorage, "cca.squad", s.squad);
    set(localStorage, "cca.track", s.track);
    set(localStorage, "cca.provider", s.provider);
    set(localStorage, "cca.model", s.model);
    set(sessionStorage, "cca.key", s.key);
  },
};

// Theme: "light" | "dark" | "system". index.html applies the stored value before
// first paint; this only handles changes made while the app is running.
export const theme = {
  load: () => get(localStorage, "cca.theme", "system"),
  apply(t) {
    set(localStorage, "cca.theme", t);
    const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    return t;
  },
};

async function request(path, { method = "GET", body } = {}) {
  const s = settings.load();
  const headers = { "Content-Type": "application/json", "X-User": s.name };
  if (s.key) headers["X-LLM-Key"] = s.key;
  if (s.provider) headers["X-LLM-Provider"] = s.provider;
  if (s.model) headers["X-LLM-Model"] = s.model;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch { /* non-JSON error */ }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

export const api = {
  curriculum: () => request("/api/curriculum"),
  milestones: () => request("/api/milestones"),
  upsertUser: (name, squad, track) => request("/api/users", { method: "POST", body: { name, squad, track } }),
  dashboard: () => request("/api/dashboard"),
  leaderboard: () => request("/api/leaderboard"),
  quizNext: (n, filter) => {
    const p = new URLSearchParams({ n });
    if (filter?.task) p.set("task", filter.task);
    if (filter?.domain) p.set("domain", filter.domain);
    if (filter?.mistakes) p.set("mistakes", "true");
    return request(`/api/quiz/next?${p}`);
  },
  answer: (qid, chosen) => request("/api/quiz/answer", { method: "POST", body: { qid, chosen } }),
  generate: (task) => request("/api/quiz/generate", { method: "POST", body: { task } }),
  tutor: (domain, message, history) => request("/api/tutor", { method: "POST", body: { domain, message, history } }),
  ask: (message, ref, page, history) => request("/api/ask", { method: "POST", body: { message, ref, page, history } }),
  solution: (id) => request(`/api/milestones/${id}/solution`, { method: "POST" }),
  review: (id, files) => request(`/api/milestones/${id}/review`, { method: "POST", body: { files } }),
  labs: () => request("/api/labs"),
  labReview: (id, system_prompt, tools) =>
    request(`/api/labs/${id}/review`, { method: "POST", body: { system_prompt, tools } }),
  scenarios: () => request("/api/scenarios"),
  scenarioReview: (id, choices, rationale) =>
    request(`/api/scenarios/${id}/review`, { method: "POST", body: { choices, rationale } }),
  playground: (opts) => request("/api/playground/run", { method: "POST", body: opts }),
  playgroundTools: () => request("/api/playground/tools"),
  examStart: () => request("/api/exam/start", { method: "POST" }),
  examSubmit: (exam_id, answers) => request("/api/exam/submit", { method: "POST", body: { exam_id, answers } }),
  examHistory: () => request("/api/exam/history"),
  testLlm: () => request("/api/llm/test", { method: "POST" }),
};
