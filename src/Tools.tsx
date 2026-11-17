import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, SegmentedControl, Slider } from "glisse";
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  ArrowsLeftRight,
  Copy,
  Flag,
  Minus,
  Pause,
  Play,
  Plus,
} from "@phosphor-icons/react";
import { evaluate, fmt, money, num, pad, resultText, useStored } from "./lib";
import { Card, Facts, Field } from "./ui";
import type { MarketState } from "./Market";

/* =========================================================
   Schnellrechner (für das Dashboard)
   ========================================================= */

export function QuickCalc() {
  const [e, setE] = useState("");
  let out: number | null = null;
  if (e.trim()) {
    try {
      out = evaluate(e);
    } catch {
      out = null;
    }
  }
  return (
    <div>
      <Input
        type="text"
        aria-label="Schnellrechner"
        placeholder="z. B. 1200 * 1,2 + 15 %"
        value={e}
        onValueChange={setE}
      />
      <div className="quick-out">
        <span className="big">{out === null ? "–" : fmt(out, 10)}</span>
        {out !== null && (
          <Button
            icon={<Copy size={18} />}
            aria-label="Kopieren"
            onClick={() => {
              const v = out;
              if (v !== null) navigator.clipboard?.writeText(String(Number(v.toPrecision(12)))).catch(() => {});
            }}
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Taschenrechner
   ========================================================= */

type Hist = { e: string; r: string };

const KEYS: [string, string][][] = [
  [["C", "fn"], ["(", "fn"], [")", "fn"], ["÷", "op"]],
  [["7", ""], ["8", ""], ["9", ""], ["×", "op"]],
  [["4", ""], ["5", ""], ["6", ""], ["−", "op"]],
  [["1", ""], ["2", ""], ["3", ""], ["+", "op"]],
  [["0", ""], [",", ""], ["⌫", "fn"], ["=", "eq"]],
];
const SCI = ["√", "^", "%", "π"];

function Calculator() {
  const [expr, setExpr] = useState("");
  const [hist, setHist] = useStored<Hist[]>("ios-calc-history", []);

  const live = useMemo(() => {
    if (!expr.trim()) return null;
    try {
      return evaluate(expr);
    } catch {
      return null;
    }
  }, [expr]);

  const commit = () => {
    if (live === null) return;
    const r = resultText(live);
    setHist([{ e: expr, r }, ...hist].slice(0, 30));
    setExpr(r);
  };

  const press = (k: string) => {
    if (k === "C") setExpr("");
    else if (k === "⌫") setExpr(expr.slice(0, -1));
    else if (k === "=") commit();
    else if (k === "√") setExpr(expr + "√(");
    else setExpr(expr + k);
  };

  return (
    <div className="split">
      <Card className="calc">
        <div
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        >
          <Input
            type="text"
            aria-label="Rechnung"
            placeholder="Rechnung eingeben oder tippen"
            value={expr}
            onValueChange={setExpr}
          />
        </div>
        <div className="calc-out">{live === null ? (expr ? "…" : "0") : fmt(live, 10)}</div>

        <div className="keypad">
          {SCI.map((k) => (
            <button key={k} className="key sci" onClick={() => press(k)}>
              {k}
            </button>
          ))}
          {KEYS.flat().map(([k, t]) => (
            <button key={k} className={`key ${t}`} onClick={() => press(k ?? "")} aria-label={k === "⌫" ? "Löschen" : k}>
              {k}
            </button>
          ))}
        </div>
      </Card>

      <aside className="split-side">
        <Card
          title="Verlauf"
          action={
            hist.length > 0 ? (
              <button className="link" onClick={() => setHist([])}>
                Leeren
              </button>
            ) : undefined
          }
        >
          {hist.length === 0 && <div className="empty">Noch keine Rechnungen</div>}
          {hist.map((h, i) => (
            <button key={i} className="hist" onClick={() => setExpr(h.r)}>
              <span>{h.e}</span>
              <b>= {h.r}</b>
            </button>
          ))}
        </Card>
        <Card title="Tipp">
          <p className="tip">
            Du kannst auch tippen: <b>200 + 10 %</b> (ergibt 220), <b>sqrt(81)</b>, <b>2^10</b>, <b>pi * 5^2</b>. Mit
            Enter wird das Ergebnis übernommen.
          </p>
        </Card>
      </aside>
    </div>
  );
}

/* =========================================================
   Währungsrechner
   ========================================================= */

const CUR_NAMES: Record<string, string> = {
  EUR: "Euro",
  USD: "US-Dollar",
  CHF: "Schweizer Franken",
  GBP: "Britisches Pfund",
  JPY: "Japanischer Yen",
  TRY: "Türkische Lira",
  PLN: "Polnischer Zloty",
  CZK: "Tschechische Krone",
  HUF: "Ungarischer Forint",
  SEK: "Schwedische Krone",
  NOK: "Norwegische Krone",
  DKK: "Dänische Krone",
  CAD: "Kanadischer Dollar",
  AUD: "Australischer Dollar",
  CNY: "Chinesischer Yuan",
  INR: "Indische Rupie",
  BRL: "Brasilianischer Real",
  RON: "Rumänischer Leu",
  BGN: "Bulgarischer Lew",
};
const TOP = ["EUR", "USD", "CHF", "GBP", "TRY", "JPY"];

function Currency({ m }: { m: MarketState }) {
  const [fx, setFx] = useStored("ios-fx", { amt: "100", from: "EUR", to: "USD" });
  const [busy, setBusy] = useState(false);

  const R: Record<string, number | undefined> = { EUR: 1, ...m.rates.r };
  /** Kurs gegenüber EUR, oder NaN wenn es ihn nicht gibt. */
  const rateOf = (code: string): number => R[code] ?? NaN;

  const codes = Object.keys(R).sort((a, b) => {
    const ia = TOP.indexOf(a);
    const ib = TOP.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
  const hasRates = Object.keys(m.rates.r).length > 0;

  const a = num(fx.amt);
  const rate = rateOf(fx.to) / rateOf(fx.from);
  const out = a * rate;

  const refresh = async () => {
    setBusy(true);
    await m.refreshRates();
    setBusy(false);
  };

  const opt = (c: string) => (
    <option key={c} value={c}>
      {c}
      {CUR_NAMES[c] ? ` · ${CUR_NAMES[c]}` : ""}
    </option>
  );

  return (
    <div className="split">
      <Card
        title="Währung umrechnen"
        action={
          <Button
            icon={<ArrowsClockwise size={18} weight="bold" className={busy ? "spin" : ""} />}
            aria-label="Kurse aktualisieren"
            onClick={refresh}
          />
        }
      >
        {!hasRates ? (
          <div className="empty">
            Kurse werden geladen …
            <div style={{ marginTop: 12 }}>
              <Button onClick={refresh}>Erneut versuchen</Button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <Field label="Betrag">
              <Input type="text" aria-label="Betrag" value={fx.amt} onValueChange={(v: string) => setFx({ ...fx, amt: v })} />
            </Field>
            <div className="swap">
              <Field label="Von">
                <select className="sel" value={fx.from} onChange={(e) => setFx({ ...fx, from: e.target.value })} aria-label="Von">
                  {codes.map(opt)}
                </select>
              </Field>
              <Button
                icon={<ArrowsLeftRight size={18} weight="bold" />}
                aria-label="Tauschen"
                onClick={() => setFx({ ...fx, from: fx.to, to: fx.from })}
              />
              <Field label="Nach">
                <select className="sel" value={fx.to} onChange={(e) => setFx({ ...fx, to: e.target.value })} aria-label="Nach">
                  {codes.map(opt)}
                </select>
              </Field>
            </div>
            <div className="big">
              {fmt(out, 4)} {fx.to}
            </div>
            <div className="row-sub">
              1 {fx.from} = {fmt(rate, 6)} {fx.to}
            </div>
          </div>
        )}
      </Card>

      <aside className="split-side">
        <Card title="Schnellübersicht">
          <Facts
            rows={[
              ["100 EUR in USD", fmt(100 * rateOf("USD"))],
              ["100 EUR in CHF", fmt(100 * rateOf("CHF"))],
              ["100 EUR in GBP", fmt(100 * rateOf("GBP"))],
              ["100 EUR in TRY", fmt(100 * rateOf("TRY"))],
            ]}
          />
          <p className="tip small">
            Referenzkurse der Europäischen Zentralbank (einmal pro Werktag). Banken und Wechselstuben rechnen mit
            anderen Kursen.
            {m.rates.at > 0 && ` Stand: ${new Date(m.rates.at).toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" })}.`}
          </p>
        </Card>
      </aside>
    </div>
  );
}

/* =========================================================
   Einheiten
   ========================================================= */

type Unit = { id: string; label: string; f: number };
type UCat = { id: string; label: string; units: Unit[]; temp?: boolean };

const LENGTH: UCat = {
  id: "length",
  label: "Länge",
  units: [
    { id: "mm", label: "Millimeter", f: 0.001 },
    { id: "cm", label: "Zentimeter", f: 0.01 },
    { id: "m", label: "Meter", f: 1 },
    { id: "km", label: "Kilometer", f: 1000 },
    { id: "in", label: "Zoll", f: 0.0254 },
    { id: "ft", label: "Fuß", f: 0.3048 },
    { id: "yd", label: "Yard", f: 0.9144 },
    { id: "mi", label: "Meilen", f: 1609.344 },
  ],
};
const UCATS: UCat[] = [
  LENGTH,
  {
    id: "mass",
    label: "Gewicht",
    units: [
      { id: "g", label: "Gramm", f: 0.001 },
      { id: "kg", label: "Kilogramm", f: 1 },
      { id: "t", label: "Tonnen", f: 1000 },
      { id: "oz", label: "Unzen", f: 0.028349523125 },
      { id: "lb", label: "Pfund (lb)", f: 0.45359237 },
    ],
  },
  {
    id: "volume",
    label: "Volumen",
    units: [
      { id: "ml", label: "Milliliter", f: 0.001 },
      { id: "l", label: "Liter", f: 1 },
      { id: "gal", label: "Gallonen (US)", f: 3.785411784 },
      { id: "floz", label: "Fl. oz (US)", f: 0.0295735295625 },
      { id: "cup", label: "Cups (US)", f: 0.2365882365 },
    ],
  },
  {
    id: "area",
    label: "Fläche",
    units: [
      { id: "cm2", label: "cm²", f: 0.0001 },
      { id: "m2", label: "m²", f: 1 },
      { id: "ha", label: "Hektar", f: 10000 },
      { id: "km2", label: "km²", f: 1000000 },
      { id: "ft2", label: "ft²", f: 0.09290304 },
      { id: "ac", label: "Acre", f: 4046.8564224 },
    ],
  },
  {
    id: "speed",
    label: "Tempo",
    units: [
      { id: "ms", label: "m/s", f: 1 },
      { id: "kmh", label: "km/h", f: 1 / 3.6 },
      { id: "mph", label: "mph", f: 0.44704 },
      { id: "kn", label: "Knoten", f: 0.514444 },
    ],
  },
  {
    id: "temp",
    label: "Temperatur",
    temp: true,
    units: [
      { id: "C", label: "Celsius", f: 1 },
      { id: "F", label: "Fahrenheit", f: 1 },
      { id: "K", label: "Kelvin", f: 1 },
    ],
  },
  {
    id: "data",
    label: "Daten",
    units: [
      { id: "B", label: "Byte", f: 1 },
      { id: "KB", label: "Kilobyte", f: 1e3 },
      { id: "MB", label: "Megabyte", f: 1e6 },
      { id: "GB", label: "Gigabyte", f: 1e9 },
      { id: "TB", label: "Terabyte", f: 1e12 },
    ],
  },
];

function convert(cat: UCat, v: number, from: string, to: string): number {
  if (cat.temp) {
    const c = from === "C" ? v : from === "F" ? ((v - 32) * 5) / 9 : v - 273.15;
    return to === "C" ? c : to === "F" ? (c * 9) / 5 + 32 : c + 273.15;
  }
  const a = cat.units.find((u) => u.id === from)?.f;
  const b = cat.units.find((u) => u.id === to)?.f;
  return a === undefined || b === undefined ? NaN : (v * a) / b;
}

function Units() {
  const [u, setU] = useStored("ios-units", { cat: "length", amt: "1", from: "m", to: "ft" });
  const cat = UCATS.find((c) => c.id === u.cat) ?? LENGTH;
  const a = num(u.amt);
  const out = convert(cat, a, u.from, u.to);

  const pick = (id: string) => {
    const c = UCATS.find((x) => x.id === id) ?? LENGTH;
    const first = c.units[0]?.id ?? "";
    setU({ ...u, cat: c.id, from: first, to: c.units[1]?.id ?? first });
  };

  const opts = cat.units.map((x) => (
    <option key={x.id} value={x.id}>
      {x.label}
    </option>
  ));

  return (
    <div className="split">
      <Card title="Einheiten umrechnen">
        <div className="stack">
          <div className="chips-wrap" style={{ paddingTop: 0 }}>
            {UCATS.map((c) => (
              <button key={c.id} className={`tag ${c.id === cat.id ? "on" : ""}`} onClick={() => pick(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <Field label="Wert">
            <Input type="text" aria-label="Wert" value={u.amt} onValueChange={(v: string) => setU({ ...u, amt: v })} />
          </Field>
          <div className="swap">
            <Field label="Von">
              <select className="sel" value={u.from} onChange={(e) => setU({ ...u, from: e.target.value })} aria-label="Von">
                {opts}
              </select>
            </Field>
            <Button
              icon={<ArrowsLeftRight size={18} weight="bold" />}
              aria-label="Tauschen"
              onClick={() => setU({ ...u, from: u.to, to: u.from })}
            />
            <Field label="Nach">
              <select className="sel" value={u.to} onChange={(e) => setU({ ...u, to: e.target.value })} aria-label="Nach">
                {opts}
              </select>
            </Field>
          </div>
          <div className="big">{fmt(out, 6)}</div>
        </div>
      </Card>

      <aside className="split-side">
        <Card title="Alle Einheiten">
          <Facts
            rows={cat.units.map((x): [string, string] => [x.label, fmt(convert(cat, a, u.from, x.id), 6)])}
          />
        </Card>
      </aside>
    </div>
  );
}

/* =========================================================
   Zeit: Stoppuhr und Weltzeit
   ========================================================= */

const fmtMs = (v: number) => {
  const mi = Math.floor(v / 60000);
  const s = Math.floor(v / 1000) % 60;
  const c = Math.floor(v / 10) % 100;
  return `${pad(mi)}:${pad(s)}.${pad(c)}`;
};

function Stopwatch() {
  const [ms, setMs] = useState(0);
  const [on, setOn] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const startAt = useRef(0);
  const acc = useRef(0);

  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setMs(acc.current + performance.now() - startAt.current), 50);
    return () => window.clearInterval(id);
  }, [on]);

  const toggle = () => {
    if (on) {
      acc.current += performance.now() - startAt.current;
      setMs(acc.current);
      setOn(false);
    } else {
      startAt.current = performance.now();
      setOn(true);
    }
  };
  const reset = () => {
    acc.current = 0;
    setMs(0);
    setOn(false);
    setLaps([]);
  };

  return (
    <Card title="Stoppuhr">
      <div className="sw-time">{fmtMs(ms)}</div>
      <div className="controls" style={{ marginTop: 0 }}>
        <Button icon={on ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />} onClick={toggle}>
          {on ? "Stopp" : ms > 0 ? "Weiter" : "Start"}
        </Button>
        {on && (
          <Button icon={<Flag size={18} weight="bold" />} onClick={() => setLaps([ms, ...laps])}>
            Runde
          </Button>
        )}
        {ms > 0 && !on && (
          <Button icon={<ArrowCounterClockwise size={18} weight="bold" />} onClick={reset}>
            Zurücksetzen
          </Button>
        )}
      </div>
      {laps.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {laps.map((l, i) => (
            <div className="lap" key={laps.length - i}>
              <span>Runde {laps.length - i}</span>
              <b>{fmtMs(l - (laps[i + 1] ?? 0))}</b>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const ZONES: { tz: string; label: string }[] = [
  { tz: "Europe/Vienna", label: "Wien" },
  { tz: "Europe/London", label: "London" },
  { tz: "Europe/Istanbul", label: "Istanbul" },
  { tz: "America/New_York", label: "New York" },
  { tz: "America/Los_Angeles", label: "Los Angeles" },
  { tz: "Asia/Dubai", label: "Dubai" },
  { tz: "Asia/Tokyo", label: "Tokio" },
  { tz: "Australia/Sydney", label: "Sydney" },
];

function WorldClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <Card title="Weltzeit" className="list world">
      {ZONES.map((z) => (
        <div className="row" key={z.tz}>
          <div className="row-main">
            <div className="row-title">{z.label}</div>
            <div className="row-sub">
              {now.toLocaleDateString("de-AT", { timeZone: z.tz, weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>
          <span className="clock">
            {now.toLocaleTimeString("de-AT", { timeZone: z.tz, hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </Card>
  );
}

/* =========================================================
   Finanzrechner
   ========================================================= */

function VatCard() {
  const [amt, setAmt] = useState("100");
  const [rate, setRate] = useState("20");
  const [mode, setMode] = useState("net");
  const a = num(amt);
  const r = Number(rate) / 100;
  const net = mode === "net" ? a : a / (1 + r);
  const gross = mode === "net" ? a * (1 + r) : a;
  return (
    <Card title="Mehrwertsteuer">
      <div className="stack">
        <SegmentedControl
          aria-label="Richtung"
          items={[
            { value: "net", label: "Netto → Brutto" },
            { value: "gross", label: "Brutto → Netto" },
          ]}
          value={mode}
          onValueChange={setMode}
        />
        <Field label={mode === "net" ? "Netto" : "Brutto"}>
          <Input type="text" aria-label="Betrag" value={amt} onValueChange={setAmt} />
        </Field>
        <SegmentedControl
          aria-label="Steuersatz"
          items={[
            { value: "10", label: "10 %" },
            { value: "13", label: "13 %" },
            { value: "20", label: "20 %" },
          ]}
          value={rate}
          onValueChange={setRate}
        />
        <Facts rows={[["Netto", money(net)], ["MwSt", money(gross - net)], ["Brutto", money(gross)]]} />
      </div>
    </Card>
  );
}

function PercentCard() {
  const [mode, setMode] = useState("of");
  const [x, setX] = useState("15");
  const [y, setY] = useState("200");
  const a = num(x);
  const b = num(y);
  const labels: Record<string, [string, string]> = {
    of: ["Prozent", "Grundwert"],
    share: ["Teil", "Gesamt"],
    change: ["Alter Wert", "Neuer Wert"],
  };
  const [labelA, labelB] = labels[mode] ?? ["Wert 1", "Wert 2"];
  const result =
    mode === "of" ? `${fmt((a / 100) * b, 4)}` : mode === "share" ? `${fmt((a / b) * 100, 2)} %` : `${fmt(((b - a) / a) * 100, 2)} %`;
  return (
    <Card title="Prozent">
      <div className="stack">
        <SegmentedControl
          aria-label="Art"
          items={[
            { value: "of", label: "% von" },
            { value: "share", label: "Anteil" },
            { value: "change", label: "Änderung" },
          ]}
          value={mode}
          onValueChange={setMode}
        />
        <div className="two">
          <Field label={labelA}>
            <Input type="text" aria-label={labelA} value={x} onValueChange={setX} />
          </Field>
          <Field label={labelB}>
            <Input type="text" aria-label={labelB} value={y} onValueChange={setY} />
          </Field>
        </div>
        <div className="big">{result}</div>
      </div>
    </Card>
  );
}

function TipCard() {
  const [bill, setBill] = useState("48,50");
  const [tipS, setTipS] = useState(40);
  const [people, setPeople] = useState(2);
  const tipPct = Math.round((tipS / 100) * 25);
  const b = num(bill);
  const tip = (b * tipPct) / 100;
  return (
    <Card title="Trinkgeld & Teilen">
      <div className="stack">
        <Field label="Rechnung">
          <Input type="text" aria-label="Rechnung" value={bill} onValueChange={setBill} />
        </Field>
        <div>
          <div className="meter-head">
            <span>Trinkgeld</span>
            <b>{tipPct} %</b>
          </div>
          <Slider aria-label="Trinkgeld" value={tipS} onValueChange={setTipS} />
        </div>
        <div className="stepper">
          <span>Personen</span>
          <Button icon={<Minus size={18} weight="bold" />} aria-label="Weniger" onClick={() => setPeople(Math.max(1, people - 1))} />
          <b>{people}</b>
          <Button icon={<Plus size={18} weight="bold" />} aria-label="Mehr" onClick={() => setPeople(Math.min(30, people + 1))} />
        </div>
        <Facts
          rows={[
            ["Trinkgeld", money(tip)],
            ["Gesamt", money(b + tip)],
            ["Pro Person", money((b + tip) / people)],
          ]}
        />
      </div>
    </Card>
  );
}

function SavingsCard() {
  const [start, setStart] = useState("1000");
  const [monthly, setMonthly] = useState("200");
  const [rate, setRate] = useState("7");
  const [yearsS, setYearsS] = useState(33);
  const years = 1 + Math.round((yearsS / 100) * 39); // 1 bis 40
  const s = num(start) || 0;
  const mo = num(monthly) || 0;
  const r = (num(rate) || 0) / 100 / 12;
  const n = years * 12;
  const growth = Math.pow(1 + r, n);
  const final = s * growth + (r === 0 ? mo * n : mo * ((growth - 1) / r));
  const paid = s + mo * n;
  return (
    <Card title="Sparplan">
      <div className="stack">
        <div className="two">
          <Field label="Startkapital">
            <Input type="text" aria-label="Startkapital" value={start} onValueChange={setStart} />
          </Field>
          <Field label="Monatlich">
            <Input type="text" aria-label="Monatlich" value={monthly} onValueChange={setMonthly} />
          </Field>
        </div>
        <Field label="Rendite pro Jahr (%)">
          <Input type="text" aria-label="Rendite" value={rate} onValueChange={setRate} />
        </Field>
        <div>
          <div className="meter-head">
            <span>Laufzeit</span>
            <b>{years} Jahre</b>
          </div>
          <Slider aria-label="Laufzeit" value={yearsS} onValueChange={setYearsS} />
        </div>
        <div className="big">{money(final)}</div>
        <Facts rows={[["Eingezahlt", money(paid)], ["Zinsertrag", money(final - paid)]]} />
        <p className="tip small">Rechenbeispiel mit gleichbleibender Rendite, ohne Steuern und Gebühren.</p>
      </div>
    </Card>
  );
}

function LoanCard() {
  const [amount, setAmount] = useState("20000");
  const [rate, setRate] = useState("5");
  const [yearsS, setYearsS] = useState(12);
  const years = 1 + Math.round((yearsS / 100) * 29); // 1 bis 30
  const p = num(amount) || 0;
  const r = (num(rate) || 0) / 100 / 12;
  const n = years * 12;
  const pay = r === 0 ? p / n : (p * r) / (1 - Math.pow(1 + r, -n));
  return (
    <Card title="Kreditrechner">
      <div className="stack">
        <div className="two">
          <Field label="Kreditsumme">
            <Input type="text" aria-label="Kreditsumme" value={amount} onValueChange={setAmount} />
          </Field>
          <Field label="Zinssatz (%)">
            <Input type="text" aria-label="Zinssatz" value={rate} onValueChange={setRate} />
          </Field>
        </div>
        <div>
          <div className="meter-head">
            <span>Laufzeit</span>
            <b>{years} Jahre</b>
          </div>
          <Slider aria-label="Laufzeit" value={yearsS} onValueChange={setYearsS} />
        </div>
        <div className="big">{money(pay)} / Monat</div>
        <Facts rows={[["Gesamtkosten", money(pay * n)], ["Zinsen", money(pay * n - p)]]} />
        <p className="tip small">Annuitätenkredit mit gleichbleibender Rate, ohne Gebühren.</p>
      </div>
    </Card>
  );
}

/* =========================================================
   Tools-Seite
   ========================================================= */

export function Tools({ m }: { m: MarketState }) {
  const [view, setView] = useStored("ios-tools-view", "calc");
  return (
    <div className="page" key="tools">
      <header className="head">
        <div>
          <div className="eyebrow">Rechnen im Alltag</div>
          <h1 className="large-title">Tools</h1>
        </div>
        <div className="seg wider">
          <SegmentedControl
            aria-label="Werkzeug"
            items={[
              { value: "calc", label: "Rechner" },
              { value: "fx", label: "Währung" },
              { value: "fin", label: "Finanzen" },
              { value: "units", label: "Einheiten" },
              { value: "time", label: "Zeit" },
            ]}
            value={view}
            onValueChange={setView}
          />
        </div>
      </header>

      {view === "calc" && <Calculator />}
      {view === "fx" && <Currency m={m} />}
      {view === "units" && <Units />}
      {view === "fin" && (
        <div className="fin stagger">
          <VatCard />
          <PercentCard />
          <TipCard />
          <SavingsCard />
          <LoanCard />
        </div>
      )}
      {view === "time" && (
        <div className="fin stagger">
          <Stopwatch />
          <WorldClock />
        </div>
      )}
    </div>
  );
}