import { useState } from "react";
import { Button, Input } from "glisse";
import { ArrowCounterClockwise, Flag, Pause, Play, Plus, Trash } from "@phosphor-icons/react";
import { num } from "./lib";
import { clock, clockMs, elapsedMs, leftSec, quick, useNow, useQuick } from "./quick";
import { Card, Field } from "./ui";
import "./widgets2.css";

const PRESETS: [string, number][] = [
  ["Tee", 3],
  ["Ei", 7],
  ["Nudeln", 10],
  ["Pizza", 12],
  ["Power-Nap", 20],
  ["Lernen", 45],
];

export function TimersTool() {
  const q = useQuick();
  const now = useNow(250, q.timers.length > 0 || q.sw.on);
  const [label, setLabel] = useState("");
  const [mins, setMins] = useState("5");

  const startCustom = () => {
    const m = num(mins);
    if (m > 0) {
      quick.add(label, m * 60);
      setLabel("");
    }
  };

  const sw = q.sw;
  const elapsed = elapsedMs(sw, now);

  return (
    <div className="fin stagger">
      <Card title="Timer">
        <div className="chips-wrap" style={{ paddingTop: 0, marginBottom: 14 }}>
          {PRESETS.map(([name, m]) => (
            <button key={name} className="tag" onClick={() => quick.add(name, m * 60)}>
              {name} · {m} min
            </button>
          ))}
        </div>

        <div
          className="two"
          onKeyDown={(e) => {
            if (e.key === "Enter") startCustom();
          }}
        >
          <Field label="Name (optional)">
            <Input type="text" aria-label="Name" placeholder="z. B. Wäsche" value={label} onValueChange={setLabel} />
          </Field>
          <Field label="Minuten">
            <Input type="text" aria-label="Minuten" value={mins} onValueChange={setMins} />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button icon={<Plus size={18} weight="bold" />} onClick={startCustom}>
            Timer starten
          </Button>
        </div>

        {q.timers.length === 0 && <div className="empty">Kein Timer aktiv</div>}
        {q.timers.map((t) => {
          const left = leftSec(t, now);
          const run = t.endAt !== null;
          return (
            <div className={`row tm-row${t.done ? " tm-done" : ""}`} key={t.id}>
              <div className="row-main">
                <div className="row-title">{t.label}</div>
                <div className="meter-bar" style={{ marginTop: 8 }}>
                  <i
                    style={{
                      width: `${t.done ? 100 : Math.min(Math.max((1 - left / t.total) * 100, 0), 100)}%`,
                      background: t.done ? "var(--red)" : "var(--orange)",
                    }}
                  />
                </div>
              </div>
              <div className="tm-time">{t.done ? "Fertig" : clock(left)}</div>
              {t.done ? (
                <Button icon={<ArrowCounterClockwise size={16} weight="bold" />} aria-label="Zurücksetzen" onClick={() => quick.reset(t.id)} />
              ) : (
                <Button
                  icon={run ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                  aria-label={run ? "Pause" : "Weiter"}
                  onClick={() => (run ? quick.pause(t.id) : quick.resume(t.id))}
                />
              )}
              <Button icon={<Trash size={16} />} aria-label="Timer löschen" onClick={() => quick.remove(t.id)} />
            </div>
          );
        })}
        <p className="tip small">Laufende Timer erscheinen in der Dynamic Island und klingeln, wenn sie ablaufen.</p>
      </Card>

      <Card title="Stoppuhr">
        <div className="sw-time">{clockMs(elapsed)}</div>
        <div className="controls" style={{ marginTop: 0 }}>
          <Button icon={sw.running ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />} onClick={sw.running ? quick.swPause : quick.swStart}>
            {sw.running ? "Stopp" : elapsed > 0 ? "Weiter" : "Start"}
          </Button>
          {sw.running && (
            <Button icon={<Flag size={18} weight="bold" />} onClick={quick.swLap}>
              Runde
            </Button>
          )}
          {sw.on && !sw.running && (
            <Button icon={<ArrowCounterClockwise size={18} weight="bold" />} onClick={quick.swReset}>
              Zurücksetzen
            </Button>
          )}
        </div>
        {sw.laps.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {[...sw.laps]
              .map((l, i, arr) => ({ n: i + 1, d: l - (arr[i - 1] ?? 0) }))
              .reverse()
              .map((l) => (
                <div className="lap" key={l.n}>
                  <span>Runde {l.n}</span>
                  <b>{clockMs(l.d)}</b>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}