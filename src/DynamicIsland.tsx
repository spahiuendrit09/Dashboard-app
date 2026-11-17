import { useEffect, useRef, useState } from "react";
import type { PointerEvent as RPE } from "react";
import {
  ArrowCounterClockwise,
  Bell,
  BellRinging,
  CheckCircle,
  Fire,
  Flag,
  MusicNotes,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Watch,
  Target,
  Timer,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Push, PushKind } from "./notifications";
import { activeCd, clock, clockMs, elapsedMs, leftSec, quick, useNow, useQuick } from "./quick";
import "./island2.css";

export type IslandTimer = { active: boolean; running: boolean; time: string; progress: number; minutes: number };
export type IslandMusic = { title: string; artist: string; cover: string; playing: boolean; progress: number };

type Kind = "music" | "focus" | "cd" | "sw";

const KINDS: Record<PushKind, { icon: Icon; bg: string }> = {
  focus: { icon: Timer, bg: "linear-gradient(135deg, #ff9f0a, #ff453a)" },
  task: { icon: CheckCircle, bg: "linear-gradient(135deg, #34d399, #16a34a)" },
  habit: { icon: Target, bg: "linear-gradient(135deg, #60a5fa, #6366f1)" },
  goal: { icon: Fire, bg: "linear-gradient(135deg, #fbbf24, #f97316)" },
  system: { icon: Bell, bg: "linear-gradient(135deg, #9ca3af, #4b5563)" },
};

const LABEL: Record<Kind, string> = { music: "Musik", focus: "Fokus", cd: "Timer", sw: "Stoppuhr" };
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const buzz = () => {
  try {
    if ("vibrate" in navigator) navigator.vibrate(8);
  } catch {
    /* nicht unterstützt */
  }
};

