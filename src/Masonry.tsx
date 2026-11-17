import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type MasonryItem = { id: string; node: ReactNode };

/**
 * Ordnet Karten automatisch an: Jede Karte landet in der aktuell kürzesten Spalte.
 * Die Spaltenzahl ergibt sich aus der Breite, und bei jeder Größenänderung wird neu berechnet.
 */
export function Masonry({
  items,
  minCol = 340,
  gap = 18,
}: {
  items: MasonryItem[];
  minCol?: number;
  gap?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const order = useRef<string[]>([]);
  const ro = useRef<ResizeObserver | null>(null);
  const raf = useRef(0);
  const [ready, setReady] = useState(false);

  order.current = items.map((i) => i.id);

  const layout = useCallback(() => {
    const w = wrap.current;
    if (!w) return;
    const width = w.clientWidth;
    if (width <= 0) return;

    const cols = Math.max(1, Math.floor((width + gap) / (minCol + gap)));
    const colW = (width - gap * (cols - 1)) / cols;
    const heights = Array.from({ length: cols }, () => 0);

    for (const id of order.current) {
      const el = els.current.get(id);
      if (!el) continue;

      /* kürzeste Spalte, bei fast gleicher Höhe die weiter links liegende */
      let c = 0;
      for (let i = 1; i < cols; i++) {
        if ((heights[i] ?? 0) < (heights[c] ?? 0) - 6) c = i;
      }

      el.style.width = `${colW}px`;
      el.style.transform = `translate(${c * (colW + gap)}px, ${heights[c] ?? 0}px)`;
      heights[c] = (heights[c] ?? 0) + el.offsetHeight + gap;
    }

    w.style.height = `${Math.max(0, Math.max(...heights) - gap)}px`;
  }, [gap, minCol]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(layout);
  }, [layout]);

  /* Beobachtet Container und Karten: ändert sich eine Größe, wird neu angeordnet */
  useEffect(() => {
    const o = new ResizeObserver(schedule);
    ro.current = o;
    if (wrap.current) o.observe(wrap.current);
    els.current.forEach((el) => o.observe(el));
    return () => {
      o.disconnect();
      ro.current = null;
      cancelAnimationFrame(raf.current);
    };
  }, [schedule]);

  useLayoutEffect(() => {
    layout();
    els.current.forEach((el) => ro.current?.observe(el));
  });

  /* Erst nach der ersten Anordnung einblenden, damit nichts springt */
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div ref={wrap} className="mas" data-ready={ready ? "" : undefined}>
      {items.map((it, i) => (
        <div
          key={it.id}
          className="mas-item"
          ref={(el) => {
            if (el) els.current.set(it.id, el);
            else els.current.delete(it.id);
          }}
        >
          <div className="mas-in" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
            {it.node}
          </div>
        </div>
      ))}
    </div>
  );
}