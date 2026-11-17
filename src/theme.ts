import type { CSSProperties } from "react";

export type BgState = {
  mode: "preset" | "image";
  preset: string;
  dim: number;
  blur: number;
  glass: number;
  accent: string;
};

export const DEFAULT_BG: BgState = {
  mode: "preset",
  preset: "aurora",
  dim: 0,
  blur: 0,
  glass: 30,
  accent: "#0a84ff",
};

export type Preset = {
  id: string;
  name: string;
  colors: [string, string, string, string];
  base: string;
};

const AURORA: Preset = {
  id: "aurora",
  name: "Aurora",
  colors: ["#4f46e5", "#0ea5e9", "#a855f7", "#14b8a6"],
  base: "#070a14",
};

export const PRESETS: Preset[] = [
  AURORA,
  { id: "sunset", name: "Sonnenuntergang", colors: ["#f97316", "#ec4899", "#7c3aed", "#f59e0b"], base: "#12060f" },
  { id: "ocean", name: "Ozean", colors: ["#0ea5e9", "#2563eb", "#06b6d4", "#1d4ed8"], base: "#020b18" },
  { id: "forest", name: "Wald", colors: ["#16a34a", "#0d9488", "#65a30d", "#047857"], base: "#04100a" },
  { id: "rose", name: "Rosé", colors: ["#f43f5e", "#d946ef", "#fb7185", "#a855f7"], base: "#14060d" },
  { id: "graphite", name: "Graphit", colors: ["#475569", "#64748b", "#334155", "#94a3b8"], base: "#08090c" },
  { id: "gold", name: "Gold", colors: ["#f59e0b", "#eab308", "#ea580c", "#facc15"], base: "#120d03" },
];

export const ACCENTS: { id: string; name: string; color: string }[] = [
  { id: "blue", name: "Blau", color: "#0a84ff" },
  { id: "purple", name: "Lila", color: "#bf5af2" },
  { id: "green", name: "Grün", color: "#30d158" },
  { id: "orange", name: "Orange", color: "#ff9f0a" },
  { id: "pink", name: "Pink", color: "#ff375f" },
  { id: "teal", name: "Türkis", color: "#40c8e0" },
];

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mischt zwei Hex-Farben, t = Anteil von b (0 bis 1). */
export function mixHex(a: string, b: string, t: number) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Farben des Hintergrunds für dunkles oder helles Design. */
export function wallpaperVars(bg: BgState, theme: "dark" | "light"): CSSProperties {
  const p = PRESETS.find((x) => x.id === bg.preset) ?? AURORA;
  const [c1, c2, c3, c4] = p.colors;
  const light = theme === "light";
  const t = (c: string) => (light ? mixHex(c, "#ffffff", 0.6) : c);
  return {
    "--b1": t(c1),
    "--b2": t(c2),
    "--b3": t(c3),
    "--b4": t(c4),
    "--bg": light ? "#e9eefb" : p.base,
  } as CSSProperties;
}

/** Verkleinert ein Bild, damit es in den Browser-Speicher passt. */
export async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("img"));
      el.src = url;
    });

    let side = 1800;
    let quality = 0.82;
    for (let i = 0; i < 4; i++) {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(img, 0, 0, w, h);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length < 2000000 || i === 3) return data;
      side = Math.round(side * 0.75);
      quality -= 0.08;
    }
    throw new Error("size");
  } finally {
    URL.revokeObjectURL(url);
  }
}