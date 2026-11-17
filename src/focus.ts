import { useEffect, useRef } from "react";

export type AmbientKind = "off" | "rain" | "brown" | "pink" | "white";

export type FocusCfg = {
  lock: boolean;
  overlay: boolean;
  strict: boolean;
  blocked: string[];
  fullscreen: boolean;
  wake: boolean;
  cycles: boolean;
  breakMin: number;
  ambient: AmbientKind;
  ambientVol: number;
  shortcutOn: string;
  shortcutOff: string;
  shortcutAuto: boolean;
};

export const DEFAULT_FOCUS: FocusCfg = {
  lock: true,
  overlay: false,
  strict: false,
  blocked: ["money", "tools", "settings"],
  fullscreen: false,
  wake: true,
  cycles: false,
  breakMin: 5,
  ambient: "off",
  ambientVol: 40,
  shortcutOn: "Fokus an",
  shortcutOff: "Fokus aus",
  shortcutAuto: false,
};

/** Bereiche, die in der Fokus-Sperre gesperrt werden können. */
export const AREAS: { id: string; label: string }[] = [
  { id: "home", label: "Heute" },
  { id: "money", label: "Geld" },
  { id: "tools", label: "Tools" },
  { id: "settings", label: "Mehr" },
  { id: "tasks", label: "Aufgaben" },
  { id: "events", label: "Termine" },
  { id: "lists", label: "Listen" },
  { id: "habits", label: "Routinen" },
  { id: "notes", label: "Notizen" },
];

export const AMBIENTS: { id: AmbientKind; label: string }[] = [
  { id: "off", label: "Aus" },
  { id: "rain", label: "Regen" },
  { id: "brown", label: "Braun" },
  { id: "pink", label: "Rosa" },
  { id: "white", label: "Weiß" },
];

const SCALE: Record<AmbientKind, number> = {
  off: 0,
  rain: 0.5,
  brown: 0.8,
  pink: 0.5,
  white: 0.25,
};

/** Erzeugt Hintergrundrauschen mit dem Web-Audio-Baukasten (keine Dateien nötig). */
export function useAmbient(kind: AmbientKind, volume: number, playing: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const live = useRef<{ src: AudioBufferSourceNode; gain: GainNode; chain: AudioNode[] } | null>(null);
  const vol = useRef(volume);
  vol.current = volume;

  useEffect(() => {
    const stop = () => {
      const n = live.current;
      if (!n) return;
      live.current = null;
      try {
        n.src.stop();
      } catch {
        /* schon gestoppt */
      }
      for (const node of [n.src, ...n.chain, n.gain]) node.disconnect();
    };

    if (!playing || kind === "off") {
      stop();
      return stop;
    }

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = ctxRef.current ?? new Ctx();
      ctxRef.current = ctx;
      void ctx.resume();

      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "brown") {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else if (kind === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          d[i] = w;
        }
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = (vol.current / 100) * SCALE[kind];
      const chain: AudioNode[] = [];
      let head: AudioNode = src;

      if (kind === "rain") {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 500;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 6000;
        head.connect(hp);
        hp.connect(lp);
        head = lp;
        chain.push(hp, lp);
      }

      head.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      live.current = { src, gain, chain };
    } catch {
      /* Audio nicht verfügbar */
    }

    return stop;
  }, [kind, playing]);

  useEffect(() => {
    const n = live.current;
    if (n) n.gain.gain.value = (volume / 100) * SCALE[kind];
  }, [volume, kind]);
}

/** Hält den Bildschirm wach, solange `active` wahr ist (wo der Browser es erlaubt). */
type Sentinel = { release: () => Promise<void> };
type WakeNav = { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as unknown as WakeNav;
    const api = nav.wakeLock;
    if (!api) return;

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await api.request("screen");
        if (cancelled) void s.release().catch(() => {});
        else sentinel = s;
      } catch {
        /* nicht erlaubt */
      }
    };

    void acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}

export function enterFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      void Promise.resolve(el.requestFullscreen()).catch(() => {});
    }
  } catch {
    /* nicht unterstützt */
  }
}

export function leaveFullscreen() {
  try {
    if (document.fullscreenElement) void Promise.resolve(document.exitFullscreen()).catch(() => {});
  } catch {
    /* nicht unterstützt */
  }
}

/** Startet einen iOS-Kurzbefehl (öffnet die Kurzbefehle-App). */
export function runShortcut(name: string) {
  const n = name.trim();
  if (!n) return;
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(n)}`;
}