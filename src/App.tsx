import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentType, CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Button, Input, Menu, SegmentedControl, Slider, Switch, TabBar } from "glisse";
import {
  Bell,
  Calculator,
  CalendarBlank,
  CheckCircle,
  Circle,
  Copy,
  DownloadSimple,
  Fire,
  GearSix,
  House,
  ListChecks, 
  Lock,
  MagnifyingGlass,
  Moon,
  MusicNotes,
  Pause,
  PencilSimple,
  Play,
  Plus,
  PushPin,
  SquaresFour,
  Timer,
  Trash,
  UploadSimple,
  Wallet,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Appearance } from "./Appearance";
import { CalendarView } from "./Calendar";
import type { CalEvent } from "./Calendar";
import { Dashboard } from "./Dashboard";
import { DynamicIsland } from "./DynamicIsland";
import { FocusPanel, LockOverlay } from "./FocusUI";
import type { TimerApi } from "./FocusUI";
import {
  AREAS,
  DEFAULT_FOCUS,
  enterFullscreen,
  leaveFullscreen,
  runShortcut,
  useAmbient,
  useWakeLock,
} from "./focus";
import type { FocusCfg } from "./focus";
import { Hub, useWide } from "./Hub";
import { useMarket } from "./Market";
import { summary } from "./Money";
import type { MoneyView, Txn } from "./Money";
import { Music } from "./Music";
import { NotificationStack } from "./notifications";
import type { Push } from "./notifications";
import { Notes } from "./Notes";
import type { Note } from "./Notes";
import { useMusic } from "./player";
import { DEFAULT_BG, wallpaperVars } from "./theme";
import type { BgState } from "./theme";
import type { Habit, Task } from "./types";
import { Card, Group, InlineEdit, Ring, SettingRow } from "./ui";
import { Heatmap, ListsView } from "./Wellness";
import type { TodoList, Well } from "./Wellness";
import {
  beep,
  dayDate,
  dayKey,
  evaluate,
  fmt,
  formatMinutes,
  goalFromSlider,
  hourFromSlider,
  money,
  monthKey,
  num,
  pad,
  sliderFromGoal,
  sliderFromHour,
  streakOf,
  sumDays,
  uid,
  useStored,
} from "./lib";
import type { FocusLog } from "./lib";
import "./App.css";
import "./island.css";
import "./more.css";
import "./hub.css";
import "./mobile.css"; /* MUSS zuletzt stehen */

/* =========================================================
   Seiten nur neu zeichnen, wenn sich ihre Daten ändern.
   Funktionen werden ignoriert: Ändert sich der Zustand, den sie nutzen,
   ändern sich auch die Daten. Dadurch zeichnet z. B. der Sekundentakt von
   Timer oder Musik nicht mehr jede offene Seite neu.
   ========================================================= */

const isPlain = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;

function sameData(a: Record<string, unknown>, b: Record<string, unknown>, deep: boolean): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    const x = a[k];
    const y = b[k];
    if (typeof x === "function" && typeof y === "function") continue;
    if (Object.is(x, y)) continue;
    if (deep && isPlain(x) && isPlain(y) && sameData(x, y, false)) continue;
    return false;
  }
  return true;
}

function memoData<P extends object>(C: ComponentType<P>) {
  return memo(C, (a, b) => sameData(a as Record<string, unknown>, b as Record<string, unknown>, true));
}

const HubM = memoData(Hub);
const NotesM = memoData(Notes);
const CalendarViewM = memoData(CalendarView);
const ListsViewM = memoData(ListsView);
const FocusPanelM = memoData(FocusPanel);

/* =========================================================
   Typen & Konstanten
   ========================================================= */

type Theme = "dark" | "light";
type Cmd = { id: string; label: string; hint?: string; icon: ReactNode; run: () => void };

const TABS = ["home", "plan", "music", "tools", "settings"] as const;
type TabId = (typeof TABS)[number];

const NAV: { id: TabId; label: string; icon: Icon }[] = [
  { id: "home", label: "Heute", icon: House },
  { id: "plan", label: "Planer", icon: ListChecks },
  { id: "music", label: "Musik", icon: MusicNotes },
  { id: "tools", label: "Tools", icon: SquaresFour },
  { id: "settings", label: "Mehr", icon: GearSix },
];

const PLAN_IDS = ["tasks", "events", "lists", "habits", "focus", "notes"];

const initialTasks: Task[] = [
  { id: 1, title: "Dashboard fertig bauen", done: false, pinned: true },
  { id: 2, title: "Webseite für Kunden prüfen", done: false, pinned: false },
  { id: 3, title: "Rechnungen schreiben", done: true, pinned: false },
];

const initialHabits: Habit[] = [
  { id: 1, name: "Wasser trinken", days: [] },
  { id: 2, name: "Sport", days: [] },
  { id: 3, name: "Lesen", days: [] },
];

const initialLists: TodoList[] = [{ id: 1, name: "Einkauf", items: [] }];

/* =========================================================
   Suche (Strg/⌘ + K)
   ========================================================= */

