import { useEffect, useRef, useState } from "react";

export type FocusLog = Record<string, number>;

/* Speichern gebündelt und verzögert: Tippen und Slider schreiben nicht mehr bei jeder Änderung
   den ganzen Wert in den Speicher. Beim Verlassen der Seite wird sofort gespeichert. */
const pending = new Map<string, unknown>();
let saveTimer = 0;

function flushStored() {
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  pending.forEach((v, k) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* Speicher voll oder blockiert, App läuft trotzdem weiter */
    }
  });
  pending.clear();
}

function queueStored(key: string, value: unknown) {
  pending.set(key, value);
  if (saveTimer === 0) saveTimer = window.setTimeout(flushStored, 300);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushStored);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushStored();
  });
}

export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const first = useRef(true);
  useEffect(() => {
    /* Der Startwert kommt aus dem Speicher und muss nicht zurückgeschrieben werden */
    if (first.current) {
      first.current = false;
      return;
    }
    queueStored(key, value);
  }, [key, value]);
  /* Wird eine Seite geschlossen, sofort sichern, damit andere Seiten den neuen Stand lesen */
  useEffect(() => flushStored, []);
  return [value, setValue] as const;
}

/** Zählt weich von der letzten Zahl zur neuen hoch. */
export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = a + (target - a) * eased;
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return Math.round(value);
}

/* ---------- Datum & Zeit ---------- */

export const pad = (n: number) => String(n).padStart(2, "0");

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** offset = Tage in der Vergangenheit (negativ = Zukunft) */
export const dayDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d;
};

export const dayKey = (offset = 0) => ymd(dayDate(offset));
export const monthKey = (d: Date) => ymd(d).slice(0, 7);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const monthLabel = (d: Date) => d.toLocaleDateString("de-AT", { month: "long", year: "numeric" });
export const uid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

export const relDay = (key: string) => {
  if (key === dayKey(0)) return "Heute";
  if (key === dayKey(-1)) return "Morgen";
  if (key === dayKey(1)) return "Gestern";
  return new Date(`${key}T00:00:00`).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" });
};

export const sumDays = (log: FocusLog, days: number) => {
  let total = 0;
  for (let i = 0; i < days; i++) total += log[dayKey(i)] ?? 0;
  return total;
};

export const formatMinutes = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
};

export const streakOf = (days: string[]) => {
  const set = new Set(days);
  let i = set.has(dayKey(0)) ? 0 : 1;
  let n = 0;
  while (set.has(dayKey(i))) {
    n++;
    i++;
  }
  return n;
};

/* ---------- Zahlen ---------- */

export const fmt = (n: number, max = 2) =>
  Number.isFinite(n) ? n.toLocaleString("de-AT", { maximumFractionDigits: max }) : "–";

export const money = (n: number, cur = "EUR") => {
  if (!Number.isFinite(n)) return "–";
  try {
    return new Intl.NumberFormat("de-AT", { style: "currency", currency: cur }).format(n);
  } catch {
    return `${fmt(n)} ${cur}`;
  }
};

/** Liest Zahlen wie "1.234,5", "12,5" oder "12.5". */
export const num = (s: string) => {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

/* ---------- Rechner (ohne eval) ---------- */

export function evaluate(src: string): number {
  const s = src
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/,/g, ".")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .toLowerCase();

  let i = 0;
  let lastWasPct = false;
  let pctTerm = false;

  const fail = (): never => {
    throw new Error("syntax");
  };
  const peek = () => {
    while (s.charAt(i) === " ") i++;
    return s.charAt(i);
  };
  const FN: Record<string, (x: number) => number> = {
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    ln: Math.log,
    log: Math.log10,
    abs: Math.abs,
    round: Math.round,
  };

  /** Plus und Minus: "200 + 10 %" bedeutet 200 + 10 % von 200. */
  function expr(): number {
    let v = term();
    for (;;) {
      const c = peek();
      if (c === "+") {
        i++;
        const r = term();
        v += pctTerm ? v * r : r;
      } else if (c === "-") {
        i++;
        const r = term();
        v -= pctTerm ? v * r : r;
      } else return v;
    }
  }
  function term(): number {
    let v = power();
    const single = lastWasPct;
    let more = false;
    for (;;) {
      const c = peek();
      if (c === "*") {
        i++;
        v *= power();
        more = true;
      } else if (c === "/") {
        i++;
        v /= power();
        more = true;
      } else break;
    }
    pctTerm = single && !more;
    return v;
  }
  function power(): number {
    const b = unary();
    if (peek() === "^") {
      i++;
      return Math.pow(b, power());
    }
    return b;
  }
  function unary(): number {
    const c = peek();
    if (c === "-") {
      i++;
      return -unary();
    }
    if (c === "+") {
      i++;
      return unary();
    }
    return postfix();
  }
  function postfix(): number {
    let v = primary();
    let hit = false;
    while (peek() === "%") {
      i++;
      v /= 100;
      hit = true;
    }
    lastWasPct = hit;
    return v;
  }
  function primary(): number {
    const c = peek();
    if (c === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") fail();
      i++;
      return v;
    }
    if (/[0-9.]/.test(c)) {
      const st = i;
      while (/[0-9.]/.test(s.charAt(i))) i++;
      const v = Number(s.slice(st, i));
      if (Number.isNaN(v)) fail();
      return v;
    }
    if (/[a-z]/.test(c)) {
      const st = i;
      while (/[a-z]/.test(s.charAt(i))) i++;
      const id = s.slice(st, i);
      if (id === "pi") return Math.PI;
      if (id === "e") return Math.E;
      const f = FN[id];
      if (!f || peek() !== "(") return fail();
      i++;
      const v = expr();
      if (peek() !== ")") fail();
      i++;
      return f(v);
    }
    return fail();
  }

  const v = expr();
  if (peek() !== "") fail();
  if (!Number.isFinite(v)) throw new Error("math");
  return v;
}

/** Ergebnis als editierbarer Text zurück in den Rechner. */
export const resultText = (v: number) => String(Number(v.toPrecision(12))).replace(".", ",");

/* ---------- Ton ---------- */

export function beep(volume: number) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max((volume / 100) * 0.4, 0.0001), ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.75);
  } catch {
    /* Audio nicht verfügbar */
  }
}

/* Slider laufen von 0 bis 100, diese Funktionen rechnen in echte Werte um */
export const minutesFromSlider = (v: number) => Math.round((5 + (v / 100) * 85) / 5) * 5; // 5 bis 90
export const sliderFromMinutes = (m: number) => Math.round(((m - 5) / 85) * 100);
export const goalFromSlider = (v: number) => 30 + Math.round(((v / 100) * 450) / 15) * 15; // 30 bis 480
export const sliderFromGoal = (g: number) => Math.round(((g - 30) / 450) * 100);
export const hourFromSlider = (v: number) => 6 + Math.round((v / 100) * 17); // 6 bis 23 Uhr
export const sliderFromHour = (h: number) => Math.round(((h - 6) / 17) * 100);