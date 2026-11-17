import { useCallback, useSyncExternalStore } from "react";

export type Countdown = { id: number; label: string; total: number; endAt: number | null; left: number; done: boolean };
export type Watch = { on: boolean; running: boolean; startAt: number; acc: number; laps: number[] };
export type QuickState = { timers: Countdown[]; sw: Watch };

const KEY = "ios-quick";
const NEW_SW: Watch = { on: false, running: false, startAt: 0, acc: 0, laps: [] };

function load(): QuickState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<QuickState>;
      return { timers: Array.isArray(p.timers) ? p.timers : [], sw: { ...NEW_SW, ...(p.sw ?? {}) } };
    }
  } catch {
    /* kaputter Speicher: neu starten */
  }
  return { timers: [], sw: NEW_SW };
}

let state: QuickState = load();
const subs = new Set<() => void>();
let ticker = 0;

const p2 = (n: number) => String(n).padStart(2, "0");

export const leftSec = (t: Countdown, now: number) =>
  t.endAt !== null ? Math.max(0, Math.ceil((t.endAt - now) / 1000)) : t.left;

export const elapsedMs = (w: Watch, now: number) => w.acc + (w.running ? Math.max(0, now - w.startAt) : 0);

export const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${p2(m)}:${p2(s % 60)}` : `${p2(m)}:${p2(s % 60)}`;
};

export const clockMs = (ms: number) => {
  const t = Math.max(0, ms);
  return `${p2(Math.floor(t / 60000))}:${p2(Math.floor(t / 1000) % 60)}.${p2(Math.floor(t / 10) % 100)}`;
};

/** Der Timer, der in der Island angezeigt wird: der nächste ablaufende, sonst ein pausierter. */
export function activeCd(s: QuickState): Countdown | null {
  const act = s.timers.filter((t) => !t.done && (t.endAt !== null || t.left < t.total));
  const running = act.filter((t) => t.endAt !== null).sort((a, b) => (a.endAt ?? 0) - (b.endAt ?? 0));
  return running[0] ?? act[0] ?? null;
}

function volume() {
  try {
    const v = Number(JSON.parse(localStorage.getItem("ios-volume") ?? "65"));
    return Number.isFinite(v) ? v : 65;
  } catch {
    return 65;
  }
}

function ring(label: string) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const peak = Math.max((volume() / 100) * 0.45, 0.0001);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.38;
      o.frequency.value = 988;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.32);
    }
  } catch {
    /* Audio nicht verfügbar */
  }
  try {
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification("Timer abgelaufen", { body: label });
    }
  } catch {
    /* nicht unterstützt */
  }
}

function tick() {
  const now = Date.now();
  const fired: Countdown[] = [];
  const timers = state.timers.map((t) => {
    if (t.endAt !== null && t.endAt <= now) {
      const f: Countdown = { ...t, endAt: null, left: 0, done: true };
      fired.push(f);
      return f;
    }
    return t;
  });
  if (fired.length === 0) return;
  set({ ...state, timers });
  ring(fired.map((t) => t.label).join(", "));
}

function schedule() {
  const need = state.timers.some((t) => t.endAt !== null);
  if (need && ticker === 0) ticker = window.setInterval(tick, 250);
  else if (!need && ticker !== 0) {
    window.clearInterval(ticker);
    ticker = 0;
  }
}

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Speicher voll */
  }
  subs.forEach((f) => f());
  schedule();
}

function set(next: QuickState) {
  state = next;
  emit();
}

const upd = (id: number, fn: (t: Countdown) => Countdown) =>
  set({ ...state, timers: state.timers.map((t) => (t.id === id ? fn(t) : t)) });

export const quick = {
  add(label: string, sec: number) {
    const total = Math.round(sec);
    if (!(total > 0) || total > 86400) return;
    const t: Countdown = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      label: label.trim() || "Timer",
      total,
      endAt: Date.now() + total * 1000,
      left: total,
      done: false,
    };
    set({ ...state, timers: [...state.timers, t] });
  },
  pause(id: number) {
    upd(id, (t) =>
      t.endAt === null ? t : { ...t, left: Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)), endAt: null },
    );
  },
  resume(id: number) {
    upd(id, (t) => {
      if (t.done || t.endAt !== null) return t;
      const left = t.left > 0 ? t.left : t.total;
      return { ...t, left, endAt: Date.now() + left * 1000 };
    });
  },
  reset(id: number) {
    upd(id, (t) => ({ ...t, endAt: null, left: t.total, done: false }));
  },
  extend(id: number, sec: number) {
    upd(id, (t) =>
      t.endAt !== null
        ? { ...t, endAt: t.endAt + sec * 1000, total: t.total + sec }
        : { ...t, left: t.left + sec, total: t.total + sec, done: false },
    );
  },
  remove(id: number) {
    set({ ...state, timers: state.timers.filter((t) => t.id !== id) });
  },
  swStart() {
    set({ ...state, sw: { ...state.sw, on: true, running: true, startAt: Date.now() } });
  },
  swPause() {
    const s = state.sw;
    if (!s.running) return;
    set({ ...state, sw: { ...s, running: false, acc: s.acc + Date.now() - s.startAt } });
  },
  swLap() {
    const s = state.sw;
    set({ ...state, sw: { ...s, laps: [...s.laps, elapsedMs(s, Date.now())] } });
  },
  swReset() {
    set({ ...state, sw: NEW_SW });
  },
};

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function useQuick(): QuickState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/* Ein gemeinsamer Takt pro Intervall: egal wie viele Widgets die Zeit brauchen,
   es läuft nur ein Timer, und im Hintergrund-Tab wird nichts neu gezeichnet. */
type Bucket = { now: number; subs: Set<() => void>; id: number };
const buckets = new Map<number, Bucket>();

function bucket(ms: number): Bucket {
  let b = buckets.get(ms);
  if (!b) {
    b = { now: Date.now(), subs: new Set(), id: 0 };
    buckets.set(ms, b);
  }
  return b;
}

function refresh(b: Bucket) {
  b.now = Date.now();
  b.subs.forEach((f) => f());
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) buckets.forEach((b) => b.subs.size > 0 && refresh(b));
  });
}

function subscribeNow(ms: number, f: () => void) {
  const b = bucket(ms);
  b.subs.add(f);
  if (b.id === 0) {
    refresh(b);
    b.id = window.setInterval(() => {
      if (!document.hidden) refresh(b);
    }, ms);
  }
  return () => {
    b.subs.delete(f);
    if (b.subs.size === 0) {
      window.clearInterval(b.id);
      b.id = 0;
    }
  };
}

const NEVER = () => () => {};

/** Aktuelle Zeit, die sich alle `ms` Millisekunden erneuert. */
export function useNow(ms: number, on = true) {
  const sub = useCallback((f: () => void) => (on ? subscribeNow(ms, f) : NEVER()), [ms, on]);
  return useSyncExternalStore(sub, () => bucket(ms).now, () => bucket(ms).now);
}

if (typeof window !== "undefined") schedule();