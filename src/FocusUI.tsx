import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button, Input, Slider, Switch } from "glisse";
import { ArrowCounterClockwise, DeviceMobile, Lock, Pause, Play } from "@phosphor-icons/react";
import { formatMinutes, minutesFromSlider, sliderFromMinutes, sumDays } from "./lib";
import type { FocusLog } from "./lib";
import { AMBIENTS, AREAS, runShortcut } from "./focus";
import type { FocusCfg } from "./focus";
import { Card, Facts, FocusChart, Meter, Ring, SettingRow } from "./ui";

export type TimerApi = {
  mm: string;
  ss: string;
  progress: number;
  running: boolean;
  active: boolean;
  phase: "focus" | "break";
  minutes: number;
  round: number;
  distractions: number;
  locked: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setMinutes: (n: number) => void;
};

const breakFromSlider = (v: number) => 3 + Math.round((v / 100) * 27); // 3 bis 30
const sliderFromBreak = (m: number) => Math.round(((m - 3) / 27) * 100);

/** Button, der gedrückt gehalten werden muss. */
function HoldButton({ label, ms = 3000, onDone }: { label: string; ms?: number; onDone: () => void }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const startAt = useRef(0);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    startAt.current = 0;
    setP(0);
  };

  const begin = () => {
    if (startAt.current) return;
    startAt.current = performance.now();
    const tick = (now: number) => {
      const v = Math.min((now - startAt.current) / ms, 1);
      setP(v);
      if (v >= 1) {
        startAt.current = 0;
        setP(0);
        onDone();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <button
      type="button"
      className="hold"
      style={{ "--p": p } as CSSProperties}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={stop}
    >
      <span>{label}</span>
    </button>
  );
}

/* =========================================================
   Vollbild-Sperre
   ========================================================= */

export function LockOverlay({
  t,
  cfg,
  setCfg,
  taskTitle,
  onQuit,
}: {
  t: TimerApi;
  cfg: FocusCfg;
  setCfg: (c: FocusCfg) => void;
  taskTitle: string;
  onQuit: () => void;
}) {
  return (
    <div className="lockscreen" role="dialog" aria-modal="true" aria-label="Fokus-Sperre">
      <div className="lock-in">
        <div className="eyebrow lock-eyebrow">
          <Lock size={14} weight="fill" /> Fokus-Sperre · Runde {t.round}
        </div>

        <Ring className="lock-ring" progress={t.progress} stroke={3} fast>
          <div className="timer-time">
            {t.mm}:{t.ss}
          </div>
          <div className="timer-state">{t.running ? "Fokussiert" : "Pausiert"}</div>
        </Ring>

        {taskTitle && <div className="lock-task">{taskTitle}</div>}

        <div className="chips-wrap lock-sound">
          {AMBIENTS.map((a) => (
            <button
              key={a.id}
              className={`tag ${cfg.ambient === a.id ? "on" : ""}`}
              onClick={() => setCfg({ ...cfg, ambient: a.id })}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="lock-meta">Ablenkungen: {t.distractions}</div>

        <div className="controls" style={{ marginTop: 4 }}>
          {cfg.strict ? (
            <HoldButton label="3 Sekunden halten zum Beenden" onDone={onQuit} />
          ) : (
            <>
              {t.running ? (
                <Button icon={<Pause size={20} weight="fill" />} onClick={t.pause}>
                  Pause
                </Button>
              ) : (
                <Button icon={<Play size={20} weight="fill" />} onClick={t.start}>
                  Weiter
                </Button>
              )}
              <Button icon={<ArrowCounterClockwise size={20} weight="bold" />} onClick={onQuit}>
                Beenden
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Fokus-Seite
   ========================================================= */

export function FocusPanel({
  t,
  cfg,
  setCfg,
  tasks,
  taskId,
  setTaskId,
  log,
  goal,
  sessionsToday,
}: {
  t: TimerApi;
  cfg: FocusCfg;
  setCfg: (c: FocusCfg) => void;
  tasks: { id: number; title: string; done: boolean }[];
  taskId: number | null;
  setTaskId: (id: number | null) => void;
  log: FocusLog;
  goal: number;
  sessionsToday: number;
}) {
  const set = (p: Partial<FocusCfg>) => setCfg({ ...cfg, ...p });
  const strictLock = t.locked && cfg.strict;
  const focusToday = sumDays(log, 1);
  const label = t.phase === "focus" ? (t.running ? "Fokussiert" : t.active ? "Pausiert" : "Bereit") : "Pause";

  const toggleArea = (id: string) =>
    set({ blocked: cfg.blocked.includes(id) ? cfg.blocked.filter((x) => x !== id) : [...cfg.blocked, id] });

  return (
    <div className="split">
      <div className="col stack-lg">
        <section className="card spot timer-card">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t.phase === "focus" ? `Runde ${t.round}` : "Kurze Pause"}
          </div>
          <Ring className="timer-ring" progress={t.progress} stroke={4} fast>
            <div className="timer-time">
              {t.mm}:{t.ss}
            </div>
            <div className="timer-state">{label}</div>
          </Ring>

          <div className="controls">
            {strictLock ? (
              <HoldButton label="3 Sekunden halten zum Beenden" onDone={t.reset} />
            ) : (
              <>
                {!t.running ? (
                  <Button icon={<Play size={20} weight="fill" />} onClick={t.start}>
                    {t.active ? "Weiter" : "Start"}
                  </Button>
                ) : (
                  <Button icon={<Pause size={20} weight="fill" />} onClick={t.pause}>
                    Pause
                  </Button>
                )}
                {t.active && (
                  <Button icon={<ArrowCounterClockwise size={20} weight="bold" />} onClick={t.reset}>
                    Zurücksetzen
                  </Button>
                )}
              </>
            )}
          </div>

          {!t.active && (
            <div className="presets">
              {[15, 25, 45, 60].map((v) => (
                <Button key={v} onClick={() => t.setMinutes(v)}>
                  {v} min
                </Button>
              ))}
            </div>
          )}
        </section>

        <Card title="Woran arbeitest du?">
          <select
            className="sel"
            aria-label="Aufgabe für diese Session"
            value={taskId ?? ""}
            onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Keine bestimmte Aufgabe</option>
            {tasks
              .filter((x) => !x.done)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
          </select>
        </Card>

        <Card title="Fokus-Sperre" action={<Lock size={18} weight="fill" />}>
          <SettingRow title="Sperre aktiv" sub="Gesperrt, solange eine Session läuft. Meldungen sind stumm.">
            <Switch
              aria-label="Sperre aktiv"
              checked={cfg.lock}
              disabled={strictLock}
              onCheckedChange={(v: boolean) => set({ lock: v })}
            />
          </SettingRow>
          <SettingRow title="Vollbild-Sperre" sub="Blendet die ganze App aus, nur der Timer bleibt">
            <Switch
              aria-label="Vollbild-Sperre"
              checked={cfg.overlay}
              disabled={strictLock}
              onCheckedChange={(v: boolean) => set({ overlay: v })}
            />
          </SettingRow>
          <SettingRow title="Streng" sub="Kein Pausieren, Beenden nur durch 3 Sekunden Halten">
            <Switch
              aria-label="Streng"
              checked={cfg.strict}
              disabled={strictLock}
              onCheckedChange={(v: boolean) => set({ strict: v })}
            />
          </SettingRow>
          <SettingRow title="Browser-Vollbild" sub="Nicht auf dem iPhone verfügbar">
            <Switch
              aria-label="Browser-Vollbild"
              checked={cfg.fullscreen}
              disabled={strictLock}
              onCheckedChange={(v: boolean) => set({ fullscreen: v })}
            />
          </SettingRow>
          <SettingRow title="Bildschirm anlassen" sub="Verhindert das Abdunkeln, solange der Timer läuft">
            <Switch aria-label="Bildschirm anlassen" checked={cfg.wake} onCheckedChange={(v: boolean) => set({ wake: v })} />
          </SettingRow>

          <div className="row row-col">
            <div className="row-head">
              <div className="row-title">Gesperrte Bereiche</div>
              <span className="muted-sm">{cfg.blocked.length} gewählt</span>
            </div>
            <div className="chips-wrap" style={{ paddingTop: 0 }}>
              {AREAS.map((a) => (
                <button
                  key={a.id}
                  className={`tag ${cfg.blocked.includes(a.id) ? "on" : ""}`}
                  disabled={strictLock}
                  aria-pressed={cfg.blocked.includes(a.id)}
                  onClick={() => toggleArea(a.id)}
                >
                  {cfg.blocked.includes(a.id) ? "🔒 " : ""}
                  {a.label}
                </button>
              ))}
            </div>
            <div className="row-sub">
              Die Fokus-Seite bleibt immer offen. Mit der Vollbild-Sperre ist ohnehin alles gesperrt.
            </div>
          </div>
        </Card>
      </div>

      <aside className="split-side free">
        <Card title="Dauer" action={<span className="muted-sm">{t.minutes} min</span>}>
          <Slider
            aria-label="Dauer in Minuten"
            value={sliderFromMinutes(t.minutes)}
            disabled={t.active}
            onValueChange={(v: number) => t.setMinutes(minutesFromSlider(v))}
          />
          <SettingRow title="Pomodoro-Zyklus" sub="Nach jeder Runde automatisch Pause, dann weiter">
            <Switch aria-label="Pomodoro" checked={cfg.cycles} onCheckedChange={(v: boolean) => set({ cycles: v })} />
          </SettingRow>
          {cfg.cycles && (
            <div className="row row-col">
              <div className="row-head">
                <div className="row-title">Pause</div>
                <span className="muted-sm">{cfg.breakMin} min</span>
              </div>
              <Slider
                aria-label="Pausenlänge"
                value={sliderFromBreak(cfg.breakMin)}
                onValueChange={(v: number) => set({ breakMin: breakFromSlider(v) })}
              />
            </div>
          )}
        </Card>

        <Card title="Hintergrundklang">
          <div className="chips-wrap" style={{ paddingTop: 0 }}>
            {AMBIENTS.map((a) => (
              <button
                key={a.id}
                className={`tag ${cfg.ambient === a.id ? "on" : ""}`}
                onClick={() => set({ ambient: a.id })}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="meter-head" style={{ marginTop: 14 }}>
            <span>Lautstärke</span>
            <b>{cfg.ambientVol}%</b>
          </div>
          <Slider aria-label="Klang-Lautstärke" value={cfg.ambientVol} onValueChange={(v: number) => set({ ambientVol: v })} />
          <p className="tip small">Der Klang läuft, solange der Timer in einer Fokus-Runde läuft.</p>
        </Card>

        <Card title="Handy sperren" action={<DeviceMobile size={18} weight="fill" />}>
          <p className="tip">
            Eine Web-App kann andere Apps nicht selbst sperren. Mit einem <b>iOS-Kurzbefehl</b>, der den
            Fokus-Modus einschaltet, geht es trotzdem. Lege in der Kurzbefehle-App zwei Kurzbefehle an („Fokus an“ und
            „Fokus aus“, Aktion „Fokus festlegen“) und trage hier ihre Namen ein.
          </p>
          <div className="stack" style={{ marginTop: 14 }}>
            <div className="two">
              <Input
                type="text"
                aria-label="Kurzbefehl An"
                placeholder="Fokus an"
                value={cfg.shortcutOn}
                onValueChange={(v: string) => set({ shortcutOn: v })}
              />
              <Input
                type="text"
                aria-label="Kurzbefehl Aus"
                placeholder="Fokus aus"
                value={cfg.shortcutOff}
                onValueChange={(v: string) => set({ shortcutOff: v })}
              />
            </div>
            <div className="two">
              <Button onClick={() => runShortcut(cfg.shortcutOn)}>Handy-Fokus an</Button>
              <Button onClick={() => runShortcut(cfg.shortcutOff)}>Handy-Fokus aus</Button>
            </div>
            <SettingRow title="Beim Start auslösen" sub="Öffnet beim Start kurz die Kurzbefehle-App">
              <Switch
                aria-label="Kurzbefehl beim Start"
                checked={cfg.shortcutAuto}
                onCheckedChange={(v: boolean) => set({ shortcutAuto: v })}
              />
            </SettingRow>
          </div>
          <p className="tip small">
            Auf Android nutzt du den „Fokusmodus“ in Digital Wellbeing. Das lässt sich nicht aus einer Webseite starten.
          </p>
        </Card>

        <Card title="Heute">
          <Facts
            rows={[
              ["Sessions", String(sessionsToday)],
              ["Fokuszeit", formatMinutes(focusToday)],
              ["Ablenkungen (aktuell)", String(t.distractions)],
            ]}
          />
          <div style={{ marginTop: 12 }}>
            <Meter
              label="Tagesziel"
              text={`${formatMinutes(focusToday)} / ${formatMinutes(goal)}`}
              value={focusToday}
              max={goal}
              color="linear-gradient(90deg, var(--accent), var(--purple))"
            />
          </div>
        </Card>

        <Card title="Letzte 7 Tage" action={<span className="muted-sm">{formatMinutes(sumDays(log, 7))}</span>}>
          <FocusChart log={log} goal={goal} days={7} />
        </Card>
      </aside>
    </div>
  );
}