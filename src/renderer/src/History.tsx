import { type Habit, type HabitStatus, trackHabits } from "@shared/habits";
import { filterSessions, type SessionFilter, type TrainingSession } from "@shared/training";
import { TRAININGS, trainingById } from "@shared/trainings";
import { scoreTrends, type Trend } from "@shared/trends";
import { useCallback, useEffect, useState } from "react";
import { Segmented } from "./components/fields";
import { SessionRow } from "./SessionRow";
import { shortDate } from "./text";

const STATUS_LABEL: Record<SessionFilter["status"], string> = {
  all: "All",
  open: "In progress",
  finished: "Finished",
};

export function History({ onOpenSession }: { onOpenSession: (id: string) => void }) {
  const [sessions, setSessions] = useState<TrainingSession[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<SessionFilter>({ training: "all", status: "all" });

  const load = useCallback(() => window.greenroom.sessions.list().then(setSessions), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!sessions) return null;
  const trends = scoreTrends(sessions, TRAININGS);
  const shown = filterSessions(sessions, filter);

  const remove = async (id: string) => {
    await window.greenroom.sessions.remove(id);
    setConfirm(null);
    load();
  };

  return (
    <section className="page">
      <h1 className="page-title">History</h1>

      {trends.length === 0 && (
        <p className="lede">Score a mock interview or a drill and your progress shows up here.</p>
      )}
      {trends.map((t) => (
        <TrendChart key={t.key} trend={t} onOpenSession={onOpenSession} />
      ))}

      {TRAININGS.map((def) => {
        const habits = trackHabits(sessions, def);
        return habits.length ? <HabitList key={def.id} title={def.title} habits={habits} /> : null;
      })}

      <div className="programme">
        <h2 className="section-title">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="muted">No sessions yet. Start one from Home.</p>
        ) : (
          <>
            <div className="filters">
              <Segmented
                label="Training"
                options={["all", ...TRAININGS.map((t) => t.id)]}
                value={filter.training}
                onChange={(training) => setFilter({ ...filter, training })}
                labelOf={(id) => (id === "all" ? "All" : (trainingById(id)?.title ?? id))}
              />
              <Segmented
                label="Status"
                options={["all", "open", "finished"] as const}
                value={filter.status}
                onChange={(status) => setFilter({ ...filter, status })}
                labelOf={(status) => STATUS_LABEL[status]}
              />
            </div>
            {shown.length === 0 ? (
              <p className="muted">No sessions match these filters.</p>
            ) : (
              <SessionList
                sessions={shown}
                confirm={confirm}
                onConfirm={setConfirm}
                onOpenSession={onOpenSession}
                onRemove={remove}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

const HABIT_STAMP: Record<HabitStatus, string> = {
  open: "stamp",
  improving: "stamp ok",
  fixed: "stamp pending",
};

/** Patterns the reports keep finding, and whether practice is working. */
function HabitList({ title, habits }: { title: string; habits: Habit[] }) {
  return (
    <div className="programme">
      <h2 className="section-title">Habits · {title}</h2>
      <ol className="script">
        {habits.map((h) => (
          <li key={h.key}>
            <span className="script-speaker">
              {h.label}
              <span className={HABIT_STAMP[h.status]}>{h.status}</span>
            </span>
            <span className="script-text">
              “{h.quote}” → <strong>{h.better}</strong>
              <span className="item-detail">
                Heard in {h.seen} run{h.seen === 1 ? "" : "s"}, last {shortDate(h.lastSeen)}
                {h.drills ? ` · ${h.drills} drill round${h.drills === 1 ? "" : "s"}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SessionList({
  sessions,
  confirm,
  onConfirm,
  onOpenSession,
  onRemove,
}: {
  sessions: TrainingSession[];
  confirm: string | null;
  onConfirm: (id: string | null) => void;
  onOpenSession: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <ul className="cards">
      {sessions.map((s) => (
        <li key={s.id} className="row-with-action">
          <SessionRow session={s} onOpen={() => onOpenSession(s.id)} />
          {confirm === s.id ? (
            <span className="confirm">
              <button type="button" className="btn danger" onClick={() => onRemove(s.id)}>
                Delete
              </button>
              <button type="button" className="btn" onClick={() => onConfirm(null)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="link" onClick={() => onConfirm(s.id)}>
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const W = 640;
const H = 200;
const PAD = { left: 28, right: 12, top: 12, bottom: 24 };

function TrendChart({
  trend,
  onOpenSession,
}: {
  trend: Trend;
  onOpenSession: (id: string) => void;
}) {
  const [criterion, setCriterion] = useState<string>("overall");
  const values = trend.points.map((p) =>
    criterion === "overall" ? p.overall : (p.scores[criterion] ?? null),
  );
  const n = trend.points.length;
  const x = (i: number) =>
    PAD.left +
    (n === 1 ? (W - PAD.left - PAD.right) / 2 : (i / (n - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + ((5 - v) / 4) * (H - PAD.top - PAD.bottom);
  const path = values
    .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .join(" ");
  const first = values.find((v) => v !== null) ?? null;
  const last = [...values].reverse().find((v) => v !== null) ?? null;
  const delta = first !== null && last !== null && n > 1 ? last - first : null;
  const latest = trend.points.at(-1);

  return (
    <div className="programme">
      <div className="programme-head">
        <h2 className="section-title">{trend.title}</h2>
        {delta !== null && (
          <span className={delta > 0 ? "stamp ok" : delta < 0 ? "stamp bad" : "stamp"}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} since first
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor={`trend-${trend.key}`}>Show</label>
        <select
          id={`trend-${trend.key}`}
          value={criterion}
          onChange={(e) => setCriterion(e.target.value)}
          className="narrow"
        >
          <option value="overall">Overall</option>
          {trend.rubric.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <svg
        className="trend"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${trend.title} scores over time`}
      >
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className={v === 3 ? "bar-line" : "grid-line"}
            />
            <text x={4} y={y(v) + 4} className="axis">
              {v}
            </text>
          </g>
        ))}
        <polyline points={path} className="trend-line" />
        {values.map((v, i) =>
          v === null ? null : (
            // biome-ignore lint/suspicious/noArrayIndexKey: points are chronological and fixed
            <g key={i}>
              <rect x={x(i) - 5} y={y(v) - 5} width={10} height={10} className="trend-dot">
                <title>
                  {trend.points[i]?.sessionTitle}, {shortDate(trend.points[i]?.at ?? "")}: {v}
                </title>
              </rect>
              <text x={x(i)} y={H - 6} className="axis" textAnchor="middle">
                {shortDate(trend.points[i]?.at ?? "")}
              </text>
            </g>
          ),
        )}
      </svg>
      <p className="hint">The darker line is 3, a typical hire-bar answer.</p>
      {latest && (
        <div className="cast-line">
          <span>Latest</span>
          <span className="leader" aria-hidden="true" />
          <button type="button" className="link" onClick={() => onOpenSession(latest.sessionId)}>
            {latest.sessionTitle}: {latest.overall.toFixed(1)},{" "}
            {Math.round(latest.metrics.wordsPerMinute)} wpm,{" "}
            {latest.metrics.fillersPerMinute.toFixed(1)} fillers/min
          </button>
        </div>
      )}
    </div>
  );
}
