import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowCounterClockwise,
  CalendarDots,
  Cake,
  Cards,
  CreditCard,
  Flag,
  Globe,
  Hourglass,
  Moon,
  Pause,
  Play,
  Watch,
  UsersThree,
  Wind,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { CalEvent } from "./Calendar";
import { Breathe, wakeTimes } from "./Health";
import { dueCount, monthly, nextDue } from "./Life";
import type { Deck, Sub } from "./Life";
import { nextBday, settle } from "./People";
import type { Bday, Group } from "./People";
import { dayKey, money } from "./lib";
import { clock, clockMs, elapsedMs, leftSec, quick, useNow, useQuick } from "./quick";
import type { GridDef, Sz } from "./WidgetGrid";
import "./widgets2.css";
import "./tools2.css";

function read<T>(key: string, init: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : init;
  } catch {
    return init;
  }
}
/** Liest gespeicherte Daten, ohne sie zu überschreiben. */
function useRead<T>(key: string, init: T): T {
  const [v] = useState(() => read(key, init));
  return v;
}

function WHead({ icon: I, label, color, right }: { icon: Icon; label: string; color: string; right?: ReactNode }) {
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

/* ---------- Timer ---------- */
function TimerW({ sz }: { sz: Sz }) {
  const q = useQuick();
  const now = useNow(250, q.timers.length > 0);
  const rows = sz.h >= 2 ? 3 : 1;
  const presets = sz.w >= 2 ? [1, 5, 10, 15] : [5];
  return (
    <div className="w">
      <WHead icon={Hourglass} label="Timer" color="#ffd60a" />
      <div className="tmw-list">
        {q.timers.slice(0, rows).map((t) => {
          const run = t.endAt !== null;
          return (
            <div className={`tmw-row${t.done ? " done" : ""}`} key={t.id}>
              <div className="tmw-t">
                <b>{t.done ? "Fertig" : clock(leftSec(t, now))}</b>
                <span>{t.label}</span>
              </div>
              <button
                className="tmw-b"
                aria-label={t.done ? "Zurücksetzen" : run ? "Pause" : "Weiter"}
                onClick={() => (t.done ? quick.reset(t.id) : run ? quick.pause(t.id) : quick.resume(t.id))}
              >
                {t.done ? <ArrowCounterClockwise size={16} weight="bold" /> : run ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="tmw-presets">
        {presets.map((m) => (
          <button className="tag" key={m} onClick={() => quick.add("Timer", m * 60)}>
            {m} min
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Stoppuhr ---------- */
const startLabel = (acc: number) => (acc > 0 ? "Weiter" : "Start");

function WatchW({ sz }: { sz: Sz }) {
  const q = useQuick();
  const now = useNow(100, q.sw.running);
  const sw = q.sw;
  return (
    <div className="w">
      <WHead icon={Watch} label="Stoppuhr" color="#30d158" />
      <div className="wn sww">{clockMs(elapsedMs(sw, now))}</div>
      <div className="tmw-presets">
        <button className="tag on" onClick={sw.running ? quick.swPause : quick.swStart}>
          {sw.running ? "Stopp" : startLabel(sw.acc)}
        </button>
        {sz.w >= 2 && sw.running && (
          <button className="tag" onClick={quick.swLap}>
            <Flag size={12} weight="bold" /> Runde
          </button>
        )}
        {sw.on && !sw.running && (
          <button className="tag" onClick={quick.swReset}>
            Zurück
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Abos ---------- */
function SubsW({ sz }: { sz: Sz }) {
  const subs = useRead<Sub[]>("ios-subs", []);
  const list = subs.map((s) => ({ s, due: nextDue(s) })).sort((a, b) => a.due.getTime() - b.due.getTime());
  const perMonth = subs.reduce((t, s) => t + monthly(s), 0);
  const rows = sz.h >= 2 ? 3 : sz.w >= 2 ? 2 : 1;
  return (
    <div className="w">
      <WHead icon={CreditCard} label="Abos" color="#bf5af2" />
      <div className="wn bud">{money(perMonth)}</div>
      <div className="wmuted">pro Monat</div>
      <div className="sbw-list">
        {list.slice(0, rows).map(({ s, due }) => (
          <div className="sbw-row" key={s.id}>
            <span>{s.name}</span>
            <em>{due.toLocaleDateString("de-AT", { day: "numeric", month: "short" })}</em>
            <b>{money(s.price)}</b>
          </div>
        ))}
        {subs.length === 0 && <div className="wmuted">Noch keine Abos</div>}
      </div>
    </div>
  );
}

/* ---------- Countdown ---------- */
type Cd = { id: number; name: string; date: string };
function CountdownW() {
  const items = useRead<Cd[]>("ios-countdowns", []);
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const withDays = items
    .map((c) => ({ c, n: Math.round((new Date(`${c.date}T00:00:00`).getTime() - t0.getTime()) / 86400000) }))
    .sort((a, b) => a.n - b.n);
  const pick = withDays.find((x) => x.n >= 0) ?? withDays[withDays.length - 1];
  return (
    <div className="w">
      <WHead icon={Flag} label="Countdown" color="#ff375f" />
      {pick ? (
        <div className="cdw">
          <div className="wn">{Math.abs(pick.n)}</div>
          <div className="wmuted">{pick.n === 0 ? "heute" : pick.n > 0 ? (pick.n === 1 ? "Tag bis" : "Tage bis") : "Tage seit"}</div>
          <b>{pick.c.name}</b>
        </div>
      ) : (
        <div className="wmuted" style={{ marginTop: 10 }}>
          Lege unter Tools, dann Extras, einen Countdown an.
        </div>
      )}
    </div>
  );
}

/* ---------- Monatskalender ---------- */
function MonthW() {
  const events = useRead<CalEvent[]>("ios-events", []);
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
  const evDays = new Set(events.filter((e) => e.date.startsWith(prefix)).map((e) => Number(e.date.slice(8))));
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  return (
    <div className="w">
      <div className="mc-head">
        {d.toLocaleDateString("de-AT", { month: "long" })} <span>{y}</span>
      </div>
      <div className="mc-grid">
        {["M", "D", "M", "D", "F", "S", "S"].map((l, i) => (
          <span className="mc-dow" key={`d${i}`}>
            {l}
          </span>
        ))}
        {cells.map((c, i) =>
          c === null ? (
            <span key={`b${i}`} />
          ) : (
            <span key={c} className={`mc-d${c === d.getDate() ? " today" : ""}${evDays.has(c) ? " ev" : ""}`}>
              {c}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- Weltzeit ---------- */
const ZONES: [string, string][] = [
  ["Wien", "Europe/Vienna"],
  ["New York", "America/New_York"],
  ["Tokio", "Asia/Tokyo"],
  ["Sydney", "Australia/Sydney"],
];
function WorldW({ sz }: { sz: Sz }) {
  const now = useNow(15000);
  const n = sz.h >= 2 ? 4 : sz.w >= 2 ? 3 : 2;
  return (
    <div className="w">
      <WHead icon={Globe} label="Weltzeit" color="#40c8e0" />
      <div className="wd-list">
        {ZONES.slice(0, n).map(([city, tz]) => (
          <div className="wd-row" key={tz}>
            <span>{city}</span>
            <b>{new Date(now).toLocaleTimeString("de-AT", { timeZone: tz, hour: "2-digit", minute: "2-digit" })}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Karteikarten ---------- */
function CardsW() {
  const decks = useRead<Deck[]>("ios-decks", []);
  const due = dueCount(decks, dayKey());
  const total = decks.reduce((s, d) => s + d.cards.length, 0);
  return (
    <div className="w">
      <WHead icon={Cards} label="Lernen" color="#ff9f0a" />
      <div className="cdw">
        <div className="wn">{due}</div>
        <div className="wmuted">{due === 1 ? "Karte fällig" : "Karten fällig"}</div>
        <b>{total} insgesamt</b>
      </div>
    </div>
  );
}

/* ---------- Atmen ---------- */
function BreatheW({ sz }: { sz: Sz }) {
  return (
    <div className="w">
      <WHead icon={Wind} label="Atmen" color="#40c8e0" />
      <div className="brw">
        <Breathe small={sz.w < 2 && sz.h < 2} />
      </div>
    </div>
  );
}

/* ---------- Geburtstage ---------- */
function BirthdaysW({ sz }: { sz: Sz }) {
  const items = useRead<Bday[]>("ios-bdays", []);
  const list = items.map((b) => ({ b, n: nextBday(b) })).sort((a, c) => a.n.days - c.n.days);
  const rows = sz.h >= 2 ? 4 : sz.w >= 2 ? 2 : 1;
  return (
    <div className="w">
      <WHead icon={Cake} label="Geburtstage" color="#ff375f" />
      <div className="sbw-list">
        {list.slice(0, rows).map(({ b, n }) => (
          <div className="sbw-row" key={b.id}>
            <span>{b.name}</span>
            <em>{n.age > 0 ? `wird ${n.age}` : ""}</em>
            <b>{n.days === 0 ? "heute" : n.days === 1 ? "morgen" : `in ${n.days} T`}</b>
          </div>
        ))}
        {items.length === 0 && <div className="wmuted">Lege unter Tools, dann Geburtstage, welche an.</div>}
      </div>
    </div>
  );
}

/* ---------- Schlaf ---------- */
function SleepW({ sz }: { sz: Sz }) {
  const now = useNow(30000);
  const times = wakeTimes(now);
  const show = sz.w >= 2 ? times : times.slice(1, 3);
  return (
    <div className="w">
      <WHead icon={Moon} label="Schlaf" color="#5e5ce6" />
      <div className="wmuted" style={{ marginTop: 8 }}>
        Wenn du jetzt einschläfst, wach auf um:
      </div>
      <div className="sbw-list">
        {show.map((t) => (
          <div className="sbw-row" key={t}>
            <b style={{ fontSize: 20, fontWeight: 300 }}>{t}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Teilen ---------- */
function SplitW({ sz }: { sz: Sz }) {
  const groups = useRead<Group[]>("ios-split", []);
  const g = groups.find((x) => x.exps.length > 0) ?? groups[0];
  const pays = g ? settle(g) : [];
  const nm = (id: number) => g?.people.find((p) => p.id === id)?.name ?? "?";
  const rows = sz.h >= 2 ? 5 : sz.w >= 2 ? 2 : 1;
  return (
    <div className="w">
      <WHead icon={UsersThree} label="Teilen" color="#5e5ce6" right={g ? <span>{g.name}</span> : undefined} />
      <div className="sbw-list">
        {pays.slice(0, rows).map((p, i) => (
          <div className="sbw-row" key={i}>
            <span>
              {nm(p.from)} → {nm(p.to)}
            </span>
            <b>{money(p.amount)}</b>
          </div>
        ))}
        {g && pays.length === 0 && <div className="wmuted">Alles ausgeglichen</div>}
        {!g && <div className="wmuted">Lege unter Tools, dann Teilen, eine Gruppe an.</div>}
      </div>
    </div>
  );
}

let defsCache: GridDef[] | null = null;
export function extraDefs(): GridDef[] {
  return (defsCache ??= [
    { id: "timer", label: "Timer", icon: Hourglass, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 }, node: (sz) => <TimerW sz={sz} /> },
    { id: "watch", label: "Stoppuhr", icon: Watch, def: { w: 1, h: 1 }, min: { w: 1, h: 1 }, max: { w: 2, h: 2 }, node: (sz) => <WatchW sz={sz} /> },
    { id: "subs", label: "Abos", icon: CreditCard, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 }, node: (sz) => <SubsW sz={sz} /> },
    { id: "countdown", label: "Countdown", icon: Flag, def: { w: 1, h: 1 }, min: { w: 1, h: 1 }, max: { w: 2, h: 2 }, node: () => <CountdownW /> },
    { id: "month", label: "Monatskalender", icon: CalendarDots, def: { w: 2, h: 2 }, min: { w: 2, h: 2 }, max: { w: 3, h: 3 }, node: () => <MonthW /> },
    { id: "world", label: "Weltzeit", icon: Globe, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 2 }, node: (sz) => <WorldW sz={sz} /> },
    { id: "cards", label: "Karteikarten", icon: Cards, def: { w: 1, h: 1 }, min: { w: 1, h: 1 }, max: { w: 2, h: 2 }, node: () => <CardsW /> },
    { id: "breathe", label: "Atmen", icon: Wind, def: { w: 1, h: 1 }, min: { w: 1, h: 1 }, max: { w: 2, h: 2 }, node: (sz) => <BreatheW sz={sz} /> },
    { id: "birthdays", label: "Geburtstage", icon: Cake, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 }, node: (sz) => <BirthdaysW sz={sz} /> },
    { id: "sleep", label: "Schlaf", icon: Moon, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 2, h: 2 }, node: (sz) => <SleepW sz={sz} /> },
    { id: "split", label: "Teilen", icon: UsersThree, def: { w: 2, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 }, node: (sz) => <SplitW sz={sz} /> },
  ]);
}