/** Kleine Equalizer-Balken (auch von der Musik-Seite genutzt). */
export function Eq({ on, className = "" }: { on: boolean; className?: string }) {
  return (
    <span className={`eq${on ? " on" : ""} ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Cover({ src, small = false }: { src: string; small?: boolean }) {
  return (
    <span className={`ix-cover${small ? " sm" : ""}`} style={src ? { backgroundImage: `url("${src}")` } : undefined}>
      {!src && <MusicNotes size={small ? 14 : 24} weight="fill" />}
    </span>
  );
}

type Props = {
  enabled: boolean;
  timer: IslandTimer;
  music: IslandMusic | null;
  alert: Push | null;
  onAlertOpen: (p: Push) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onMusicToggle: () => void;
  onMusicNext: () => void;
  onMusicPrev: () => void;
};

export function DynamicIsland({
  enabled,
  timer,
  music,
  alert,
  onAlertOpen,
  onPlay,
  onPause,
  onReset,
  onMusicToggle,
  onMusicNext,
  onMusicPrev,
}: Props) {
  const q = useQuick();
  const cd = activeCd(q);
  const swOn = q.sw.on;
  const now = useNow(250, cd !== null || swOn);
  const doneT = q.timers.find((t) => t.done) ?? null;

  const [open, setOpen] = useState<Kind | null>(null);
  const [hidden, setHidden] = useState("");
  const [dragY, setDragY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const lastKind = useRef<Kind>("focus");
  const lastAlert = useRef<Push | null>(alert);
  const lastDone = useRef("Timer");
  const press = useRef<{ y: number; moved: boolean } | null>(null);
  if (alert) lastAlert.current = alert;
  if (doneT) lastDone.current = doneT.label;

  const kinds: Kind[] = [];
  if (music) kinds.push("music");
  if (timer.active) kinds.push("focus");
  if (cd) kinds.push("cd");
  if (swOn) kinds.push("sw");
  const zones = kinds.slice(0, 3);

  const kind = open !== null && kinds.includes(open) ? open : null;
  if (kind) lastKind.current = kind;
  const shown = kind ?? lastKind.current;
  const a = alert ?? lastAlert.current;
  const alertShown = alert !== null && alert.id !== hidden;
  const mode = doneT ? "done" : alertShown ? "alert" : kind ? "open" : kinds.length > 0 ? "compact" : "idle";
  const ti = mode === "open" ? 0 : -1;

  /* Außerhalb klicken oder Escape schließt die große Ansicht */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!enabled) return null;

  const pick = (k: Kind) => {
    setOpen(k);
    buzz();
  };

  /* Meldung: nach oben wischen schließt, antippen öffnet */
  const aDown = (e: RPE<HTMLDivElement>) => {
    press.current = { y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const aMove = (e: RPE<HTMLDivElement>) => {
    const s = press.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) > 6) s.moved = true;
    setDragY(Math.min(0, dy) * 0.7);
  };
  const aUp = (e: RPE<HTMLDivElement>) => {
    const s = press.current;
    press.current = null;
    setDragY(0);
    if (!s || !alert) return;
    if (e.clientY - s.y < -26) setHidden(alert.id);
    else if (!s.moved) onAlertOpen(alert);
  };

  const zone = (k: Kind) => {
    if (k === "music" && music) {
      return (
        <>
          <Cover src={music.cover} small />
          <Eq on={music.playing} />
        </>
      );
    }
    if (k === "focus") {
      return (
        <>
          <span className={`ix-dot focus${timer.running ? " live" : ""}`}>
            <Timer size={17} weight="fill" />
          </span>
          <span className="ix-time focus">{timer.time}</span>
        </>
      );
    }
    if (k === "cd" && cd) {
      return (
        <>
          <span className="ix-dot cd">
            <Bell size={17} weight="fill" />
          </span>
          <span className="ix-time cd">{clock(leftSec(cd, now))}</span>
        </>
      );
    }
    if (k === "sw") {
      return (
        <>
          <span className="ix-dot sw">
            <Watch size={17} weight="fill" />
          </span>
          <span className="ix-time sw">{clockMs(elapsedMs(q.sw, now)).slice(0, 5)}</span>
        </>
      );
    }
    return null;
  };

  const view = (k: Kind) => {
    if (k === "focus") {
      return (
        <>
          <div className="ix-row">
            <span className="ix-ic">
              <Timer size={22} weight="fill" />
            </span>
            <div className="ix-txt">
              <b>Fokus</b>
              <span>
                {timer.running ? "Läuft" : "Pausiert"} · {timer.minutes} min
              </span>
            </div>
            <span className="ix-big">{timer.time}</span>
          </div>
          <div className="ix-bar">
            <i style={{ width: `${clamp01(timer.progress) * 100}%` }} />
          </div>
          <div className="ix-actions">
            <button type="button" className="ix-btn primary" tabIndex={ti} onClick={timer.running ? onPause : onPlay}>
              {timer.running ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
              {timer.running ? "Pause" : "Weiter"}
            </button>
            <button type="button" className="ix-btn" tabIndex={ti} onClick={onReset}>
              <ArrowCounterClockwise size={18} weight="bold" />
              Stopp
            </button>
          </div>
        </>
      );
    }
    if (k === "cd") {
      if (!cd) return null;
      const left = leftSec(cd, now);
      const run = cd.endAt !== null;
      return (
        <>
          <div className="ix-row">
            <span className="ix-ic">
              <Bell size={22} weight="fill" />
            </span>
            <div className="ix-txt">
              <b>{cd.label}</b>
              <span>{run ? "Läuft" : "Pausiert"}</span>
            </div>
            <span className="ix-big">{clock(left)}</span>
          </div>
          <div className="ix-bar">
            <i style={{ width: `${clamp01(1 - left / cd.total) * 100}%` }} />
          </div>
          <div className="ix-actions">
            <button
              type="button"
              className="ix-btn primary"
              tabIndex={ti}
              onClick={() => (run ? quick.pause(cd.id) : quick.resume(cd.id))}
            >
              {run ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
              {run ? "Pause" : "Weiter"}
            </button>
            <button type="button" className="ix-btn" tabIndex={ti} onClick={() => quick.extend(cd.id, 60)}>
              <Plus size={18} weight="bold" />1 min
            </button>
            <button type="button" className="ix-btn" tabIndex={ti} onClick={() => quick.remove(cd.id)}>
              <ArrowCounterClockwise size={18} weight="bold" />
              Stopp
            </button>
          </div>
        </>
      );
    }
    if (k === "sw") {
      const run = q.sw.running;
      return (
        <>
          <div className="ix-row">
            <span className="ix-ic">
              <Watch size={22} weight="fill" />
            </span>
            <div className="ix-txt">
              <b>Stoppuhr</b>
              <span>{q.sw.laps.length > 0 ? `${q.sw.laps.length} Runden` : run ? "Läuft" : "Pausiert"}</span>
            </div>
            <span className="ix-big small">{clockMs(elapsedMs(q.sw, now))}</span>
          </div>
          <div className="ix-bar">
            <i style={{ width: run ? "100%" : "0%" }} />
          </div>
          <div className="ix-actions">
            <button type="button" className="ix-btn primary" tabIndex={ti} onClick={run ? quick.swPause : quick.swStart}>
              {run ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
              {run ? "Pause" : "Weiter"}
            </button>
            <button type="button" className="ix-btn" tabIndex={ti} onClick={quick.swLap} disabled={!run}>
              <Flag size={18} weight="bold" />
              Runde
            </button>
            <button type="button" className="ix-btn" tabIndex={ti} onClick={quick.swReset}>
              <ArrowCounterClockwise size={18} weight="bold" />
              Stopp
            </button>
          </div>
        </>
      );
    }
    if (!music) return null;
    return (
      <>
        <div className="ix-row" style={{ minHeight: 52 }}>
          <Cover src={music.cover} />
          <div className="ix-txt">
            <b>{music.title}</b>
            <span>{music.artist || "Unbekannter Interpret"}</span>
          </div>
          <Eq on={music.playing} />
        </div>
        <div className="ix-bar">
          <i style={{ width: `${clamp01(music.progress) * 100}%` }} />
        </div>
        <div className="ix-actions music">
          <button type="button" className="ix-btn icon" aria-label="Vorheriger Titel" tabIndex={ti} onClick={onMusicPrev}>
            <SkipBack size={20} weight="fill" />
          </button>
          <button
            type="button"
            className="ix-btn icon primary"
            aria-label={music.playing ? "Pause" : "Abspielen"}
            tabIndex={ti}
            onClick={onMusicToggle}
          >
            {music.playing ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}
          </button>
          <button type="button" className="ix-btn icon" aria-label="Nächster Titel" tabIndex={ti} onClick={onMusicNext}>
            <SkipForward size={20} weight="fill" />
          </button>
        </div>
      </>
    );
  };

  const AIcon = a ? KINDS[a.kind].icon : Bell;

  return (
    <div className="ix-wrap">
      <div
        ref={ref}
        className="ix"
        data-mode={mode}
        data-kind={shown}
        data-n={String(Math.max(zones.length, 1))}
        data-pg={kinds.length > 1 ? "" : undefined}
        aria-live="polite"
      >
        {/* Ruhe */}
        <div className={`ix-layer ix-idle${mode === "idle" ? " on" : ""}`} aria-hidden="true">
          <span className="ix-lens" />
        </div>

        {/* Kompakt: bis zu drei Aktivitäten nebeneinander */}
        <div className={`ix-layer ix-compact${mode === "compact" ? " on" : ""}`}>
          {zones.map((k) => (
            <button
              key={k}
              type="button"
              className="ix-zone"
              tabIndex={mode === "compact" ? 0 : -1}
              aria-label={LABEL[k]}
              onClick={() => pick(k)}
            >
              {zone(k)}
            </button>
          ))}
        </div>

        {/* Groß */}
        <div
          className={`ix-layer ix-open${mode === "open" ? " on" : ""}`}
          aria-hidden={mode !== "open"}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div className={`ix-view ${shown}`} key={shown}>
            {view(shown)}
          </div>
          {kinds.length > 1 && (
            <div className="ix-dots">
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`ix-dotb${k === shown ? " on" : ""}`}
                  aria-label={`${LABEL[k]} anzeigen`}
                  tabIndex={ti}
                  onClick={() => setOpen(k)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Benachrichtigung */}
        <div
          className={`ix-layer ix-alert${mode === "alert" ? " on" : ""}${dragY !== 0 ? " drag" : ""}`}
          style={dragY !== 0 ? { transform: `translateX(-50%) translateY(${dragY}px)` } : undefined}
          role="button"
          tabIndex={mode === "alert" ? 0 : -1}
          aria-hidden={mode !== "alert"}
          aria-label={a ? `${a.title}. ${a.body}` : "Meldung"}
          onPointerDown={aDown}
          onPointerMove={aMove}
          onPointerUp={aUp}
          onPointerCancel={() => {
            press.current = null;
            setDragY(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && alert) onAlertOpen(alert);
          }}
        >
          <span className="ix-badge" style={{ background: a ? KINDS[a.kind].bg : undefined }}>
            <AIcon size={20} weight="fill" />
          </span>
          <span className="ix-txt">
            <b>{a?.title}</b>
            <span>{a?.body}</span>
          </span>
          <i className="ix-life" key={a?.id ?? "none"} />
        </div>

        {/* Timer abgelaufen */}
        <div className={`ix-layer ix-done${mode === "done" ? " on" : ""}`} aria-hidden={mode !== "done"}>
          <span className="ix-badge ring">
            <BellRinging size={22} weight="fill" />
          </span>
          <span className="ix-txt">
            <b>{lastDone.current}</b>
            <span>Abgelaufen</span>
          </span>
          <button
            type="button"
            className="ix-btn primary sm"
            tabIndex={mode === "done" ? 0 : -1}
            onClick={() => doneT && quick.reset(doneT.id)}
          >
            Stopp
          </button>
        </div>
      </div>
    </div>
  );
}