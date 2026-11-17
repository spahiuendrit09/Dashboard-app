import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as RKE, PointerEvent as RPE, ReactNode } from "react";
import { Minus } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import "./perf";
import "./grid.css";

export type Sz = { w: number; h: number };
export type GridDef = {
  id: string;
  label: string;
  icon: Icon;
  def: Sz;
  min: Sz;
  max: Sz;
  node: (sz: Sz) => ReactNode;
  /** Daten, von denen das Widget abhängt. Ändern sie sich nicht, wird es nicht neu gezeichnet. */
  deps?: unknown[];
};
export type Layout = { order: string[]; hidden: string[]; sizes: Record<string, Sz> };

const GAP = 16;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/** Gummiband: über die Grenzen hinaus folgt das Widget nur noch ein Stück weit. */
const rubber = (v: number, lo: number, hi: number) =>
  v < lo ? lo - (lo - v) * 0.22 : v > hi ? hi + (v - hi) * 0.22 : v;

const buzz = () => {
  try {
    if ("vibrate" in navigator) navigator.vibrate(8);
  } catch {
    /* nicht unterstützt */
  }
};

/* =========================================================
   Raster: Spaltenzahl und Zellgröße aus der Breite
   ========================================================= */

function calc(width: number) {
  const cols = Math.min(6, Math.max(2, Math.floor((width + GAP) / (176 + GAP))));
  return { cols, cell: (width - GAP * (cols - 1)) / cols };
}

function useGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const [g, setG] = useState(() => ({
    ...calc(Math.max(320, Math.min(window.innerWidth - 32, 1400))),
    anim: false,
  }));

  /* Misst vor dem ersten Zeichnen. Der Zustand liegt komplett im Effekt,
     deshalb funktioniert es auch, wenn React ihn zweimal ausführt. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = 0;
    let timer = 0;

    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0 || Math.abs(w - last) < 1) return;
      last = w;
      const c = calc(w);
      /* Während sich die Fensterbreite ändert, keine Animation */
      setG({ cols: c.cols, cell: c.cell, anim: false });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setG((p) => ({ ...p, anim: true })), 120);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return { ref, ...g };
}

/* =========================================================
   Packen: jedes Widget kommt an die erste freie Stelle
   ========================================================= */

type P = { id: string; w: number; h: number };

function pack(items: P[], cols: number) {
  const occ: boolean[][] = [];
  const pos: Record<string, { c: number; r: number }> = {};
  let rows = 0;

  const free = (r: number, c: number, w: number, h: number) => {
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        if (occ[r + i]?.[c + j] === true) return false;
      }
    }
    return true;
  };

  for (const it of items) {
    const w = Math.min(it.w, cols);
    let done = false;
    for (let r = 0; !done; r++) {
      for (let c = 0; c + w <= cols; c++) {
        if (!free(r, c, w, it.h)) continue;
        for (let i = 0; i < it.h; i++) {
          const row = (occ[r + i] ??= []);
          for (let j = 0; j < w; j++) row[c + j] = true;
        }
        pos[it.id] = { c, r };
        rows = Math.max(rows, r + it.h);
        done = true;
        break;
      }
    }
  }
  return { pos, rows };
}

/** Der Inhalt eines Widgets wird nur neu gezeichnet, wenn sich Widget oder Größe ändern. */
const Body = memo(
  function Body({ d, w, h }: { d: GridDef; w: number; h: number }) {
    return <div className="wc">{d.node({ w, h })}</div>;
  },
  (a, b) => {
    if (a.w !== b.w || a.h !== b.h || a.d.id !== b.d.id) return false;
    const x = a.d.deps;
    const y = b.d.deps;
    if (x && y) return x.length === y.length && x.every((v, i) => Object.is(v, y[i]));
    return a.d === b.d;
  },
);

/* =========================================================
   Das Raster
   ========================================================= */

type Live = { id: string; w: number; h: number; pw: number; ph: number };
type Move = { id: string; x: number; y: number };
type Press = {
  id: string;
  x: number;
  y: number;
  gx: number;
  gy: number;
  touch: boolean;
  started: boolean;
  timer: number;
  pid: number;
  el: HTMLElement;
};

