import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button, Input } from "glisse";
import {
  Calculator,
  CalendarBlank,
  ChartLineUp,
  Check,
  CheckCircle,
  Circle,
  Clock as ClockIcon,
  CloudSun,
  Drop,
  Fire,
  ListBullets,
  ListChecks,
  MagnifyingGlass,
  Minus,
  MusicNotes,
  NotePencil,
  Pause,
  Play,
  Plus,
  Pulse,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Target,
  Timer,
  Wallet,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { CalEvent } from "./Calendar";
import { COINS } from "./Market";
import type { MarketState } from "./Market";
import { summary } from "./Money";
import type { MoneyView, Txn } from "./Money";
import type { Note } from "./Notes";
import type { MusicApi } from "./player";
import { QuickCalc } from "./Tools";
import { FocusChart, Spark } from "./ui";
import type { Habit, Task } from "./types";
import { WeatherWidget } from "./Weather";
import { extraDefs } from "./Widgets2";
import { WidgetGrid } from "./WidgetGrid";
import type { GridDef, Layout, Sz } from "./WidgetGrid";
import { Heatmap, ListGlance } from "./Wellness";
import type { TodoList, Well } from "./Wellness";
import { dayKey, fmt, formatMinutes, greeting, money, monthKey, relDay, streakOf, sumDays, useStored } from "./lib";
import type { FocusLog } from "./lib";
import "./widgets.css";

export type DashProps = {
  name: string;
  log: FocusLog;
  goal: number;
  tasks: Task[];
  onToggleTask: (id: number) => void;
  onAddTask: (title: string) => void;
  habits: Habit[];
  onToggleHabit: (id: number) => void;
  events: CalEvent[];
  lists: TodoList[];
  setLists: (l: TodoList[]) => void;
  well: Well;
  setWell: (w: Well) => void;
  music: MusicApi;
  txns: Txn[];
  budget: number;
  m: MarketState;
  onPlan: (id: string) => void;
  onMoney: (v: MoneyView) => void;
  onMusic: () => void;
  onSearch: () => void;
};

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/* =========================================================
   Bausteine
   ========================================================= */

function Head({ icon: I, label, color, right }: { icon: Icon; label: string; color: string; right?: ReactNode }) {
  return (
    <div className="wh">
      <span className="wh-ic" style={{ background: color }}>
        <I size={14} weight="fill" />
      </span>
      <b style={{ color }}>{label}</b>
      {right !== undefined && <span className="wh-r">{right}</span>}
    </div>
  );
}

function Shell({
  tone = "",
  onOpen,
  label,
  children,
}: {
  tone?: string;
  onOpen?: () => void;
  label?: string;
  children: ReactNode;
}) {
  if (onOpen) {
    return (
      <div
        className={`w click ${tone}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {children}
      </div>
    );
  }
  return <div className={`w ${tone}`}>{children}</div>;
}

/** Ein oder mehrere Ringe, wie bei Apple Fitness. */
function RingSet({
  rings,
  stroke = 9,
  children,
}: {
  rings: { p: number; color: string }[];
  stroke?: number;
  children?: ReactNode;
}) {
  const gap = 2.4;
  return (
    <div className="rs">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {rings.map((r, i) => {
          const rad = 50 - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * rad;
          const v = clamp(r.p, 0, 1);
          return (
            <g key={i} transform="rotate(-90 50 50)">
              <circle cx="50" cy="50" r={rad} fill="none" stroke={r.color} strokeOpacity={0.24} strokeWidth={stroke} />
              <circle
                cx="50"
                cy="50"
                r={rad}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - v)}
                style={{ opacity: v > 0.005 ? 1 : 0, transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 0.9, 0.28, 1)" }}
              />
            </g>
          );
        })}
      </svg>
      {children !== undefined && <div className="rs-c">{children}</div>}
    </div>
  );
}

const evKey = (e: CalEvent) => e.date + e.time;
const noteTitle = (t: string) => (t.split("\n")[0] ?? "").trim() || "Neue Notiz";
const notePreview = (t: string) => t.split("\n").slice(1).join(" ").trim();
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

/* =========================================================
   Widgets
   ========================================================= */

function ClockW({ sz }: { sz: Sz }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const sec = now.getSeconds();
  const min = now.getMinutes() + sec / 60;
  const hr = (now.getHours() % 12) + min / 60;

  const face = (
    <svg viewBox="-50 -50 100 100" className="clk" role="img" aria-label={now.toLocaleTimeString("de-AT")}>
      <circle r="49" fill="#000" />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          y1="-43"
          y2={i % 3 === 0 ? "-35" : "-39"}
          stroke="#fff"
          strokeWidth={i % 3 === 0 ? 2.2 : 1}
          transform={`rotate(${i * 30})`}
        />
      ))}
      <g transform={`rotate(${hr * 30})`}>
        <line y2="-24" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${min * 6})`}>
        <line y2="-36" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${sec * 6})`}>
        <line y1="8" y2="-40" stroke="#ff9f0a" strokeWidth="1" />
      </g>
      <circle r="2.6" fill="#ff9f0a" />
    </svg>
  );

  return (
    <div className="w dark clockw">
      {face}
      {sz.w >= 2 && (
        <div className="clk-txt">
          <b>{now.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}</b>
          <span>{now.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
      )}
    </div>
  );
}

function CalW({ events, sz }: { events: CalEvent[]; sz: Sz }) {
  const today = dayKey();
  const d = new Date();
  const list = events.filter((e) => e.date >= today).sort((a, b) => evKey(a).localeCompare(evKey(b)));
  const max = sz.h >= 2 ? 3 + (sz.h - 2) * 3 : sz.w >= 2 ? 2 : 1;
  const shown = list.slice(0, max);
  const row = sz.w >= 2;
  return (
    <div className="w">
      <div className={`cal${row ? " row" : ""}`}>
        <div className="cal-date">
          <span>{d.toLocaleDateString("de-AT", { weekday: "long" })}</span>
          <b>{d.getDate()}</b>
          {!row && <small>{shown[0] ? shown[0].title : "Keine Termine"}</small>}
        </div>
        {row && (
          <div className="cal-list">
            {shown.length === 0 && <div className="wmuted">Keine Termine</div>}
            {shown.map((e) => (
              <div className="cal-ev" key={e.id}>
                <i />
                <div>
                  <b>{e.title}</b>
                  <span>
                    {relDay(e.date)}
                    {e.time ? `, ${e.time}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TasksW({ p, sz }: { p: DashProps; sz: Sz }) {
  const [text, setText] = useState("");
  const open = p.tasks.filter((t) => !t.done).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const small = sz.w < 2 && sz.h < 2;
  const rows = small ? 0 : sz.h === 1 ? 2 : sz.h * 3 - 1;
  const add = () => {
    const t = text.trim();
    if (!t) return;
    p.onAddTask(t);
    setText("");
  };
  return (
    <div className="w">
      <div className="tw-top">
        <span className="wh-ic big" style={{ background: "#0a84ff" }}>
          <ListChecks size={20} weight="fill" />
        </span>
        <b className="tw-n">{open.length}</b>
      </div>
      <b className="tw-title">Aufgaben</b>
      {rows > 0 && (
        <div className="tw-list">
          {open.slice(0, rows).map((t) => (
            <div className="tw-row" key={t.id}>
              <button className="check" aria-label="Erledigen" onClick={() => p.onToggleTask(t.id)}>
                <Circle size={22} />
              </button>
              <span>{t.title}</span>
            </div>
          ))}
          {open.length === 0 && <div className="wmuted">Alles erledigt</div>}
        </div>
      )}
      {sz.h >= 2 && (
        <div
          className="quick"
          style={{ marginTop: "auto", marginBottom: 0 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        >
          <div className="grow">
            <Input type="text" aria-label="Neue Aufgabe" placeholder="Neue Aufgabe …" value={text} onValueChange={setText} />
          </div>
          <Button icon={<Plus size={18} weight="bold" />} aria-label="Hinzufügen" onClick={add} />
        </div>
      )}
    </div>
  );
}

function RingsW({ p, sz }: { p: DashProps; sz: Sz }) {
  const focus = sumDays(p.log, 1);
  const done = p.tasks.filter((t) => t.done).length;
  const today = dayKey();
  const hDone = p.habits.filter((h) => h.days.includes(today)).length;
  const rings = [
    { label: "Fokus", val: `${formatMinutes(focus)} / ${formatMinutes(p.goal)}`, color: "#fa114f", p: p.goal > 0 ? focus / p.goal : 0 },
    { label: "Aufgaben", val: `${done} / ${p.tasks.length}`, color: "#92e82a", p: p.tasks.length > 0 ? done / p.tasks.length : 0 },
    { label: "Routinen", val: `${hDone} / ${p.habits.length}`, color: "#1eeaef", p: p.habits.length > 0 ? hDone / p.habits.length : 0 },
  ];
  return (
    <div className="w dark ringw">
      <RingSet rings={rings} stroke={11} />
      {sz.w >= 2 && (
        <div className="rw-leg">
          {rings.map((r) => (
            <div key={r.label}>
              <span style={{ color: r.color }}>{r.label}</span>
              <b>{r.val}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FocusW({ p, sz }: { p: DashProps; sz: Sz }) {
  const today = sumDays(p.log, 1);
  const pct = p.goal > 0 ? clamp(today / p.goal, 0, 1) : 0;
  const row = sz.w >= 2;
  const open = () => p.onPlan("focus");
  return (
    <Shell onOpen={row ? undefined : open} label="Fokus öffnen">
      <Head icon={Timer} label="Fokus" color="#ff9f0a" />
      <div className={`fw${row ? " row" : ""}`}>
        <RingSet rings={[{ p: pct, color: "#ff9f0a" }]} stroke={11}>
          <b className="fw-pct">{Math.round(pct * 100)}%</b>
        </RingSet>
        {row ? (
          <div className="fw-txt">
            <div className="wn">{formatMinutes(today)}</div>
            <div className="wmuted">Ziel {formatMinutes(p.goal)}</div>
            <Button icon={<Play size={18} weight="fill" />} onClick={open}>
              Starten
            </Button>
          </div>
        ) : null}
      </div>
      {sz.h >= 2 && (
        <div className="fw-chart">
          <FocusChart log={p.log} goal={p.goal} days={7} />
        </div>
      )}
    </Shell>
  );
}

function MusicW({ p, sz }: { p: DashProps; sz: Sz }) {
  const mu = p.music;
  const c = mu.current;
  const has = mu.tracks.length > 0;
  const row = sz.w >= 2 && sz.h === 1;
  const tall = sz.h >= 2;
  const small = !row && !tall;
  const progress = mu.duration > 0 ? mu.time / mu.duration : 0;
  const cover = mu.cover ? { backgroundImage: `url("${mu.cover}")` } : undefined;

  return (
    <div className={`w dark mw${small ? " s" : ""}`}>
      <div className="mw-bg" style={cover} />
      <div className="mw-shade" />
      {!has ? (
        <div className="mw-empty">
          <MusicNotes size={28} weight="fill" />
          <b>Musik</b>
          <Button onClick={p.onMusic}>Öffnen</Button>
        </div>
      ) : (
        <div className={`mw-in${row ? " row" : ""}${tall ? " tall" : ""}`}>
          {!small && (
            <button className="mw-cover" style={cover} onClick={p.onMusic} aria-label="Musik öffnen">
              {!mu.cover && <MusicNotes size={32} weight="fill" />}
            </button>
          )}
          <div className="mw-meta">
            <b>{c ? c.title : "Titel wählen"}</b>
            <span>{c ? c.artist || "Unbekannter Interpret" : `${mu.tracks.length} Titel`}</span>
          </div>
          {tall && (
            <div className="mw-bar">
              <i style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          <div className="mw-ctl">
            {!small && <Button icon={<SkipBack size={18} weight="fill" />} aria-label="Zurück" onClick={mu.prev} />}
            <Button
              icon={mu.playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
              aria-label={mu.playing ? "Pause" : "Abspielen"}
              onClick={mu.toggle}
            />
            {!small && <Button icon={<SkipForward size={18} weight="fill" />} aria-label="Weiter" onClick={() => mu.next()} />}
          </div>
        </div>
      )}
    </div>
  );
}

function StocksW({ p, sz }: { p: DashProps; sz: Sz }) {
  const items = [
    ...p.m.stocks.map((s) => ({ k: s, title: s, cur: "USD" })),
    ...p.m.coins.map((c) => ({ k: `c:${c}`, title: COINS[c]?.sym ?? c, cur: "EUR" })),
  ];
  const rows = items.flatMap((x) => {
    const q = p.m.quotes[x.k];
    return q ? [{ ...x, q }] : [];
  });
  const max = sz.h >= 2 ? sz.h * 3 - 1 : sz.w >= 2 ? 2 : 1;
  return (
    <div className="w">
      <Head icon={ChartLineUp} label="Aktien" color="#ff453a" />
      <div className="st-list">
        {rows.length === 0 && (
          <div className="wmuted" style={{ marginTop: 10 }}>
            Öffne Tools, dann Geld, um Kurse zu laden.
          </div>
        )}
        {rows.slice(0, max).map(({ k, title, cur, q }) => {
          const up = q.pct >= 0;
          return (
            <div className="st-row" key={k}>
              <b>{title}</b>
              {sz.w >= 2 && <Spark data={p.m.hist[k] ?? []} up={up} />}
              <div className="st-r">
                <b>{money(q.price, cur)}</b>
                <span className={`pill ${up ? "up" : "down"}`}>
                  {up ? "+" : ""}
                  {fmt(q.pct, 2)} %
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetW({ p, sz }: { p: DashProps; sz: Sz }) {
  const { income, spent } = summary(p.txns, monthKey(new Date()));
  const left = p.budget - spent;
  const pct = p.budget > 0 ? clamp(spent / p.budget, 0, 1) : 0;
  return (
    <div className="w">
      <Head icon={Wallet} label="Budget" color="#30d158" />
      <div className="wn bud" style={left < 0 ? { color: "var(--red)" } : undefined}>
        {money(left)}
      </div>
      <div className="wmuted">übrig im {new Date().toLocaleDateString("de-AT", { month: "long" })}</div>
      <div className="meter-bar" style={{ marginTop: "auto" }}>
        <i style={{ width: `${pct * 100}%`, background: left < 0 ? "var(--red)" : "var(--green)" }} />
      </div>
      {(sz.w >= 2 || sz.h >= 2) && (
        <div className="bud-f">
          <span>Einnahmen</span>
          <b>{money(income)}</b>
          <span>Ausgaben</span>
          <b>{money(spent)}</b>
        </div>
      )}
    </div>
  );
}

function WellW({ p, sz }: { p: DashProps; sz: Sz }) {
  const today = dayKey();
  const cur = p.well[today] ?? { water: 0, mood: 0 };
  const put = (patch: Partial<{ water: number; mood: number }>) => p.setWell({ ...p.well, [today]: { ...cur, ...patch } });
  const cups = Math.max(8, cur.water);
  return (
    <div className="w">
      <Head icon={Drop} label="Wasser" color="#0a84ff" right={<span>{cur.water * 250} ml</span>} />
      <div className="wl-row">
        <div className="wn">{cur.water}</div>
        <div className="wl-btn">
          <Button icon={<Minus size={16} weight="bold" />} aria-label="Weniger" onClick={() => put({ water: Math.max(0, cur.water - 1) })} />
          <Button icon={<Plus size={16} weight="bold" />} aria-label="Mehr" onClick={() => put({ water: cur.water + 1 })} />
        </div>
      </div>
      {sz.w >= 2 && (
        <div className="cups">
          {Array.from({ length: cups }, (_, i) => (
            <button
              key={i}
              className={`cup ${i < cur.water ? "on" : ""}`}
              aria-label={`Glas ${i + 1}`}
              aria-pressed={i < cur.water}
              onClick={() => put({ water: i + 1 === cur.water ? i : i + 1 })}
            >
              <Drop size={16} weight={i < cur.water ? "fill" : "regular"} />
            </button>
          ))}
        </div>
      )}
      {sz.h >= 2 && (
        <div className="moods" style={{ marginTop: "auto" }}>
          {MOODS.map((m, i) => (
            <button
              key={m}
              className={`mood ${cur.mood === i + 1 ? "on" : ""}`}
              aria-pressed={cur.mood === i + 1}
              onClick={() => put({ mood: cur.mood === i + 1 ? 0 : i + 1 })}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HabitsW({ p, sz }: { p: DashProps; sz: Sz }) {
  const today = dayKey();
  const done = p.habits.filter((h) => h.days.includes(today)).length;
  const best = p.habits.reduce((mx, h) => Math.max(mx, streakOf(h.days)), 0);
  const rows = sz.h === 1 ? (sz.w >= 2 ? 2 : 0) : sz.h * 3 - 1;
  return (
    <div className="w">
      <Head
        icon={Fire}
        label="Routinen"
        color="#ff9f0a"
        right={best > 0 ? <span className="badge">{best} Tage</span> : undefined}
      />
      <div className="hw-top">
        <div className="wn">
          {done}
          <small>/{p.habits.length}</small>
        </div>
      </div>
      {rows > 0 && (
        <div className="tw-list">
          {p.habits.slice(0, rows).map((h) => {
            const on = h.days.includes(today);
            return (
              <div className="tw-row" key={h.id}>
                <button className={`check ${on ? "done" : ""}`} aria-label={on ? "Als offen markieren" : "Erledigen"} onClick={() => p.onToggleHabit(h.id)}>
                  {on ? <CheckCircle size={22} weight="fill" /> : <Circle size={22} />}
                </button>
                <span className={on ? "dim" : ""}>{h.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotesW({ sz }: { sz: Sz }) {
  const [notes] = useStored<Note[]>("ios-notes", []);
  const sorted = [...notes].sort((a, b) => b.at - a.at);
  const first = sorted[0];
  const rows = sz.h >= 2 ? sz.h * 2 : 2;
  return (
    <div className="w">
      <Head icon={NotePencil} label="Notizen" color="#ffd60a" />
      {sz.w < 2 && sz.h < 2 ? (
        first ? (
          <div className="nw-one">
            <b>{noteTitle(first.text)}</b>
            <span>{notePreview(first.text) || "Kein weiterer Text"}</span>
          </div>
        ) : (
          <div className="wmuted" style={{ marginTop: 10 }}>
            Keine Notizen
          </div>
        )
      ) : (
        <div className="nw-list">
          {sorted.length === 0 && <div className="wmuted">Keine Notizen</div>}
          {sorted.slice(0, rows).map((n) => (
            <div className="nw-row" key={n.id}>
              <b>{noteTitle(n.text)}</b>
              <span>{notePreview(n.text) || "Kein weiterer Text"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Dashboard
   ========================================================= */

export function Dashboard(p: DashProps) {
  const [edit, setEdit] = useState(false);
  const [raw, setRaw] = useStored<Partial<Layout>>("ios-widgets2", {});

  const layout: Layout = {
    order: Array.isArray(raw.order) ? raw.order : [],
    hidden: Array.isArray(raw.hidden) ? raw.hidden : [],
    sizes: raw.sizes && typeof raw.sizes === "object" ? raw.sizes : {},
  };

  /* Stabile Funktionen: Widgets zeichnen sich nur neu, wenn sich ihre Daten ändern,
     nicht bei jedem Neuzeichnen der App (z. B. jede Sekunde durch die Musik). */
  const live = useRef(p);
  live.current = p;
  const stable = useMemo(
    () => ({
      onToggleTask: (id: number) => live.current.onToggleTask(id),
      onAddTask: (t: string) => live.current.onAddTask(t),
      onToggleHabit: (id: number) => live.current.onToggleHabit(id),
      setLists: (l: TodoList[]) => live.current.setLists(l),
      setWell: (w: Well) => live.current.setWell(w),
      onPlan: (id: string) => live.current.onPlan(id),
      onMoney: (v: MoneyView) => live.current.onMoney(v),
      onMusic: () => live.current.onMusic(),
      onSearch: () => live.current.onSearch(),
    }),
    [],
  );
  const pw: DashProps = { ...p, ...stable };

  const today = dayKey();
  const dateLabel = new Date().toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" });

  const defs: GridDef[] = [
    { id: "clock", deps: [], label: "Uhr", icon: ClockIcon, def: { w: 1, h: 1 }, min: { w: 1, h: 1 }, max: { w: 2, h: 2 }, node: (sz) => <ClockW sz={sz} /> },
    { id: "calendar", deps: [p.events], label: "Kalender", icon: CalendarBlank, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 4, h: 3 }, node: (sz) => <CalW events={p.events} sz={sz} /> },
    { id: "weather", deps: [], label: "Wetter", icon: CloudSun, def: { w: 2, h: 2 }, min: { w: 1, h: 1 }, max: { w: 4, h: 3 }, node: (sz) => <WeatherWidget sz={sz} /> },
    { id: "tasks", deps: [p.tasks], label: "Aufgaben", icon: ListChecks, def: { w: 2, h: 2 }, min: { w: 1, h: 1 }, max: { w: 3, h: 4 }, node: (sz) => <TasksW p={pw} sz={sz} /> },
    { id: "rings", deps: [p.log, p.goal, p.tasks, p.habits], label: "Aktivitätsringe", icon: Target, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 2 }, node: (sz) => <RingsW p={pw} sz={sz} /> },
    { id: "focus", deps: [p.log, p.goal], label: "Fokus", icon: Timer, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 }, node: (sz) => <FocusW p={pw} sz={sz} /> },
    { id: "music", deps: [p.music], label: "Musik", icon: MusicNotes, def: { w: 2, h: 2 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 }, node: (sz) => <MusicW p={pw} sz={sz} /> },
    { id: "budget", deps: [p.txns, p.budget], label: "Budget", icon: Wallet, def: { w: 1, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 2 }, node: (sz) => <BudgetW p={pw} sz={sz} /> },
    { id: "stocks", deps: [p.m], label: "Aktien", icon: ChartLineUp, def: { w: 2, h: 2 }, min: { w: 1, h: 1 }, max: { w: 3, h: 4 }, node: (sz) => <StocksW p={pw} sz={sz} /> },
    { id: "habits", deps: [p.habits], label: "Routinen", icon: Fire, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 }, node: (sz) => <HabitsW p={pw} sz={sz} /> },
    { id: "wellness", deps: [p.well], label: "Wasser & Stimmung", icon: Drop, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 2 }, node: (sz) => <WellW p={pw} sz={sz} /> },
    { id: "notes", deps: [], label: "Notizen", icon: NotePencil, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 }, node: (sz) => <NotesW sz={sz} /> },
    {
      id: "lists",
      deps: [p.lists],
      label: "Listen",
      icon: ListBullets,
      def: { w: 1, h: 2 },
      min: { w: 1, h: 2 },
      max: { w: 3, h: 4 },
      node: () => (
        <div className="w">
          <Head icon={ListBullets} label="Listen" color="#30d158" />
          <div style={{ marginTop: 8 }}>
            <ListGlance lists={p.lists} setLists={pw.setLists} />
          </div>
        </div>
      ),
    },
    {
      id: "calc",
      deps: [],
      label: "Schnellrechner",
      icon: Calculator,
      def: { w: 2, h: 1 },
      min: { w: 2, h: 1 },
      max: { w: 4, h: 2 },
      node: () => (
        <div className="w">
          <Head icon={Calculator} label="Rechner" color="#ff9f0a" />
          <div style={{ marginTop: 10 }}>
            <QuickCalc />
          </div>
        </div>
      ),
    },
    {
      id: "heat",
      deps: [p.log, p.habits, p.goal],
      label: "Aktivität",
      icon: Pulse,
      def: { w: 2, h: 2 },
      min: { w: 2, h: 2 },
      max: { w: 6, h: 3 },
      node: (sz) => (
        <div className="w">
          <Head icon={Pulse} label="Aktivität" color="#0a84ff" />
          <div style={{ marginTop: 12 }}>
            <Heatmap log={p.log} habitDays={p.habits.map((h) => h.days)} goal={p.goal} weeks={Math.min(26, sz.w * 8)} />
          </div>
        </div>
      ),
    },
    ...extraDefs(),
  ];

  const hiddenDefs = defs.filter((d) => layout.hidden.includes(d.id));
  const show = (id: string) => setRaw({ ...layout, hidden: layout.hidden.filter((x) => x !== id) });
  const openTasks = p.tasks.filter((t) => !t.done).length;
  const allHidden = hiddenDefs.length === defs.length;

  return (
    <div className="page">
      <header className="head">
        <div>
          <div className="eyebrow">{dateLabel}</div>
          <h1 className="large-title">
            {greeting()}, {p.name || "du"}
          </h1>
          <div className="eyebrow" style={{ marginTop: 6 }}>
            {openTasks === 0 ? "Keine offenen Aufgaben" : `${openTasks} offene ${openTasks === 1 ? "Aufgabe" : "Aufgaben"}`}
            {p.habits.length > 0 && ` · ${p.habits.filter((h) => h.days.includes(today)).length}/${p.habits.length} Routinen`}
          </div>
        </div>
        <div className="head-actions">
          <Button icon={<MagnifyingGlass size={18} weight="bold" />} aria-label="Suchen" onClick={pw.onSearch} />
          <Button
            icon={edit ? <Check size={18} weight="bold" /> : <SlidersHorizontal size={18} weight="bold" />}
            onClick={() => setEdit(!edit)}
          >
            {edit ? "Fertig" : "Anpassen"}
          </Button>
        </div>
      </header>

      {edit && (
        <div className="edit-panel">
          <div className="wmuted">
            Ziehe den weißen Bogen an der Ecke, um ein Widget zu vergrößern oder zu verkleinern. Halte ein Widget und
            ziehe es, um es zu verschieben. Mit dem Minus blendest du es aus.
          </div>
          <div className="chips-wrap" style={{ alignItems: "center" }}>
            {hiddenDefs.map((d) => (
              <button key={d.id} className="tag" onClick={() => show(d.id)}>
                <d.icon size={14} weight="fill" /> {d.label}
              </button>
            ))}
            <button className="link" onClick={() => setRaw({})}>
              Zurücksetzen
            </button>
          </div>
        </div>
      )}

      <WidgetGrid defs={defs} layout={layout} setLayout={setRaw} edit={edit} />

      {allHidden && (
        <div className="card">
          <div className="empty">Alle Widgets sind ausgeblendet. Tippe oben auf „Anpassen“, um sie zurückzuholen.</div>
        </div>
      )}
    </div>
  );
}