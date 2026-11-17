import { useEffect, useState } from "react";
import { Button } from "glisse";
import { Input } from "glisse";
import { Play, Stop } from "@phosphor-icons/react";
import { fmt, num } from "./lib";
import { Card, Facts, Field } from "./ui";
import "./tools2.css";

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/* =========================================================
   Atmen
   ========================================================= */

type Step = { label: string; sec: number; to: number };
type Pat = { id: string; label: string; steps: Step[] };

const IDLE: Step = { label: "Start", sec: 0.5, to: 0.55 };
const IN = (sec: number): Step => ({ label: "Einatmen", sec, to: 1 });
const OUT = (sec: number): Step => ({ label: "Ausatmen", sec, to: 0.55 });
const HOLD_FULL = (sec: number): Step => ({ label: "Halten", sec, to: 1 });
const HOLD_EMPTY = (sec: number): Step => ({ label: "Halten", sec, to: 0.55 });

const BOX: Pat = { id: "box", label: "Box 4-4-4-4", steps: [IN(4), HOLD_FULL(4), OUT(4), HOLD_EMPTY(4)] };
const PATS: Pat[] = [
  BOX,
  { id: "478", label: "4-7-8", steps: [IN(4), HOLD_FULL(7), OUT(8)] },
  { id: "calm", label: "Ruhig 5-5", steps: [IN(5), OUT(5)] },
];

