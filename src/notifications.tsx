import { useCallback, useEffect, useRef, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import { Bell, CheckCircle, Fire, Target, Timer } from "@phosphor-icons/react";

export type PushKind = "focus" | "task" | "habit" | "goal" | "system";

export type Push = {
  id: string;
  kind: PushKind;
  title: string;
  body: string;
  /** Tab, der beim Antippen geöffnet wird */
  tab?: string;
};

const APP_NAME = "Dashboard";

const KINDS: Record<PushKind, { icon: Icon; bg: string }> = {
  focus: { icon: Timer, bg: "linear-gradient(135deg, #ff9f0a, #ff453a)" },
  task: { icon: CheckCircle, bg: "linear-gradient(135deg, #34d399, #16a34a)" },
  habit: { icon: Target, bg: "linear-gradient(135deg, #60a5fa, #6366f1)" },
  goal: { icon: Fire, bg: "linear-gradient(135deg, #fbbf24, #f97316)" },
  system: { icon: Bell, bg: "linear-gradient(135deg, #9ca3af, #4b5563)" },
};

function PushCard({
  item,
  onDismiss,
  onOpen,
}: {
  item: Push;
  onDismiss: (id: string) => void;
  onOpen: (item: Push) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [hover, setHover] = useState(false);
  const [drag, setDrag] = useState(false);
  const [dy, setDy] = useState(0);
  const startY = useRef<number | null>(null);
  const moved = useRef(false);
  const left = useRef(false);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    window.setTimeout(() => onDismiss(item.id), 420);
  }, [item.id, onDismiss]);

  /* Automatisch ausblenden, außer die Maus ist darüber oder man zieht gerade */
  useEffect(() => {
    if (hover || drag || leaving) return;
    const t = window.setTimeout(leave, 6000);
    return () => window.clearTimeout(t);
  }, [hover, drag, leaving, leave]);

  const { icon: IconC, bg } = KINDS[item.kind];

  return (
    <div className={`push-wrap${leaving ? " leaving" : ""}`}>
      <div className="push-clip">
        <article
          className={`push${drag ? " dragging" : ""}`}
          style={dy !== 0 && !leaving ? { transform: `translateY(${dy}px)` } : undefined}
          role="button"
          tabIndex={0}
          aria-label={`${item.title}. ${item.body}`}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onPointerDown={(e) => {
            startY.current = e.clientY;
            moved.current = false;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(true);
          }}
          onPointerMove={(e) => {
            if (startY.current === null) return;
            const d = e.clientY - startY.current;
            if (Math.abs(d) > 5) moved.current = true;
            setDy(Math.min(0, d));
          }}
          onPointerUp={(e) => {
            if (startY.current === null) return;
            const d = e.clientY - startY.current;
            startY.current = null;
            setDrag(false);
            if (d < -40) {
              leave();
            } else {
              setDy(0);
              if (!moved.current) onOpen(item);
            }
          }}
          onPointerCancel={() => {
            startY.current = null;
            setDrag(false);
            setDy(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpen(item);
            if (e.key === "Escape") leave();
          }}
        >
          <span className="push-ic" style={{ background: bg }}>
            <IconC size={22} weight="fill" />
          </span>
          <div className="push-body">
            <div className="push-head">
              <span>{APP_NAME}</span>
              <span>jetzt</span>
            </div>
            <div className="push-title">{item.title}</div>
            <div className="push-text">{item.body}</div>
          </div>
        </article>
      </div>
    </div>
  );
}

export function NotificationStack({
  items,
  onDismiss,
  onOpen,
}: {
  items: Push[];
  onDismiss: (id: string) => void;
  onOpen: (item: Push) => void;
}) {
  return (
    <div className="push-stack" aria-live="polite">
      {items.map((item) => (
        <PushCard key={item.id} item={item} onDismiss={onDismiss} onOpen={onOpen} />
      ))}
    </div>
  );
}