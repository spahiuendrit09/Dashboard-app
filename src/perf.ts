import "./polish.css";

export type PerfMode = "full" | "lite";
const KEY = "ios-perf";

/** Ohne gespeicherte Wahl: auf Touch-Geräten, schwacher Hardware oder bei "weniger Bewegung" sparsam. */
function detect(): PerfMode {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return weak || touch || reduce ? "lite" : "full";
  } catch {
    return "full";
  }
}

export const getPerf = (): PerfMode => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "lite" || v === "full") return v;
  } catch {
    /* Speicher blockiert */
  }
  return detect();
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