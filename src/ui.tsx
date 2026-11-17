import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { dayDate, dayKey, formatMinutes } from "./lib";
import type { FocusLog } from "./lib";

export function Ring({
  progress,
  stroke = 9,
  fast = false,
  className = "",
  children,
}: {
  progress: number;
  stroke?: number;
  fast?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const uid = useId().replace(/:/g, "");
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(progress));
    return () => cancelAnimationFrame(id);
  }, [progress]);

  const r = 50 - stroke / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(p, 0), 1);

  return (
    <div className={`ring ${fast ? "fast" : ""} ${className}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent)" }} />
            <stop offset="1" style={{ stopColor: "var(--purple)" }} />
          </linearGradient>
        </defs>
        <circle className="ring-bg" cx="50" cy="50" r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-fg"
          cx="50"
          cy="50"
          r={r}
          stroke={`url(#g${uid})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ opacity: clamped > 0.002 ? 1 : 0 }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Meter({
  label,
  text,
  value,
  max,
  color,
}: {
  label: string;
  text: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div>
      <div className="meter-head">
        <span>{label}</span>
        <b>{text}</b>
      </div>
      <div className="meter-bar">
        <i style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export function Card({
  title,
  action,
  className = "",
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card spot ${className}`}>
      {title && (
        <div className="card-title">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="group">
      <h2 className="group-title">{title}</h2>
      <div className="card spot list">{children}</div>
    </section>
  );
}

export function SettingRow({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-main">
        <div className="row-title">{title}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <div className="facts">
      {rows.map(([k, v]) => (
        <div className="fact" key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

export function InlineEdit({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(value);
  const finished = useRef(false);
  const finish = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (save) onSave(v);
    else onCancel();
  };
  return (
    <input
      className="inline-edit"
      autoFocus
      value={v}
      aria-label="Titel bearbeiten"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
    />
  );
}

export function FocusChart({ log, goal, days }: { log: FocusLog; goal: number; days: number }) {
  const dense = days > 7;
  const data = useMemo(() => {
    const items = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = dayDate(i);
      items.push({
        key: dayKey(i),
        minutes: log[dayKey(i)] ?? 0,
        label: d.toLocaleDateString("de-AT", { weekday: "short" }).replace(".", ""),
        full: d.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" }),
      });
    }
    return items;
  }, [log, days]);
  const max = Math.max(goal, ...data.map((d) => d.minutes));

  return (
    <div className={`chart ${dense ? "dense" : ""}`}>
      {data.map((d, i) => (
        <div className="bar-col" key={d.key} title={`${d.full}: ${formatMinutes(d.minutes)}`}>
          <div className="bar-track">
            <div
              className={`bar ${d.minutes === 0 ? "zero" : ""} ${i === data.length - 1 ? "today" : ""}`}
              style={{
                height: `${Math.max((d.minutes / max) * 100, 3)}%`,
                animationDelay: `${i * (dense ? 15 : 45)}ms`,
              }}
            />
          </div>
          {!dense && <span className={`bar-label ${i === data.length - 1 ? "on" : ""}`}>{d.label}</span>}
        </div>
      ))}
    </div>
  );
}

/** Mini-Kurve aus den zuletzt gespeicherten Kursen. */
export function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return <div className="spark none" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${26 - ((v - min) / range) * 22}`)
    .join(" ");
  return (
    <svg className={`spark ${up ? "up" : "down"}`} viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}