export function Breathe({ small = false }: { small?: boolean }) {
  const [patId, setPatId] = useState("box");
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const pat = PATS.find((x) => x.id === patId) ?? BOX;
  const step: Step = pat.steps[i % pat.steps.length] ?? IDLE;

  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setI((n) => n + 1), step.sec * 1000);
    return () => window.clearTimeout(t);
  }, [on, i, step.sec]);

  const toggle = () => {
    setI(0);
    setOn(!on);
  };

  return (
    <div className="stack" style={small ? { height: "100%", gap: 0 } : undefined}>
      <button className="br-wrap" onClick={toggle} aria-label={on ? "Atemübung stoppen" : "Atemübung starten"}>
        <span className="br-ring" />
        <span
          className="br-orb"
          style={{
            transform: `scale(${on ? step.to : 0.55})`,
            transition: `transform ${on ? step.sec : 0.5}s ease-in-out`,
          }}
        />
        <span className="br-lbl">{on ? step.label : "Start"}</span>
      </button>
      {!small && (
        <>
          <div className="chips-wrap" style={{ paddingTop: 0, justifyContent: "center" }}>
            {PATS.map((p) => (
              <button
                key={p.id}
                className={`tag${patId === p.id ? " on" : ""}`}
                onClick={() => {
                  setPatId(p.id);
                  setI(0);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button icon={on ? <Stop size={18} weight="fill" /> : <Play size={18} weight="fill" />} onClick={toggle}>
            {on ? "Stopp" : "Start"}
          </Button>
        </>
      )}
    </div>
  );
}

/* =========================================================
   Schlaf
   ========================================================= */

const hm = (d: Date) => d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

/** Aufwachzeiten, wenn du zur Zeit `from` einschläfst (Zyklen à 90 Minuten, 15 Minuten zum Einschlafen). */
export function wakeTimes(from: number): string[] {
  return [4, 5, 6].map((n) => hm(new Date(from + (n * 90 + 15) * 60000)));
}

function SleepCard() {
  const [wake, setWake] = useState("07:00");
  const parts = wake.split(":").map(Number);
  const base = new Date();
  base.setHours(parts[0] ?? 7, parts[1] ?? 0, 0, 0);
  const beds = [6, 5, 4].map((n) => hm(new Date(base.getTime() - (n * 90 + 15) * 60000)));

  return (
    <Card title="Schlaf">
      <div className="stack">
        <Field label="Ich möchte aufstehen um">
          <input className="sel" type="time" value={wake} onChange={(e) => setWake(e.target.value)} aria-label="Aufstehzeit" />
        </Field>
        <Facts rows={[["6 Zyklen (9 h)", beds[0] ?? "-"], ["5 Zyklen (7,5 h)", beds[1] ?? "-"], ["4 Zyklen (6 h)", beds[2] ?? "-"]]} />
        <div className="row-sub">Wenn du jetzt einschläfst, wachst du am besten auf um:</div>
        <Facts rows={wakeTimes(Date.now()).map((t, i): [string, string] => [`${i + 4} Zyklen`, t])} />
      </div>
    </Card>
  );
}

/* =========================================================
   BMI, Kalorien, Wasser
   ========================================================= */

function BmiCard() {
  const [h, setH] = useState("175");
  const [w, setW] = useState("70");
  const m = num(h) / 100;
  const bmi = num(w) / (m * m);
  const ok = Number.isFinite(bmi) && bmi > 0;
  const cat = !ok ? "-" : bmi < 18.5 ? "Untergewicht" : bmi < 25 ? "Normalgewicht" : bmi < 30 ? "Übergewicht" : "Adipositas";
  const pos = ok ? clamp((bmi - 15) / 25, 0, 1) : 0;
  return (
    <Card title="BMI">
      <div className="stack">
        <div className="two">
          <Field label="Größe (cm)">
            <Input type="text" aria-label="Größe" value={h} onValueChange={setH} />
          </Field>
          <Field label="Gewicht (kg)">
            <Input type="text" aria-label="Gewicht" value={w} onValueChange={setW} />
          </Field>
        </div>
        <div className="big">{ok ? fmt(bmi, 1) : "-"}</div>
        <div className="bmi">{ok && <i style={{ left: `${pos * 100}%` }} />}</div>
        <div className="row-sub">{cat}</div>
        <p className="tip small">Richtwert nach WHO-Einteilung, keine medizinische Beratung.</p>
      </div>
    </Card>
  );
}

const ACTIVITY: [string, string][] = [
  ["1.2", "Kaum Bewegung"],
  ["1.375", "Leicht aktiv (1-3 Tage Sport)"],
  ["1.55", "Mäßig aktiv (3-5 Tage Sport)"],
  ["1.725", "Sehr aktiv (6-7 Tage Sport)"],
  ["1.9", "Extrem aktiv"],
];

function CalorieCard() {
  const [sex, setSex] = useState("m");
  const [age, setAge] = useState("30");
  const [h, setH] = useState("175");
  const [w, setW] = useState("70");
  const [act, setAct] = useState("1.55");
  const bmr = 10 * num(w) + 6.25 * num(h) - 5 * num(age) + (sex === "m" ? 5 : -161);
  const tdee = bmr * Number(act);
  return (
    <Card title="Kalorienbedarf">
      <div className="stack">
        <div className="chips-wrap" style={{ paddingTop: 0 }}>
          <button className={`tag${sex === "m" ? " on" : ""}`} onClick={() => setSex("m")}>
            Männlich
          </button>
          <button className={`tag${sex === "w" ? " on" : ""}`} onClick={() => setSex("w")}>
            Weiblich
          </button>
        </div>
        <div className="two">
          <Field label="Alter">
            <Input type="text" aria-label="Alter" value={age} onValueChange={setAge} />
          </Field>
          <Field label="Größe (cm)">
            <Input type="text" aria-label="Größe" value={h} onValueChange={setH} />
          </Field>
        </div>
        <Field label="Gewicht (kg)">
          <Input type="text" aria-label="Gewicht" value={w} onValueChange={setW} />
        </Field>
        <select className="sel" aria-label="Aktivität" value={act} onChange={(e) => setAct(e.target.value)}>
          {ACTIVITY.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Facts
          rows={[
            ["Grundumsatz", `${fmt(bmr, 0)} kcal`],
            ["Gesamtbedarf", `${fmt(tdee, 0)} kcal`],
            ["Abnehmen (-500)", `${fmt(tdee - 500, 0)} kcal`],
            ["Zunehmen (+300)", `${fmt(tdee + 300, 0)} kcal`],
          ]}
        />
        <p className="tip small">Formel nach Mifflin-St Jeor. Richtwerte, keine medizinische Beratung.</p>
      </div>
    </Card>
  );
}

function WaterCard() {
  const [w, setW] = useState("70");
  const [sport, setSport] = useState("1");
  const ml = num(w) * 35 + (num(sport) || 0) * 500;
  return (
    <Card title="Wasserbedarf">
      <div className="stack">
        <div className="two">
          <Field label="Gewicht (kg)">
            <Input type="text" aria-label="Gewicht" value={w} onValueChange={setW} />
          </Field>
          <Field label="Sport (Stunden)">
            <Input type="text" aria-label="Sport" value={sport} onValueChange={setSport} />
          </Field>
        </div>
        <div className="big">{Number.isFinite(ml) ? `${fmt(ml / 1000, 1)} Liter` : "-"}</div>
        <div className="row-sub">{Number.isFinite(ml) ? `etwa ${fmt(ml / 250, 0)} Gläser à 250 ml pro Tag` : ""}</div>
        <p className="tip small">Faustregel: 35 ml pro kg plus 0,5 Liter pro Stunde Sport.</p>
      </div>
    </Card>
  );
}

export function HealthTool() {
  return (
    <div className="fin stagger">
      <Card title="Atmen">
        <Breathe />
      </Card>
      <SleepCard />
      <BmiCard />
      <CalorieCard />
      <WaterCard />
    </div>
  );
}