import "./polish.css";
import "./mobile.css";

export type PerfMode = "full" | "lite";
const KEY = "ios-perf";

/** Auf dem Handy startet die App standardmäßig im Sparmodus, am PC in voller Qualität. */
export const getPerf = (): PerfMode => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "lite" || v === "full") return v;
    return window.matchMedia("(pointer: coarse)").matches ? "lite" : "full";
  } catch {
    return "full";
  }
};

export function setPerf(m: PerfMode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* Speicher blockiert, der Modus gilt trotzdem bis zum Neuladen */
  }
  document.documentElement.dataset["perf"] = m;
}

if (typeof document !== "undefined") {
  document.documentElement.dataset["perf"] = getPerf();
}