export function WidgetGrid({
  defs,
  layout,
  setLayout,
  edit,
}: {
  defs: GridDef[];
  layout: Layout;
  setLayout: (l: Layout) => void;
  edit: boolean;
}) {
  const g = useGrid();
  const step = g.cell + GAP;
  const wpx = (w: number) => w * step - GAP;
  const hpx = (h: number) => h * step - GAP;

  const [live, setLive] = useState<Live | null>(null);
  const [mv, setMv] = useState<Move | null>(null);
  const rz = useRef<{ id: string; x: number; y: number; pw: number; ph: number } | null>(null);
  const snap = useRef<Sz>({ w: 1, h: 1 });
  const press = useRef<Press | null>(null);
  const lastSwap = useRef(0);
  const raf = useRef(0);
  const pend = useRef<Move | null>(null);
  /* Höchstens ein Neuzeichnen pro Bild, egal wie viele Pointer-Events kommen */
  const setMvRaf = (m: Move) => {
    pend.current = m;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      if (pend.current) setMv(pend.current);
    });
  };

  /* ---------- Reihenfolge, Sichtbarkeit, Größen ---------- */
  const known = defs.map((d) => d.id);
  const order = [...layout.order.filter((id) => known.includes(id)), ...known.filter((id) => !layout.order.includes(id))];
  const visible = order.filter((id) => !layout.hidden.includes(id));

  const maxW = (d: GridDef) => Math.max(d.min.w, Math.min(d.max.w, g.cols));
  const stored = (d: GridDef): Sz => {
    const s = layout.sizes[d.id] ?? d.def;
    return { w: clamp(s.w, d.min.w, maxW(d)), h: clamp(s.h, d.min.h, d.max.h) };
  };

  const items = visible.flatMap((id) => {
    const d = defs.find((x) => x.id === id);
    if (!d) return [];
    const sz: Sz = live && live.id === id ? { w: live.w, h: live.h } : stored(d);
    return [{ d, sz }];
  });
  const { pos, rows } = pack(
    items.map((i) => ({ id: i.d.id, w: i.sz.w, h: i.sz.h })),
    g.cols,
  );

  const commit = (id: string, s: Sz) =>
    setLayout({ ...layout, order, sizes: { ...layout.sizes, [id]: { w: s.w, h: s.h } } });
  const hide = (id: string) => setLayout({ ...layout, order, hidden: [...layout.hidden, id] });
  const moveBy = (id: string, dir: -1 | 1) => {
    const i = visible.indexOf(id);
    const other = visible[i + dir];
    if (i < 0 || other === undefined) return;
    const next = [...order];
    const a = next.indexOf(id);
    const b = next.indexOf(other);
    next[a] = other;
    next[b] = id;
    setLayout({ ...layout, order: next });
  };

  /* ---------- Größe ziehen ---------- */
  const rzDown = (e: RPE<HTMLButtonElement>, d: GridDef, sz: Sz) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    rz.current = { id: d.id, x: e.clientX, y: e.clientY, pw: wpx(sz.w), ph: hpx(sz.h) };
    snap.current = sz;
    setLive({ id: d.id, w: sz.w, h: sz.h, pw: wpx(sz.w), ph: hpx(sz.h) });
  };
  const rzMove = (e: RPE<HTMLButtonElement>, d: GridDef) => {
    const s = rz.current;
    if (!s || s.id !== d.id) return;
    const mw = maxW(d);
    const pw = rubber(s.pw + e.clientX - s.x, wpx(d.min.w), wpx(mw));
    const ph = rubber(s.ph + e.clientY - s.y, hpx(d.min.h), hpx(d.max.h));
    const w = clamp(Math.round((pw + GAP) / step), d.min.w, mw);
    const h = clamp(Math.round((ph + GAP) / step), d.min.h, d.max.h);
    if (w !== snap.current.w || h !== snap.current.h) {
      snap.current = { w, h };
      buzz();
    }
    setLive({ id: d.id, w, h, pw, ph });
  };
  const rzEnd = (d: GridDef) => {
    if (!rz.current) return;
    rz.current = null;
    const s = snap.current;
    setLive(null);
    commit(d.id, s);
  };
  const rzKey = (e: RKE<HTMLButtonElement>, d: GridDef, sz: Sz) => {
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      moveBy(d.id, e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (dx === 0 && dy === 0) return;
    e.preventDefault();
    commit(d.id, {
      w: clamp(sz.w + dx, d.min.w, maxW(d)),
      h: clamp(sz.h + dy, d.min.h, d.max.h),
    });
  };

  /* ---------- Verschieben (halten und ziehen) ---------- */
  const beginMove = (p: Press) => {
    if (press.current !== p || p.started) return;
    p.started = true;
    try {
      p.el.setPointerCapture(p.pid);
    } catch {
      /* Zeiger nicht mehr aktiv */
    }
    const gr = g.ref.current?.getBoundingClientRect();
    setMv({ id: p.id, x: p.x - (gr?.left ?? 0) - p.gx, y: p.y - (gr?.top ?? 0) - p.gy });
    buzz();
  };

  const endPress = () => {
    const p = press.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    press.current = null;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    pend.current = null;
    if (p.started) {
      try {
        p.el.releasePointerCapture(p.pid);
      } catch {
        /* schon losgelassen */
      }
      setMv(null);
    }
  };

  const slotDown = (e: RPE<HTMLDivElement>, id: string) => {
    if (!edit || e.button > 0) return;
    if ((e.target as HTMLElement).closest(".w-handle, .w-minus")) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const p: Press = {
      id,
      x: e.clientX,
      y: e.clientY,
      gx: e.clientX - rect.left,
      gy: e.clientY - rect.top,
      touch: e.pointerType !== "mouse",
      started: false,
      timer: 0,
      pid: e.pointerId,
      el,
    };
    press.current = p;
    if (p.touch) p.timer = window.setTimeout(() => beginMove(p), 260);
  };

  const slotMove = (e: RPE<HTMLDivElement>) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pid) return;
    const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);

    if (!p.started) {
      if (p.touch) {
        if (dist > 9) endPress();
        return;
      }
      if (dist < 4) return;
      beginMove(p);
    }

    const gr = g.ref.current?.getBoundingClientRect();
    if (!gr) return;
    const px = e.clientX - gr.left;
    const py = e.clientY - gr.top;
    setMvRaf({ id: p.id, x: px - p.gx, y: py - p.gy });

    /* am Rand des Bildschirms mitscrollen */
    if (e.clientY < 90) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 120) window.scrollBy(0, 14);

    /* Zieht man über ein anderes Widget, tauschen die Plätze */
    const now = performance.now();
    if (now - lastSwap.current < 220) return;
    const hit = items.find(({ d, sz }) => {
      if (d.id === p.id) return false;
      const pp = pos[d.id];
      if (!pp) return false;
      const x = pp.c * step;
      const y = pp.r * step;
      return px >= x && px <= x + wpx(sz.w) && py >= y && py <= y + hpx(sz.h);
    });
    if (!hit) return;
    const from = visible.indexOf(p.id);
    const to = visible.indexOf(hit.d.id);
    if (from < 0 || to < 0) return;
    const next = visible.filter((x) => x !== p.id);
    next.splice(to, 0, p.id);
    lastSwap.current = now;
    setLayout({ ...layout, order: [...next, ...order.filter((id) => !visible.includes(id))] });
  };

  /* Beim Ziehen mit dem Finger darf die Seite nicht scrollen */
  const moving = mv !== null;
  useEffect(() => {
    if (!moving) return;
    const block = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, [moving]);

  useEffect(() => {
    if (!edit) endPress();
  }, [edit]);

  useEffect(
    () => () => {
      const p = press.current;
      if (p) window.clearTimeout(p.timer);
    },
    [],
  );

  /* ---------- Platzhalter, der zeigt, wo das Widget einrastet ---------- */
  const gid = live?.id ?? mv?.id ?? null;
  const gItem = gid ? items.find((i) => i.d.id === gid) : undefined;
  const gPos = gItem ? pos[gItem.d.id] : undefined;

  return (
    <div
      ref={g.ref}
      className="ggrid"
      data-anim={g.anim ? "" : undefined}
      style={{ height: Math.max(0, rows * step - GAP) }}
    >
      {gItem && gPos && (
        <div
          className="ggh"
          style={{
            width: wpx(gItem.sz.w),
            height: hpx(gItem.sz.h),
            transform: `translate3d(${gPos.c * step}px, ${gPos.r * step}px, 0)`,
          }}
        />
      )}

      {items.map(({ d, sz }, i) => {
        const p = pos[d.id] ?? { c: 0, r: 0 };
        const l = live && live.id === d.id ? live : null;
        const m = mv && mv.id === d.id ? mv : null;
        const x = m ? m.x : p.c * step;
        const y = m ? m.y : p.r * step;
        const style = {
          width: l ? l.pw : wpx(sz.w),
          height: l ? l.ph : hpx(sz.h),
          transform: `translate3d(${x}px, ${y}px, 0)`,
          "--i": i,
        } as CSSProperties;

        return (
          <div
            key={d.id}
            className={`gs${edit ? " editing" : ""}${l ? " resizing" : ""}${m ? " moving" : ""}`}
            style={style}
            onPointerDown={(e) => slotDown(e, d.id)}
            onPointerMove={slotMove}
            onPointerUp={endPress}
            onPointerCancel={endPress}
          >
            <div className="gs-in">
              <Body key={`${sz.w}x${sz.h}`} d={d} w={sz.w} h={sz.h} />
              {edit && (
                <>
                  <button className="w-minus" aria-label={`${d.label} ausblenden`} onClick={() => hide(d.id)}>
                    <Minus size={15} weight="bold" />
                  </button>
                  <button
                    className="w-handle"
                    aria-label={`${d.label}: Größe ändern. Ziehen oder Pfeiltasten, mit Alt verschieben.`}
                    onPointerDown={(e) => rzDown(e, d, sz)}
                    onPointerMove={(e) => rzMove(e, d)}
                    onPointerUp={() => rzEnd(d)}
                    onPointerCancel={() => rzEnd(d)}
                    onKeyDown={(e) => rzKey(e, d, sz)}
                  >
                    <svg viewBox="0 0 44 44" aria-hidden="true">
                      <path d="M40 14A26 26 0 0 1 14 40" fill="none" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}