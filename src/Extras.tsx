import { useMemo, useState } from "react";
import { Button, Input, Slider } from "glisse";
import { ArrowsClockwise, Copy, Plus, Trash } from "@phosphor-icons/react";
import { fmt, uid, useStored } from "./lib";
import { Card, Facts, Field } from "./ui";

/** Zufallszahl von 0 bis n-1 ohne Verzerrung. */
function rand(n: number) {
  const max = Math.floor(0x100000000 / n) * n;
  const a = new Uint32Array(1);
  let v = 0;
  do {
    crypto.getRandomValues(a);
    v = a[0] ?? 0;
  } while (v >= max);
  return v % n;
}

/* =========================================================
   Passwort-Generator
   ========================================================= */

const SETS = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghijkmnopqrstuvwxyz",
  digits: "23456789",
  symbols: "!@#$%&*?+-_=",
};
type SetKey = keyof typeof SETS;
const SET_LABELS: { id: SetKey; label: string }[] = [
  { id: "upper", label: "ABC" },
  { id: "lower", label: "abc" },
  { id: "digits", label: "123" },
  { id: "symbols", label: "#$%" },
];

function makePassword(len: number, on: SetKey[]) {
  const pools = on.map((k) => SETS[k]);
  if (pools.length === 0) return "";
  const all = pools.join("");
  const chars: string[] = pools.map((p) => p.charAt(rand(p.length)));
  while (chars.length < len) chars.push(all.charAt(rand(all.length)));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    const a = chars[i] ?? "";
    chars[i] = chars[j] ?? "";
    chars[j] = a;
  }
  return chars.join("");
}

function PasswordCard() {
  const [lenS, setLenS] = useState(40);
  const [on, setOn] = useState<SetKey[]>(["upper", "lower", "digits", "symbols"]);
  const [seed, setSeed] = useState(0);
  const [copied, setCopied] = useState(false);
  const len = 8 + Math.round((lenS / 100) * 32); // 8 bis 40
  const pw = useMemo(() => makePassword(len, on), [len, on, seed]);
  const pool = on.map((k) => SETS[k]).join("").length;
  const bits = pool > 0 ? Math.round(len * Math.log2(pool)) : 0;

  const toggle = (k: SetKey) => {
    if (on.includes(k)) {
      if (on.length > 1) setOn(on.filter((x) => x !== k));
    } else setOn([...on, k]);
  };

  return (
    <Card
      title="Passwort-Generator"
      action={
        <Button icon={<ArrowsClockwise size={18} weight="bold" />} aria-label="Neues Passwort" onClick={() => setSeed(seed + 1)} />
      }
    >
      <div className="stack">
        <div className="pw">{pw}</div>
        <div className="meter-head">
          <span>Länge</span>
          <b>{len} Zeichen</b>
        </div>
        <Slider aria-label="Länge" value={lenS} onValueChange={setLenS} />
        <div className="chips-wrap" style={{ paddingTop: 0 }}>
          {SET_LABELS.map((s) => (
            <button key={s.id} className={`tag ${on.includes(s.id) ? "on" : ""}`} onClick={() => toggle(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <Button
          icon={<Copy size={18} />}
          onClick={() => {
            navigator.clipboard?.writeText(pw).catch(() => {});
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Kopiert" : "Kopieren"}
        </Button>
        <p className="tip small">Stärke: ca. {bits} Bit. Das Passwort wird nur in deinem Browser erzeugt.</p>
      </div>
    </Card>
  );
}

/* =========================================================
   Würfel & Münze
   ========================================================= */

function RandomCard() {
  const [sides, setSides] = useState(6);
  const [out, setOut] = useState<string>("–");
  const [hist, setHist] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  const show = (v: string) => {
    setOut(v);
    setHist([v, ...hist].slice(0, 10));
    setTick(tick + 1);
  };

  return (
    <Card title="Würfel & Münze">
      <div className="stack">
        <div className="dice-out" key={tick}>
          {out}
        </div>
        <div className="chips-wrap" style={{ paddingTop: 0 }}>
          {[4, 6, 8, 10, 12, 20, 100].map((s) => (
            <button key={s} className={`tag ${sides === s ? "on" : ""}`} onClick={() => setSides(s)}>
              W{s}
            </button>
          ))}
        </div>
        <div className="two">
          <Button onClick={() => show(String(rand(sides) + 1))}>Würfeln</Button>
          <Button onClick={() => show(rand(2) === 0 ? "Kopf" : "Zahl")}>Münze werfen</Button>
        </div>
        {hist.length > 0 && <p className="tip small">Zuletzt: {hist.join(" · ")}</p>}
      </div>
    </Card>
  );
}

/* =========================================================
   Countdowns
   ========================================================= */

type Countdown = { id: number; name: string; date: string };

function daysLeft(date: string) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - t.getTime()) / 86400000);
}

function CountdownCard() {
  const [items, setItems] = useStored<Countdown[]>("ios-countdowns", []);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  const add = () => {
    const n = name.trim();
    if (!n || !date) return;
    setItems([...items, { id: uid(), name: n, date }]);
    setName("");
    setDate("");
  };

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card title="Countdowns">
      <div
        className="stack"
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
        }}
      >
        <Input type="text" aria-label="Name" placeholder="z. B. Urlaub" value={name} onValueChange={setName} />
        <div className="swap" style={{ gridTemplateColumns: "1fr auto" }}>
          <Field label="Datum">
            <input className="sel" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Datum" />
          </Field>
          <Button icon={<Plus size={20} weight="bold" />} aria-label="Hinzufügen" onClick={add} />
        </div>
      </div>
      {sorted.length === 0 && <div className="empty">Noch kein Countdown</div>}
      {sorted.map((c) => {
        const n = daysLeft(c.date);
        return (
          <div className="row" key={c.id}>
            <div className="cd-num">{Math.abs(n)}</div>
            <div className="row-main">
              <div className="row-title">{c.name}</div>
              <div className="row-sub">
                {n === 0 ? "Heute" : n > 0 ? `in ${n} ${n === 1 ? "Tag" : "Tagen"}` : `vor ${-n} ${n === -1 ? "Tag" : "Tagen"}`} ·{" "}
                {new Date(`${c.date}T00:00:00`).toLocaleDateString("de-AT", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <Button
              icon={<Trash size={16} />}
              aria-label="Countdown löschen"
              onClick={() => setItems(items.filter((x) => x.id !== c.id))}
            />
          </div>
        );
      })}
    </Card>
  );
}

/* =========================================================
   Textzähler
   ========================================================= */

function TextCard() {
  const [text, setText] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length;
  return (
    <Card title="Textzähler">
      <textarea
        className="ta"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text einfügen oder tippen …"
        aria-label="Text"
      />
      <Facts
        rows={[
          ["Zeichen", fmt(text.length, 0)],
          ["Ohne Leerzeichen", fmt(text.replace(/\s/g, "").length, 0)],
          ["Wörter", fmt(words, 0)],
          ["Sätze", fmt(sentences, 0)],
          ["Lesezeit", words === 0 ? "–" : `${Math.max(1, Math.round(words / 200))} min`],
        ]}
      />
    </Card>
  );
}

/* =========================================================
   Extras-Seite
   ========================================================= */

export function Extras() {
  return (
    <div className="fin stagger">
      <PasswordCard />
      <CountdownCard />
      <RandomCard />
      <TextCard />
    </div>
  );
}