function Palette({
  commands,
  search,
  onAdd,
  onTxn,
  onClose,
}: {
  commands: Cmd[];
  search: (q: string) => Cmd[];
  onAdd: (title: string) => void;
  onTxn: (kind: "in" | "out", amount: number, note: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => wrap.current?.querySelector("input")?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

  const list = useMemo(() => {
    const raw = q.trim();
    const s = raw.toLowerCase();

    const calc: Cmd[] = [];
    if (s && /\d/.test(s) && /[+\-*/^%×÷]/.test(s)) {
      try {
        const v = evaluate(raw);
        calc.push({
          id: "calc",
          label: `= ${fmt(v, 10)}   (Enter kopiert)`,
          icon: <Calculator size={20} />,
          run: () => {
            navigator.clipboard?.writeText(String(Number(v.toPrecision(12)))).catch(() => {});
          },
        });
      } catch {
        /* keine gültige Rechnung */
      }
    }

    /* "-12,50 Kaffee" bucht eine Ausgabe, "+1500 Gehalt" eine Einnahme */
    const txn: Cmd[] = [];
    const tx = /^([-+])\s*([\d.,]+)\s*(.*)$/.exec(raw);
    if (tx) {
      const amt = num(tx[2] ?? "");
      if (amt > 0) {
        const kind = tx[1] === "+" ? "in" : "out";
        const note = (tx[3] ?? "").trim();
        txn.push({
          id: "txn",
          label: `${kind === "in" ? "Einnahme" : "Ausgabe"} buchen: ${money(amt)}${note ? ` · ${note}` : ""}`,
          icon: <Wallet size={20} />,
          run: () => onTxn(kind, amt, note),
        });
      }
    }

    const add: Cmd[] = s
      ? [
          {
            id: "add",
            label: `Aufgabe hinzufügen: „${raw}“`,
            icon: <Plus size={20} weight="bold" />,
            run: () => onAdd(raw),
          },
        ]
      : [];
    const base = commands.filter((c) => c.label.toLowerCase().includes(s));
    return [...calc, ...txn, ...add, ...base, ...(s ? search(s) : [])];
  }, [q, commands, search, onAdd, onTxn]);

  const active = Math.min(idx, Math.max(list.length - 1, 0));

  return (
    <div
      className="pal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="pal"
        ref={wrap}
        role="dialog"
        aria-label="Suche"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIdx((active + 1) % Math.max(list.length, 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIdx((active - 1 + list.length) % Math.max(list.length, 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const item = list[active];
            if (item) {
              item.run();
              onClose();
            }
          }
        }}
      >
        <Input
          type="search"
          aria-label="Suche"
          placeholder="Suchen, rechnen, Musik, „-12 Kaffee“ buchen …"
          icon={<MagnifyingGlass size={18} weight="bold" />}
          value={q}
          onValueChange={(v: string) => {
            setQ(v);
            setIdx(0);
          }}
        />
        <div className="pal-list">
          {list.length === 0 && <div className="empty">Nichts gefunden</div>}
          {list.map((c, i) => (
            <button
              key={c.id}
              className={`pal-item ${i === active ? "on" : ""}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                c.run();
                onClose();
              }}
            >
              {c.icon}
              <span>{c.label}</span>
              {c.hint && <span className="kbd">{c.hint}</span>}
            </button>
          ))}
        </div>
        <div className="pal-foot">
          <span>↑↓ wählen</span>
          <span>↵ ausführen</span>
          <span>esc schließen</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   App
   ========================================================= */

export default function App() {
  const [storedTab, setTab] = useStored<string>("ios-tab", "home");
  const tab: TabId = (TABS as readonly string[]).includes(storedTab)
    ? (storedTab as TabId)
    : storedTab === "money" || storedTab === "market"
      ? "tools"
      : "home";
  const [plan, setPlan] = useStored<string>("ios-plan", "tasks");
  const [moneyView, setMoneyView] = useStored<MoneyView>("ios-money-view", "budget");
  const [hubOpen, setHubOpen] = useStored<string[]>("ios-hub-open", []);
  const wide = useWide();

  const [filter, setFilter] = useState("all");

  const [tasks, setTasks] = useStored<Task[]>("ios-tasks", initialTasks);
  const [habits, setHabits] = useStored<Habit[]>("ios-habits", initialHabits);
  const [notes, setNotes] = useStored<Note[]>("ios-notes", []);
  const [events, setEvents] = useStored<CalEvent[]>("ios-events", []);
  const [txns, setTxns] = useStored<Txn[]>("ios-txns", []);
  const [lists, setLists] = useStored<TodoList[]>("ios-lists", initialLists);
  const [well, setWell] = useStored<Well>("ios-well", {});
  const [budget, setBudget] = useStored("ios-budget", 1500);
  const [log, setLog] = useStored<FocusLog>("ios-focus-log", {});
  const [sessions, setSessions] = useStored<Record<string, number>>("ios-sessions", {});
  const [name, setName] = useStored("ios-name", "Endrit");
  const [theme, setTheme] = useStored<Theme>("ios-theme", "dark");
  const [cards, setCards] = useStored<"solid" | "glass">("ios-cards", "solid");
  const [goal, setGoal] = useStored("ios-goal", 120);
  const [notifications, setNotifications] = useStored("ios-notifications", true);
  const [haptics, setHaptics] = useStored("ios-haptics", true);
  const [volume, setVolume] = useStored("ios-volume", 65);
  const [islandOn, setIslandOn] = useStored("ios-island", true);
  const [banners, setBanners] = useStored("ios-banners", true);
  const [reminderOn, setReminderOn] = useStored("ios-reminder-on", true);
  const [reminderHour, setReminderHour] = useStored("ios-reminder-hour", 18);
  const [lastReminder, setLastReminder] = useStored("ios-last-reminder", "");
  const [eventRem, setEventRem] = useStored("ios-event-rem", true);
  const [notified, setNotified] = useStored<string[]>("ios-event-notified", []);

  /* Fokus-Einstellungen und Hintergrund (mit Standardwerten für neue Felder) */
  const [cfgStored, setCfg] = useStored<FocusCfg>("ios-focus-cfg", DEFAULT_FOCUS);
  const cfg = useMemo<FocusCfg>(() => ({ ...DEFAULT_FOCUS, ...cfgStored }), [cfgStored]);
  const [bgStored, setBg] = useStored<BgState>("ios-bg", DEFAULT_BG);
  const bg = useMemo<BgState>(() => ({ ...DEFAULT_BG, ...bgStored }), [bgStored]);
  const [bgImage, setBgImage] = useStored("ios-bg-image", "");

  const [query, setQuery] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newHabit, setNewHabit] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [taskId, setTaskId] = useState<number | null>(null);

  /* Benachrichtigungen: Island-Warteschlange oder Banner */
  const [pushes, setPushes] = useState<Push[]>([]);
  const [alerts, setAlerts] = useState<Push[]>([]);

  /* Timer */
  const [minutes, setMinutes] = useState(25);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60);
  const [round, setRound] = useState(1);
  const [distractions, setDistractions] = useState(0);
  const endAt = useRef(0);
  const grace = useRef(0);

  const today = dayKey();
  const phaseMinutes = phase === "focus" ? minutes : cfg.breakMin;
  const total = phaseMinutes * 60;
  const timerActive = running || remaining < total;
  const sessionLock = cfg.lock && phase === "focus" && timerActive;

  const areaLabel = (id: string) => AREAS.find((a) => a.id === id)?.label ?? id;
  const isBlocked = useCallback(
    (id: string) => sessionLock && cfg.blocked.includes(id),
    [sessionLock, cfg.blocked],
  );

  /* ---------- Benachrichtigungen ---------- */

  const systemNotify = useCallback(
    (title: string, body: string) => {
      if (
        notifications &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        new Notification(title, { body });
      }
    },
    [notifications],
  );

  /** Ist die Island an, erscheinen alle Meldungen dort. Sonst als Banner. */
  const push = useCallback(
    (p: Omit<Push, "id"> & { force?: boolean }) => {
      const { force, ...item } = p;
      if (sessionLock && item.kind !== "focus" && !force) return;
      systemNotify(item.title, item.body);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (islandOn) {
        setAlerts((list) => [...list, { ...item, id }].slice(-4));
        return;
      }
      if (!banners) return;
      setPushes((list) => [{ ...item, id }, ...list].slice(0, 3));
    },
    [sessionLock, islandOn, banners, systemNotify],
  );

  const alert = alerts[0] ?? null;
  const alertId = alert?.id ?? "";
  useEffect(() => {
    if (!alertId) return;
    const t = window.setTimeout(() => setAlerts((l) => l.filter((x) => x.id !== alertId)), 4800);
    return () => window.clearTimeout(t);
  }, [alertId]);
  useEffect(() => {
    if (!islandOn) setAlerts([]);
  }, [islandOn]);

  const denyLocked = useCallback(
    (id: string) =>
      push({
        kind: "focus",
        title: "Im Fokus gesperrt",
        body: `${areaLabel(id)} ist gesperrt, bis die Session endet.`,
        tab: "focus",
      }),
    [push],
  );

  const go = useCallback(
    (next: TabId) => {
      if (isBlocked(next)) {
        denyLocked(next);
        return;
      }
      setTab(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [isBlocked, denyLocked, setTab],
  );

  const goPlan = useCallback(
    (id: string) => {
      if (isBlocked(id) || isBlocked("plan")) {
        denyLocked(id);
        return;
      }
      setPlan(id);
      setTab("plan");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [isBlocked, denyLocked, setPlan, setTab],
  );

  /** Öffnet das Geld-Tool in der Tools-Zentrale. */
  const goMoney = useCallback(
    (v: MoneyView) => {
      if (isBlocked("tools") || isBlocked("money")) {
        denyLocked("tools");
        return;
      }
      setMoneyView(v);
      setHubOpen(wide ? (hubOpen.includes("money") ? hubOpen : [...hubOpen, "money"].slice(-4)) : ["money"]);
      setTab("tools");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [isBlocked, denyLocked, wide, hubOpen, setMoneyView, setHubOpen, setTab],
  );

  const dismissPush = useCallback((id: string) => {
    setPushes((list) => list.filter((x) => x.id !== id));
  }, []);

  const openPush = useCallback(
    (p: Push) => {
      dismissPush(p.id);
      setAlerts((l) => l.filter((x) => x.id !== p.id));
      const t = p.tab;
      if (!t) return;
      if (PLAN_IDS.includes(t)) goPlan(t);
      else if (t === "market") goMoney("watch");
      else if (t === "budget") goMoney("budget");
      else if ((TABS as readonly string[]).includes(t)) go(t as TabId);
    },
    [dismissPush, go, goPlan, goMoney],
  );

  /* Musik */
  const notifyMusic = useCallback(
    (title: string, body: string) => push({ kind: "system", title, body, force: true }),
    [push],
  );
  const music = useMusic(notifyMusic);

  /* Markt-Daten (laden nur, wenn sie gebraucht werden) */
  const m = useMarket(tab === "home" || tab === "tools", push);

  /* Theme für Seite und Glisse */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  /* Beginnt eine Sperre, werden gesperrte Bereiche sofort verlassen */
  useEffect(() => {
    if (!sessionLock) return;
    if (cfg.blocked.includes(tab)) setTab("plan");
    if (cfg.blocked.includes(plan)) setPlan("focus");
  }, [sessionLock, cfg.blocked, tab, plan, setTab, setPlan]);

  /* Tastatur: Strg/⌘ + K öffnet die Suche, 1 bis 5 wechselt die Tabs */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((o) => !o);
        return;
      }
      if (palette) return;
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = NAV[Number(e.key) - 1];
      if (target) go(target.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, palette]);

  /* Licht, das der Maus über den Karten folgt */
  const spot = useRef<{ el: HTMLElement; x: number; y: number } | null>(null);
  const spotRaf = useRef(0);
  const onSpot = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return; /* Am Handy gibt es kein Maus-Licht */
    const el = (e.target as HTMLElement).closest<HTMLElement>(".spot");
    if (!el) return;
    spot.current = { el, x: e.clientX, y: e.clientY };
    if (spotRaf.current) return;
    spotRaf.current = requestAnimationFrame(() => {
      spotRaf.current = 0;
      const s = spot.current;
      if (!s) return;
      const r = s.el.getBoundingClientRect();
      s.el.style.setProperty("--mx", `${s.x - r.left}px`);
      s.el.style.setProperty("--my", `${s.y - r.top}px`);
    });
  };

  /* ---------- Timer ---------- */

  const finish = useCallback(() => {
    beep(volume);
    if (haptics && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);

    if (phase === "focus") {
      const key = dayKey();
      const before = log[key] ?? 0;
      setLog((l) => ({ ...l, [key]: (l[key] ?? 0) + minutes }));
      setSessions((s) => ({ ...s, [key]: (s[key] ?? 0) + 1 }));
      leaveFullscreen();

      if (cfg.cycles) {
        const next = cfg.breakMin * 60;
        setPhase("break");
        setRemaining(next);
        endAt.current = Date.now() + next * 1000;
        setRunning(true);
      } else {
        setRunning(false);
        setRemaining(minutes * 60);
      }

      push({
        kind: "focus",
        title: cfg.cycles ? "Zeit für eine Pause" : "Fokus geschafft",
        body: `${minutes} Min · ${distractions > 0 ? `${distractions} Ablenkungen` : "ohne Ablenkung"}`,
        tab: "focus",
        force: true,
      });

      if (before < goal && before + minutes >= goal) {
        push({
          kind: "goal",
          title: "Tagesziel erreicht",
          body: `${formatMinutes(before + minutes)} fokussiert. Stark!`,
          tab: "home",
          force: true,
        });
      }
    } else {
      const next = minutes * 60;
      setPhase("focus");
      setRemaining(next);
      setDistractions(0);
      setRound((r) => r + 1);
      if (cfg.cycles) {
        endAt.current = Date.now() + next * 1000;
        setRunning(true);
      } else setRunning(false);
      push({ kind: "focus", title: "Pause vorbei", body: "Weiter geht’s mit der nächsten Runde.", tab: "focus", force: true });
    }
  }, [volume, haptics, phase, log, minutes, cfg.cycles, cfg.breakMin, distractions, goal, push, setLog, setSessions]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.ceil((endAt.current - Date.now()) / 1000);
      if (left <= 0) finish();
      else setRemaining(left);
    }, 250);
    return () => window.clearInterval(id);
  }, [running, finish]);

  const mm = pad(Math.floor(Math.max(remaining, 0) / 60));
  const ss = pad(Math.max(remaining, 0) % 60);

  useEffect(() => {
    document.title = running ? `${mm}:${ss} · ${phase === "focus" ? "Fokus" : "Pause"}` : "Mein Dashboard";
  }, [running, mm, ss, phase]);

  const startTimer = () => {
    const fresh = !timerActive;
    endAt.current = Date.now() + remaining * 1000;
    setRunning(true);
    if (fresh && phase === "focus") {
      setDistractions(0);
      if (cfg.lock && cfg.fullscreen) enterFullscreen();
      if (cfg.lock && cfg.shortcutAuto) {
        grace.current = Date.now() + 15000;
        runShortcut(cfg.shortcutOn);
      }
    }
  };
  const pauseTimer = () => setRunning(false);
  const resetTimer = () => {
    setRunning(false);
    setPhase("focus");
    setRemaining(minutes * 60);
    setRound(1);
    leaveFullscreen();
  };
  const changeMinutes = (v: number) => {
    if (timerActive) return;
    setMinutes(v);
    setRemaining(v * 60);
  };

  /* Ablenkungen zählen, wenn du während der Sperre den Tab verlässt */
  useEffect(() => {
    if (!sessionLock) return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (!hiddenAt) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = 0;
      if (Date.now() < grace.current || away < 2000) return;
      setDistractions((d) => d + 1);
      push({
        kind: "focus",
        title: "Du warst abgelenkt",
        body: `Du warst ${Math.round(away / 1000)} s weg. Zurück zum Fokus!`,
        tab: "focus",
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [sessionLock, push]);

  /* Im strengen Modus warnt der Browser vor dem Schließen */
  useEffect(() => {
    if (!(sessionLock && cfg.strict)) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [sessionLock, cfg.strict]);

  useWakeLock(cfg.wake && running);
  useAmbient(cfg.ambient, cfg.ambientVol, running && phase === "focus");

  const timer: TimerApi = {
    mm,
    ss,
    progress: 1 - remaining / total,
    running,
    active: timerActive,
    phase,
    minutes,
    round,
    distractions,
    locked: sessionLock,
    start: startTimer,
    pause: pauseTimer,
    reset: resetTimer,
    setMinutes: changeMinutes,
  };

  const onNotifications = (value: boolean) => {
    setNotifications(value);
    if (value && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  /* Aufgaben */
  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    setTasks((t) => [{ id: Date.now(), title, done: false, pinned: false }, ...t]);
    setNewTask("");
  };
  const addTaskTitle = (title: string) =>
    setTasks((t) => [{ id: Date.now(), title, done: false, pinned: false }, ...t]);
  const toggleTask = (id: number) => {
    const target = tasks.find((x) => x.id === id);
    if (!target) return;
    const next = tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
    setTasks(next);
    if (!target.done && next.length > 0 && next.every((x) => x.done)) {
      push({ kind: "task", title: "Alles erledigt", body: "Alle Aufgaben sind abgehakt.", tab: "tasks" });
    }
  };
  const pinTask = (id: number) =>
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)));
  const removeTask = (id: number) => setTasks((t) => t.filter((x) => x.id !== id));
  const duplicateTask = (id: number) =>
    setTasks((t) => {
      const src = t.find((x) => x.id === id);
      return src ? [{ ...src, id: Date.now(), pinned: false, done: false }, ...t] : t;
    });

  /* Routinen */
  const addHabit = () => {
    const n = newHabit.trim();
    if (!n) return;
    setHabits((h) => [...h, { id: Date.now(), name: n, days: [] }]);
    setNewHabit("");
  };
  const toggleHabit = (id: number) => {
    const target = habits.find((h) => h.id === id);
    if (!target) return;
    const completing = !target.days.includes(today);
    const next = habits.map((h) =>
      h.id === id
        ? { ...h, days: completing ? [...h.days, today] : h.days.filter((d) => d !== today) }
        : h,
    );
    setHabits(next);
    if (completing && next.length > 0 && next.every((h) => h.days.includes(today))) {
      push({
        kind: "habit",
        title: "Alle Routinen geschafft",
        body: "Starker Tag. Die Serie läuft weiter.",
        tab: "habits",
      });
    }
  };
  const removeHabit = (id: number) => setHabits((h) => h.filter((x) => x.id !== id));

  const saveTitle = (key: string, value: string) => {
    setEditing(null);
    const t = value.trim();
    if (!t) return;
    const [kind, idStr] = key.split("-");
    const id = Number(idStr);
    if (kind === "t") setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, title: t } : x)));
    else setHabits((hs) => hs.map((x) => (x.id === id ? { ...x, name: t } : x)));
  };

  /* Buchungen mit Budget-Warnung bei 80 % und 100 % */
  const addTxn = useCallback(
    (t: Txn) => {
      setTxns((prev) => [t, ...prev]);
      if (t.kind !== "out" || budget <= 0) return;
      const mk = t.date.slice(0, 7);
      if (mk !== monthKey(new Date())) return;
      const before = summary(txns, mk).spent;
      const after = before + t.amount;
      if (before <= budget && after > budget) {
        push({
          kind: "goal",
          title: "Budget überschritten",
          body: `${money(after)} von ${money(budget)} ausgegeben.`,
          tab: "budget",
        });
      } else if (before < budget * 0.8 && after >= budget * 0.8) {
        push({
          kind: "system",
          title: "80 % des Budgets erreicht",
          body: `${money(after)} von ${money(budget)} ausgegeben.`,
          tab: "budget",
        });
      }
    },
    [txns, budget, push, setTxns],
  );

  const quickTxn = (kind: "in" | "out", amount: number, note: string) =>
    addTxn({ id: uid(), kind, amount, cat: kind === "in" ? "income" : "other", note, date: dayKey() });

  /* Termin-Erinnerung: 10 Minuten vorher */
  useEffect(() => {
    if (!eventRem) return;
    const check = () => {
      const now = Date.now();
      const fresh: string[] = [];
      for (const e of events) {
        if (!e.time) continue;
        const diff = new Date(`${e.date}T${e.time}`).getTime() - now;
        const tag = `${e.id}-${e.date}`;
        if (diff <= 10 * 60000 && diff > -5 * 60000 && !notified.includes(tag)) {
          fresh.push(tag);
          const mins = Math.max(Math.round(diff / 60000), 0);
          push({
            kind: "system",
            title: e.title,
            body: mins > 0 ? `Beginnt in ${mins} Min` : "Beginnt jetzt",
            tab: "events",
          });
        }
      }
      if (fresh.length > 0) setNotified([...notified, ...fresh].slice(-100));
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => window.clearInterval(id);
  }, [events, eventRem, notified, push, setNotified]);

  /* Tägliche Erinnerung (die App muss dafür im Browser geöffnet sein) */
  const reminded = useRef(lastReminder);
  useEffect(() => {
    if (!reminderOn) return;
    const check = () => {
      const key = dayKey();
      if (reminded.current === key) return;
      if (new Date().getHours() < reminderHour) return;
      reminded.current = key;
      setLastReminder(key);

      const openHabits = habits.filter((h) => !h.days.includes(key)).length;
      const openTasks = tasks.filter((t) => !t.done).length;
      if (openHabits === 0 && openTasks === 0) return;

      const parts: string[] = [];
      if (openHabits > 0) parts.push(`${openHabits} ${openHabits === 1 ? "Routine" : "Routinen"}`);
      if (openTasks > 0) parts.push(`${openTasks} ${openTasks === 1 ? "Aufgabe" : "Aufgaben"}`);
      push({
        kind: "habit",
        title: "Noch etwas offen",
        body: `Heute fehlen noch ${parts.join(" und ")}.`,
        tab: openHabits > 0 ? "habits" : "tasks",
      });
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => window.clearInterval(id);
  }, [reminderOn, reminderHour, habits, tasks, push, setLastReminder]);

  /* Vorschau */
  const testPush = () =>
    push({
      kind: "system",
      title: "Test-Benachrichtigung",
      body: islandOn ? "So sieht eine Meldung in der Island aus." : "Ziehe mich nach oben, um mich zu schließen.",
      force: true,
    });

  /* Daten (der Finnhub-Key und das Hintergrundbild werden absichtlich nicht exportiert) */
  const exportData = () => {
    const data = {
      name,
      tasks,
      habits,
      notes,
      events,
      txns,
      lists,
      well,
      budget,
      focusLog: log,
      goal,
      positions: m.positions,
      stocks: m.stocks,
      coins: m.coins,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dashboard-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const d = JSON.parse(await file.text());
        if (Array.isArray(d.tasks)) setTasks(d.tasks);
        if (Array.isArray(d.habits)) setHabits(d.habits);
        if (Array.isArray(d.notes)) setNotes(d.notes);
        if (Array.isArray(d.events)) setEvents(d.events);
        if (Array.isArray(d.txns)) setTxns(d.txns);
        if (Array.isArray(d.lists)) setLists(d.lists);
        if (d.well && typeof d.well === "object") setWell(d.well);
        if (Array.isArray(d.positions)) m.setPositions(d.positions);
        if (Array.isArray(d.stocks)) m.setStocks(d.stocks);
        if (Array.isArray(d.coins)) m.setCoins(d.coins);
        if (d.focusLog && typeof d.focusLog === "object") setLog(d.focusLog);
        if (typeof d.name === "string") setName(d.name);
        if (typeof d.goal === "number") setGoal(d.goal);
        if (typeof d.budget === "number") setBudget(d.budget);
        push({ kind: "system", title: "Backup geladen", body: "Deine Daten wurden importiert.", force: true });
      } catch {
        push({ kind: "system", title: "Import fehlgeschlagen", body: "Die Datei ist kein gültiges Backup.", force: true });
      }
    };
    input.click();
  };

  /* ---------- Abgeleitete Werte ---------- */
  const visibleTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) &&
          (filter === "all" || (filter === "open" ? !t.done : t.done)),
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [tasks, query, filter]);

  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.length - openTasks.length;
  const upcomingEvents = events.filter((e) => e.date >= today).length;
  const openListItems = lists.reduce((s, l) => s + l.items.filter((i) => !i.done).length, 0);

  const habitsDone = habits.filter((h) => h.days.includes(today)).length;
  const bestStreak = habits.reduce((mx, h) => Math.max(mx, streakOf(h.days)), 0);
  const focusToday = sumDays(log, 1);

  const w = (value: TabId) => (tab === value ? "fill" : "regular");
  const timerProgress = 1 - remaining / total;

  const planEyebrow =
    plan === "tasks"
      ? `${openTasks.length} offen · ${doneTasks} erledigt`
      : plan === "events"
        ? `${upcomingEvents} anstehend`
        : plan === "lists"
          ? `${openListItems} offene Einträge`
          : plan === "habits"
            ? `${habitsDone} von ${habits.length} heute geschafft`
            : plan === "focus"
              ? `Heute: ${formatMinutes(focusToday)}`
              : `${notes.length} ${notes.length === 1 ? "Notiz" : "Notizen"}`;
  const planTitle =
    plan === "tasks"
      ? "Aufgaben"
      : plan === "events"
        ? "Termine"
        : plan === "lists"
          ? "Listen"
          : plan === "habits"
            ? "Routinen"
            : plan === "focus"
              ? "Fokus"
              : "Notizen";

  /* Hintergrund und Design */
  const showImage = bg.mode === "image" && bgImage !== "";
  const appStyle = {
    ...(bg.accent !== DEFAULT_BG.accent ? { "--accent": bg.accent } : {}),
    "--ga": theme === "dark" ? 0.03 + (bg.glass / 100) * 0.2 : 0.3 + (bg.glass / 100) * 0.5,
  } as CSSProperties;

  /* ---------- Menüs ---------- */
  const taskMenu = (t: Task) => [
    { label: t.pinned ? "Lösen" : "Anheften", icon: <PushPin size={18} />, onSelect: () => pinTask(t.id) },
    { label: "Umbenennen", icon: <PencilSimple size={18} />, onSelect: () => setEditing(`t-${t.id}`) },
    { label: "Duplizieren", icon: <Copy size={18} />, onSelect: () => duplicateTask(t.id) },
    "separator" as const,
    { label: "Löschen", icon: <Trash size={18} />, onSelect: () => removeTask(t.id), destructive: true },
  ];

  const habitMenu = (h: Habit) => [
    { label: "Umbenennen", icon: <PencilSimple size={18} />, onSelect: () => setEditing(`h-${h.id}`) },
    "separator" as const,
    { label: "Löschen", icon: <Trash size={18} />, onSelect: () => removeHabit(h.id), destructive: true },
  ];

  /* ---------- Suche ---------- */
  const commands: Cmd[] = [
    ...NAV.map((n, i) => ({
      id: `go-${n.id}`,
      label: `Gehe zu ${n.label}`,
      hint: String(i + 1),
      icon: <n.icon size={20} />,
      run: () => go(n.id),
    })),
    { id: "event", label: "Neuer Termin", icon: <CalendarBlank size={20} />, run: () => goPlan("events") },
    { id: "lists", label: "Einkaufsliste öffnen", icon: <ListChecks size={20} />, run: () => goPlan("lists") },
    { id: "focus", label: "Fokus öffnen", icon: <Timer size={20} />, run: () => goPlan("focus") },
    { id: "expense", label: "Ausgabe oder Einnahme buchen", icon: <Wallet size={20} />, run: () => goMoney("budget") },
    { id: "music", label: "Musik öffnen", icon: <MusicNotes size={20} />, run: () => go("music") },
    {
      id: "music-toggle",
      label: music.playing ? "Musik pausieren" : "Musik abspielen",
      icon: music.playing ? <Pause size={20} /> : <Play size={20} />,
      run: music.toggle,
    },
    {
      id: "timer",
      label: running ? "Fokus pausieren" : "Fokus starten",
      icon: running ? <Pause size={20} /> : <Play size={20} />,
      run: running ? pauseTimer : startTimer,
    },
    {
      id: "lock",
      label: cfg.lock ? "Fokus-Sperre ausschalten" : "Fokus-Sperre einschalten",
      icon: <Lock size={20} />,
      run: () => {
        if (!sessionLock) setCfg({ ...cfg, lock: !cfg.lock });
      },
    },
    {
      id: "theme",
      label: theme === "dark" ? "Helles Design" : "Dunkles Design",
      icon: <Moon size={20} />,
      run: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    { id: "test", label: "Test-Benachrichtigung", icon: <Bell size={20} />, run: testPush },
  ];

  const searchTasks = (s: string): Cmd[] =>
    tasks
      .filter((t) => t.title.toLowerCase().includes(s))
      .slice(0, 5)
      .map((t) => ({
        id: `task-${t.id}`,
        label: `${t.done ? "Wieder öffnen" : "Erledigen"}: ${t.title}`,
        icon: t.done ? <Circle size={20} /> : <CheckCircle size={20} />,
        run: () => toggleTask(t.id),
      }));

  const searchMusic = (s: string): Cmd[] =>
    music.tracks
      .flatMap((t, i) => (`${t.title} ${t.artist}`.toLowerCase().includes(s) ? [{ t, i }] : []))
      .slice(0, 4)
      .map(({ t, i }) => ({
        id: `track-${t.id}`,
        label: `Abspielen: ${t.title}${t.artist ? ` · ${t.artist}` : ""}`,
        icon: <MusicNotes size={20} />,
        run: () => music.play(i),
      }));

  /* Island: Musik-Daten */
  const islandMusic = music.current
    ? {
        title: music.current.title,
        artist: music.current.artist,
        cover: music.cover,
        playing: music.playing,
        progress: music.duration > 0 ? music.time / music.duration : 0,
      }
    : null;

  /* =========================================================
     Render
     ========================================================= */
  return (
    <div className="app" data-theme={theme} data-cards={cards} style={appStyle}>
      {/* Hintergrund, den das Glas bricht */}
      <div className="wallpaper" data-glisse-backdrop aria-hidden="true" style={wallpaperVars(bg, theme)}>
        {showImage ? (
          <div
            className="wp-img"
            style={{ backgroundImage: `url(${bgImage})`, filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined }}
          />
        ) : (
          <>
            <div className="blob b1" />
            <div className="blob b2" />
            <div className="blob b3" />
            <div className="blob b4" />
          </>
        )}
        <div className="wp-dim" style={{ opacity: bg.dim / 100 }} />
      </div>

      <DynamicIsland
        enabled={islandOn}
        timer={{ active: timerActive, running, time: `${mm}:${ss}`, progress: timerProgress, minutes: phaseMinutes }}
        music={islandMusic}
        alert={alert}
        onAlertOpen={openPush}
        onPlay={startTimer}
        onPause={pauseTimer}
        onReset={resetTimer}
        onMusicToggle={music.toggle}
        onMusicNext={() => music.next()}
        onMusicPrev={music.prev}
      />
      <NotificationStack items={pushes} onDismiss={dismissPush} onOpen={openPush} />

      <main className="main" onPointerMove={onSpot}>
        <div className="content">
          {/* ---------- HEUTE ---------- */}
          {tab === "home" && (
            <Dashboard
              key="home"
              name={name}
              log={log}
              goal={goal}
              tasks={tasks}
              onToggleTask={toggleTask}
              onAddTask={addTaskTitle}
              habits={habits}
              onToggleHabit={toggleHabit}
              events={events}
              lists={lists}
              setLists={setLists}
              well={well}
              setWell={setWell}
              music={music}
              txns={txns}
              budget={budget}
              m={m}
              onPlan={goPlan}
              onMoney={goMoney}
              onMusic={() => go("music")}
              onSearch={() => setPalette(true)}
            />
          )}

          {/* ---------- PLANER ---------- */}
          {tab === "plan" && (
            <div className="page" key="plan">
              <header className="head">
                <div>
                  <div className="eyebrow">{planEyebrow}</div>
                  <h1 className="large-title">{planTitle}</h1>
                </div>
                <div className="seg wider">
                  <SegmentedControl
                    aria-label="Bereich"
                    items={[
                      { value: "tasks", label: "Aufgaben" },
                      { value: "events", label: "Termine" },
                      { value: "lists", label: "Listen" },
                      { value: "habits", label: "Routinen" },
                      { value: "focus", label: "Fokus" },
                      { value: "notes", label: "Notizen" },
                    ]}
                    value={plan}
                    onValueChange={(v: string) => goPlan(v)}
                  />
                </div>
              </header>

              {/* Aufgaben */}
              {plan === "tasks" && (
                <div className="split" key="p-tasks">
                  <div className="col">
                    <div
                      className="toolbar"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addTask();
                      }}
                    >
                      <div className="grow">
                        <Input
                          type="text"
                          aria-label="Neue Aufgabe"
                          placeholder="Neue Aufgabe …"
                          value={newTask}
                          onValueChange={setNewTask}
                        />
                      </div>
                      <Button icon={<Plus size={20} weight="bold" />} aria-label="Hinzufügen" onClick={addTask} />
                    </div>

                    <div className="toolbar stack">
                      <div className="grow">
                        <Input
                          type="search"
                          aria-label="Suchen"
                          placeholder="Aufgaben durchsuchen"
                          icon={<MagnifyingGlass size={18} weight="bold" />}
                          value={query}
                          onValueChange={setQuery}
                        />
                      </div>
                      <div className="seg filter">
                        <SegmentedControl
                          aria-label="Filter"
                          items={[
                            { value: "all", label: "Alle" },
                            { value: "open", label: "Offen" },
                            { value: "done", label: "Fertig" },
                          ]}
                          value={filter}
                          onValueChange={setFilter}
                        />
                      </div>
                    </div>

                    <div className="card spot list" style={{ marginTop: 16 }}>
                      {visibleTasks.length === 0 && <div className="empty">Nichts gefunden</div>}
                      {visibleTasks.map((t) => (
                        <div className="row" key={t.id}>
                          <button
                            className={`check ${t.done ? "done" : ""}`}
                            aria-label={t.done ? "Als offen markieren" : "Als erledigt markieren"}
                            onClick={() => toggleTask(t.id)}
                          >
                            {t.done ? <CheckCircle size={26} weight="fill" /> : <Circle size={26} />}
                          </button>
                          <div className="row-main">
                            {editing === `t-${t.id}` ? (
                              <InlineEdit
                                value={t.title}
                                onSave={(v) => saveTitle(`t-${t.id}`, v)}
                                onCancel={() => setEditing(null)}
                              />
                            ) : (
                              <div className={`row-title ${t.done ? "done" : ""}`}>
                                {t.pinned && (
                                  <PushPin
                                    size={14}
                                    weight="fill"
                                    style={{ marginRight: 6, opacity: 0.6, verticalAlign: "-1px" }}
                                  />
                                )}
                                {t.title}
                              </div>
                            )}
                          </div>
                          <Menu aria-label="Optionen" items={taskMenu(t)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <aside className="split-side">
                    <Card title="Übersicht">
                      <Ring
                        className="mini-ring"
                        progress={tasks.length > 0 ? doneTasks / tasks.length : 0}
                        stroke={8}
                      >
                        <span className="ring-pct">
                          {tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0}%
                        </span>
                      </Ring>
                      <div className="facts">
                        <div className="fact">
                          <span>Offen</span>
                          <b>{openTasks.length}</b>
                        </div>
                        <div className="fact">
                          <span>Erledigt</span>
                          <b>{doneTasks}</b>
                        </div>
                        <div className="fact">
                          <span>Angeheftet</span>
                          <b>{tasks.filter((t) => t.pinned).length}</b>
                        </div>
                      </div>
                    </Card>
                    <Card title="Tipp">
                      {/* Am Computer: Tastenkürzel. Am Handy: Hinweis auf die Suche. */}
                      <p className="tip desktop-only">
                        Mit <span className="kbd">Strg</span> <span className="kbd">K</span> findest du alles sofort,
                        rechnest, startest Musik oder bucht mit <b>-12,50 Kaffee</b> direkt eine Ausgabe.
                      </p>
                      <p className="tip mobile-only">
                        Über die Suche auf der Startseite findest du alles sofort, rechnest, startest Musik oder
                        buchst mit <b>-12,50 Kaffee</b> direkt eine Ausgabe.
                      </p>
                    </Card>
                  </aside>
                </div>
              )}

              {/* Termine */}
              {plan === "events" && <CalendarViewM events={events} setEvents={setEvents} />}

              {/* Listen */}
              {plan === "lists" && <ListsViewM lists={lists} setLists={setLists} />}

              {/* Routinen */}
              {plan === "habits" && (
                <div className="split" key="p-habits">
                  <div className="col">
                    <div
                      className="toolbar"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addHabit();
                      }}
                    >
                      <div className="grow">
                        <Input
                          type="text"
                          aria-label="Neue Routine"
                          placeholder="Neue Routine …"
                          value={newHabit}
                          onValueChange={setNewHabit}
                        />
                      </div>
                      <Button icon={<Plus size={20} weight="bold" />} aria-label="Hinzufügen" onClick={addHabit} />
                    </div>

                    {habits.length === 0 && (
                      <div className="card spot" style={{ marginTop: 16 }}>
                        <div className="empty">Lege deine erste Routine an</div>
                      </div>
                    )}

                    <div className="hgrid stagger">
                      {habits.map((h) => {
                        const done = h.days.includes(today);
                        const streak = streakOf(h.days);
                        return (
                          <div className={`card spot hcard ${done ? "done" : ""}`} key={h.id}>
                            <div className="hcard-top">
                              <button
                                className={`check ${done ? "done" : ""}`}
                                aria-label={done ? "Als offen markieren" : "Als erledigt markieren"}
                                onClick={() => toggleHabit(h.id)}
                              >
                                {done ? <CheckCircle size={34} weight="fill" /> : <Circle size={34} />}
                              </button>
                              <div className="row-main">
                                {editing === `h-${h.id}` ? (
                                  <InlineEdit
                                    value={h.name}
                                    onSave={(v) => saveTitle(`h-${h.id}`, v)}
                                    onCancel={() => setEditing(null)}
                                  />
                                ) : (
                                  <div className="row-title">{h.name}</div>
                                )}
                                <div className="row-sub">
                                  {streak > 0 ? (
                                    <span className="badge">
                                      <Fire size={14} weight="fill" />
                                      {streak} {streak === 1 ? "Tag" : "Tage"} Serie
                                    </span>
                                  ) : (
                                    "Noch keine Serie"
                                  )}
                                </div>
                              </div>
                              <Menu aria-label="Optionen" items={habitMenu(h)} />
                            </div>
                            <div className="dots" aria-label="Letzte 7 Tage">
                              {[6, 5, 4, 3, 2, 1, 0].map((o) => (
                                <div className="dotcol" key={o}>
                                  <span
                                    className={`dot ${h.days.includes(dayKey(o)) ? "on" : ""} ${o === 0 ? "today" : ""}`}
                                  />
                                  <em>{dayDate(o).toLocaleDateString("de-AT", { weekday: "narrow" })}</em>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <aside className="split-side">
                    <Card title="Heute">
                      <Ring
                        className="mini-ring"
                        progress={habits.length > 0 ? habitsDone / habits.length : 0}
                        stroke={8}
                      >
                        <span className="ring-pct">
                          {habitsDone}/{habits.length}
                        </span>
                      </Ring>
                      <div className="facts">
                        <div className="fact">
                          <span>Beste Serie</span>
                          <b>{bestStreak} Tage</b>
                        </div>
                        <div className="fact">
                          <span>Routinen</span>
                          <b>{habits.length}</b>
                        </div>
                      </div>
                    </Card>
                    <Card title="Aktivität">
                      <Heatmap log={log} habitDays={habits.map((h) => h.days)} goal={goal} weeks={12} />
                    </Card>
                  </aside>
                </div>
              )}

              {/* Fokus */}
              {plan === "focus" && (
                <FocusPanelM
                  t={timer}
                  cfg={cfg}
                  setCfg={setCfg}
                  tasks={tasks}
                  taskId={taskId}
                  setTaskId={setTaskId}
                  log={log}
                  goal={goal}
                  sessionsToday={sessions[today] ?? 0}
                />
              )}

              {/* Notizen */}
              {plan === "notes" && <NotesM notes={notes} setNotes={setNotes} />}
            </div>
          )}

          {/* ---------- MUSIK ---------- */}
          {tab === "music" && <Music p={music} />}

          {/* ---------- TOOLS ---------- */}
          {tab === "tools" && (
            <HubM
              m={m}
              open={hubOpen}
              setOpen={setHubOpen}
              moneyView={moneyView}
              setMoneyView={setMoneyView}
              txns={txns}
              setTxns={setTxns}
              budget={budget}
              setBudget={setBudget}
              onAdd={addTxn}
            />
          )}

          {/* ---------- MEHR / EINSTELLUNGEN ---------- */}
          {tab === "settings" && (
            <div className="page" key="settings">
              <header className="head">
                <div>
                  <div className="eyebrow">Alles bleibt lokal auf diesem Gerät</div>
                  <h1 className="large-title">Einstellungen</h1>
                </div>
              </header>

              <div className="cols">
                <div className="col">
                  <Group title="Profil">
                    <div className="row">
                      <div className="row-main">
                        <Input type="text" aria-label="Name" placeholder="Dein Name" value={name} onValueChange={setName} />
                      </div>
                    </div>
                  </Group>

                  <section className="group">
                    <h2 className="group-title">Hintergrund & Design</h2>
                    <Appearance bg={bg} setBg={setBg} image={bgImage} setImage={setBgImage} />
                  </section>

                  <Group title="Darstellung">
                    <SettingRow title="Dunkles Design" sub="Wechselt zwischen Dark und Light">
                      <Switch
                        aria-label="Dunkles Design"
                        checked={theme === "dark"}
                        onCheckedChange={(v: boolean) => setTheme(v ? "dark" : "light")}
                      />
                    </SettingRow>
                    <div className="row row-col">
                      <div className="row-head">
                        <div className="row-title">Kartenstil</div>
                        <span className="muted-sm">{cards === "solid" ? "Fest" : "Glas"}</span>
                      </div>
                      <SegmentedControl
                        aria-label="Kartenstil"
                        items={[
                          { value: "solid", label: "Fest" },
                          { value: "glass", label: "Glas" },
                        ]}
                        value={cards}
                        onValueChange={(v: string) => setCards(v === "glass" ? "glass" : "solid")}
                      />
                    </div>
                    <SettingRow title="Dynamic Island" sub="Zeigt Timer, Musik und alle Meldungen oben an">
                      <Switch aria-label="Dynamic Island" checked={islandOn} onCheckedChange={setIslandOn} />
                    </SettingRow>
                  </Group>

                  <Group title="Musik">
                    <SettingRow
                      title="Musikordner"
                      sub={music.dirName ? `${music.dirName} · ${music.tracks.length} Titel` : "Noch keiner gewählt"}
                    >
                      <Button onClick={() => go("music")}>Öffnen</Button>
                      {music.dirName !== "" && <Button onClick={music.forget}>Vergessen</Button>}
                    </SettingRow>
                  </Group>

                  <Group title="Markt">
                    <div className="row row-col">
                      <div className="row-head">
                        <div className="row-title">Finnhub API-Key</div>
                        <span className="muted-sm">{m.key ? "gespeichert" : "fehlt"}</span>
                      </div>
                      <Input
                        type="text"
                        aria-label="Finnhub API-Key"
                        placeholder="Key von finnhub.io einfügen"
                        value={m.key}
                        onValueChange={m.setKey}
                      />
                      <div className="row-sub">Nötig für Aktienkurse. Krypto, Währungen und Wetter laufen ohne Key.</div>
                    </div>
                  </Group>
                </div>

                <div className="col">
                  <Group title="Fokus">
                    <div className="row row-col">
                      <div className="row-head">
                        <div className="row-title">Tagesziel</div>
                        <span className="muted-sm">{formatMinutes(goal)}</span>
                      </div>
                      <Slider
                        aria-label="Tagesziel"
                        value={sliderFromGoal(goal)}
                        onValueChange={(v: number) => setGoal(goalFromSlider(v))}
                      />
                    </div>
                    <div className="row row-col">
                      <div className="row-head">
                        <div className="row-title">Timer-Lautstärke</div>
                        <span className="muted-sm">{volume}%</span>
                      </div>
                      <Slider aria-label="Lautstärke" value={volume} onValueChange={setVolume} />
                    </div>
                  </Group>

                  <Group title="Benachrichtigungen">
                    <SettingRow title="Banner in der App" sub="Nur wenn die Dynamic Island aus ist">
                      <Switch aria-label="Banner" checked={banners} onCheckedChange={setBanners} />
                    </SettingRow>
                    <SettingRow title="Systemmeldungen" sub="Wenn der Tab im Hintergrund ist">
                      <Switch aria-label="Systemmeldungen" checked={notifications} onCheckedChange={onNotifications} />
                    </SettingRow>
                    <SettingRow title="Haptik" sub="Vibration am Handy">
                      <Switch aria-label="Haptik" checked={haptics} onCheckedChange={setHaptics} />
                    </SettingRow>
                    <SettingRow title="Termin-Erinnerung" sub="10 Minuten vor Beginn">
                      <Switch aria-label="Termin-Erinnerung" checked={eventRem} onCheckedChange={setEventRem} />
                    </SettingRow>
                    <SettingRow title="Tägliche Erinnerung" sub="Wenn Routinen oder Aufgaben offen sind">
                      <Switch aria-label="Tägliche Erinnerung" checked={reminderOn} onCheckedChange={setReminderOn} />
                    </SettingRow>
                    {reminderOn && (
                      <div className="row row-col">
                        <div className="row-head">
                          <div className="row-title">Uhrzeit</div>
                          <span className="muted-sm">{pad(reminderHour)}:00 Uhr</span>
                        </div>
                        <Slider
                          aria-label="Erinnerungs-Uhrzeit"
                          value={sliderFromHour(reminderHour)}
                          onValueChange={(v: number) => setReminderHour(hourFromSlider(v))}
                        />
                      </div>
                    )}
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <div className="row-main" style={{ minWidth: 140 }}>
                        <div className="row-title">Vorschau</div>
                        <div className="row-sub">Schickt eine Test-Meldung</div>
                      </div>
                      <Button icon={<Bell size={18} weight="bold" />} onClick={testPush}>
                        Testen
                      </Button>
                    </div>
                  </Group>

                  <Group title="Daten">
                    <SettingRow title="Daten verwalten" sub="Backup, aufräumen oder zurücksetzen">
                      <Menu
                        aria-label="Daten"
                        items={[
                          { label: "Backup exportieren", icon: <DownloadSimple size={18} />, onSelect: exportData },
                          { label: "Backup importieren", icon: <UploadSimple size={18} />, onSelect: importData },
                          {
                            label: "Erledigte löschen",
                            icon: <CheckCircle size={18} />,
                            onSelect: () => setTasks((t) => t.filter((x) => !x.done)),
                          },
                          "separator",
                          {
                            label: "Alles zurücksetzen",
                            icon: <Trash size={18} />,
                            destructive: true,
                            onSelect: () => {
                              if (window.confirm("Wirklich alles zurücksetzen?")) {
                                setTasks(initialTasks);
                                setHabits(initialHabits);
                                setLists(initialLists);
                                setNotes([]);
                                setEvents([]);
                                setTxns([]);
                                setWell({});
                                setLog({});
                                setSessions({});
                                m.setPositions([]);
                              }
                            },
                          },
                        ]}
                      />
                    </SettingRow>
                  </Group>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =============== TAB BAR =============== */}
      {/* Per Portal direkt in <body>: So hängt das Dock immer am sichtbaren
          Bildschirmrand und nie am Ende der (längeren) Seite. */}
      {createPortal(
        <div className="dock-root" data-theme={theme} data-cards={cards} style={appStyle}>
          <nav className="tabbar" aria-label="Hauptnavigation">
            <TabBar
              aria-label="Hauptnavigation"
              items={NAV.map((n) => ({
                value: n.id,
                label: n.label,
                icon: isBlocked(n.id) ? <Lock size={24} weight="fill" /> : <n.icon size={24} weight={w(n.id)} />,
              }))}
              value={tab}
              onValueChange={(v: string) => go(v as TabId)}
              style={{ "--lg-lens-grow-x": "27px", "--lg-lens-grow-y": "20px" } as CSSProperties}
            />
          </nav>
        </div>,
        document.body,
      )}

      {/* =============== VOLLBILD-SPERRE =============== */}
      {sessionLock && cfg.overlay && (
        <LockOverlay
          t={timer}
          cfg={cfg}
          setCfg={setCfg}
          taskTitle={tasks.find((x) => x.id === taskId)?.title ?? ""}
          onQuit={resetTimer}
        />
      )}

      {palette && (
        <Palette
          commands={commands}
          search={(s) => [...searchTasks(s), ...searchMusic(s)]}
          onAdd={addTaskTitle}
          onTxn={quickTxn}
          onClose={() => setPalette(false)}
        />
      )}
    </div>
  );
}