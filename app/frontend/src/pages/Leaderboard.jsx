import React from "react";
import { api } from "../api.js";
import { EmptyState, Load, useLoad } from "./ui.jsx";

export default function Leaderboard({ cfg }) {
  const state = useLoad(() => api.leaderboard());
  return (
    <Load state={state} lines={6}>{(data) => (
      <div className="grid">
        <section className="card">
          <h2>Individuals</h2>
          <div className="scroll-x">
            <table>
              <thead><tr><th className="rank">#</th><th>Name</th><th>Squad</th><th>Level</th><th className="num">XP</th></tr></thead>
              <tbody>
                {data.people.map((p, i) => (
                  <tr key={p.name} className={p.name === cfg?.name ? "me" : undefined}>
                    <td className="rank">{i + 1}</td>
                    <td>{p.name}</td>
                    <td className="note">{p.squad || "—"}</td>
                    <td>{p.level}</td>
                    <td className="num">{p.xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h2>Squads</h2>
          {data.squads.length === 0 ? (
            <EmptyState icon="trophy" title="No squads yet">
              Set a squad name in Settings and your team will show up here, ranked by average XP.
            </EmptyState>
          ) : (
            <table>
              <thead><tr><th>Squad</th><th className="num">Members</th><th className="num">Avg XP</th></tr></thead>
              <tbody>
                {data.squads.map((s) => (
                  <tr key={s.squad} className={s.squad === cfg?.squad ? "me" : undefined}>
                    <td>{s.squad}</td><td className="num">{s.members}</td><td className="num">{s.avg_xp}</td>
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
