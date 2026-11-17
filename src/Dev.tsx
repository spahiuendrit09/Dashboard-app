import { useEffect, useState } from "react";
import { Button, Input } from "glisse";
import { ArrowsClockwise, Copy, Plus, Trash } from "@phosphor-icons/react";
import { fmt, money, num, uid, ymd } from "./lib";
import { Facts, Field } from "./ui";

const copy = (s: string) => {
  void navigator.clipboard?.writeText(s).catch(() => {});
};

function Chips({ items, value, onChange }: { items: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips-wrap" style={{ paddingTop: 0, marginBottom: 14 }}>
      {items.map(([id, label]) => (
        <button key={id} className={`tag${value === id ? " on" : ""}`} aria-pressed={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Out({ value }: { value: string }) {
  if (!value) return null;
  return (
    <>
      <textarea className="ta" readOnly value={value} aria-label="Ergebnis" />
      <Button icon={<Copy size={18} />} onClick={() => copy(value)}>
        Kopieren
      </Button>
    </>
  );
}

/* =========================================================
   Entwickler-Tools
   ========================================================= */

function JsonPane() {
  const [src, setSrc] = useState("");
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const run = (indent: number) => {
    try {
      setOut(JSON.stringify(JSON.parse(src) as unknown, null, indent));
      setErr("");
    } catch (e) {
      setOut("");
      setErr(e instanceof Error ? e.message : "Ungültiges JSON");
    }
  };
  return (
    <div className="stack">
      <textarea className="ta" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="JSON einfügen …" aria-label="JSON" />
      <div className="two">
        <Button onClick={() => run(2)}>Formatieren</Button>
        <Button onClick={() => run(0)}>Minimieren</Button>
      </div>
      {err && <div className="notice">{err}</div>}
      <Out value={out} />
    </div>
  );
}

const toB64 = (s: string) => {
  let bin = "";
  new TextEncoder().encode(s).forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
};
const fromB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0)));

function EncPane() {
  const [kind, setKind] = useState("b64");
  const [src, setSrc] = useState("");
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const run = (enc: boolean) => {
    try {
      setOut(kind === "b64" ? (enc ? toB64(src) : fromB64(src)) : enc ? encodeURIComponent(src) : decodeURIComponent(src));
      setErr("");
    } catch {
      setOut("");
      setErr("Das lässt sich so nicht umwandeln.");
    }
  };
  return (
    <div className="stack">
      <Chips
        items={[
          ["b64", "Base64"],
          ["url", "URL"],
        ]}
        value={kind}
        onChange={setKind}
      />
      <textarea className="ta" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Text …" aria-label="Eingabe" />
      <div className="two">
        <Button onClick={() => run(true)}>Kodieren</Button>
        <Button onClick={() => run(false)}>Dekodieren</Button>
      </div>
      {err && <div className="notice">{err}</div>}
      <Out value={out} />
    </div>
  );
}

const ALGS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

function HashPane() {
  const [text, setText] = useState("");
  const [h, setH] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");

  useEffect(() => {
    let dead = false;
    if (!crypto.subtle) {
      setErr("Hash-Funktionen brauchen eine sichere Verbindung (https oder localhost).");
      return;
    }
    void (async () => {
      const data = new TextEncoder().encode(text);
      const next: Record<string, string> = {};
      for (const a of ALGS) {
        const buf = await crypto.subtle.digest(a, data);
        next[a] = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
      if (!dead) setH(next);
    })();
    return () => {
      dead = true;
    };
  }, [text]);

  return (
    <div className="stack">
      <textarea className="ta" value={text} onChange={(e) => setText(e.target.value)} placeholder="Text …" aria-label="Text" />
      {err && <div className="notice">{err}</div>}
      {ALGS.map((a) => (
        <div key={a}>
          <div className="meter-head">
            <span>{a}</span>
            <button className="link" onClick={() => copy(h[a] ?? "")}>
              Kopieren
            </button>
          </div>
          <div className="mono">{h[a] ?? ""}</div>
        </div>
      ))}
    </div>
  );
}

const makeUuid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] ?? 0;
        return (c === "x" ? r & 15 : (r & 3) | 8).toString(16);
      });

function UuidPane() {
  const [n, setN] = useState(3);
  const [seed, setSeed] = useState(0);
  const list = Array.from({ length: n }, () => makeUuid());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = list.length > 0 && seed >= 0 ? list : [];
  return (
    <div className="stack">
      <div className="chips-wrap" style={{ paddingTop: 0 }}>
        {[1, 3, 5, 10].map((v) => (
          <button key={v} className={`tag${n === v ? " on" : ""}`} onClick={() => setN(v)}>
            {v}×
          </button>
        ))}
      </div>
      <Button icon={<ArrowsClockwise size={18} weight="bold" />} onClick={() => setSeed(seed + 1)}>
        Neu erzeugen
      </Button>
      {shown.map((u) => (
        <div className="row" key={u} style={{ padding: "6px 0", minHeight: 0 }}>
          <div className="row-main mono">{u}</div>
          <Button icon={<Copy size={16} />} aria-label="Kopieren" onClick={() => copy(u)} />
        </div>
      ))}
    </div>
  );
}

function parseTime(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const v = Number(t);
    return new Date(Math.abs(v) < 1e11 ? v * 1000 : v);
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rel(d: Date) {
  const s = Math.round((d.getTime() - Date.now()) / 1000);
  const a = Math.abs(s);
  const [v, u] = a < 60 ? [a, "Sek."] : a < 3600 ? [Math.round(a / 60), "Min."] : a < 86400 ? [Math.round(a / 3600), "Std."] : [Math.round(a / 86400), "Tage"];
  return s >= 0 ? `in ${v} ${u}` : `vor ${v} ${u}`;
}

function TimePane() {
  const [s, setS] = useState(String(Math.floor(Date.now() / 1000)));
  const d = parseTime(s);
  return (
    <div className="stack">
      <Field label="Unix-Zeit (Sekunden oder Millisekunden) oder Datum">
        <Input type="text" aria-label="Zeit" value={s} onValueChange={setS} />
      </Field>
      <Button onClick={() => setS(String(Math.floor(Date.now() / 1000)))}>Jetzt</Button>
      {d ? (
        <Facts
          rows={[
            ["ISO (UTC)", d.toISOString()],
            ["Lokal", d.toLocaleString("de-AT")],
            ["Unix (s)", String(Math.floor(d.getTime() / 1000))],
            ["Unix (ms)", String(d.getTime())],
            ["Relativ", rel(d)],
          ]}
        />
      ) : (
        <div className="empty">Das verstehe ich nicht</div>
      )}
    </div>
  );
}

const hexOk = (s: string) => /^#?[0-9a-f]{6}$/i.test(s.trim());
const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function ColorPane() {
  const [hex, setHex] = useState("#0a84ff");
  const ok = hexOk(hex);
  const norm = ok ? `#${hex.trim().replace("#", "").toLowerCase()}` : "#000000";
  const rgb = rgbOf(norm);
  const hsl = toHsl(rgb);
  return (
    <div className="stack">
      <div className="swap" style={{ gridTemplateColumns: "auto 1fr" }}>
        <input type="color" value={norm} onChange={(e) => setHex(e.target.value)} aria-label="Farbe wählen" style={{ width: 52, height: 44, border: 0, background: "none" }} />
        <Input type="text" aria-label="Hex-Wert" value={hex} onValueChange={setHex} />
      </div>
      <div className="cswatch" style={{ background: norm }} />
      {ok ? (
        <>
          <Facts
            rows={[
              ["HEX", norm],
              ["RGB", `rgb(${rgb.join(", ")})`],
              ["HSL", `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`],
            ]}
          />
          <Button icon={<Copy size={18} />} onClick={() => copy(norm)}>
            HEX kopieren
          </Button>
        </>
      ) : (
        <div className="row-sub">Gib einen Wert wie #0a84ff ein.</div>
      )}
    </div>
  );
}

export function DevTool() {
  const [tab, setTab] = useState("json");
  return (
    <div>
      <Chips
        items={[
          ["json", "JSON"],
          ["enc", "Base64 & URL"],
          ["hash", "Hash"],
          ["uuid", "UUID"],
          ["time", "Zeitstempel"],
          ["color", "Farbe"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "json" && <JsonPane />}
      {tab === "enc" && <EncPane />}
      {tab === "hash" && <HashPane />}
      {tab === "uuid" && <UuidPane />}
      {tab === "time" && <TimePane />}
      {tab === "color" && <ColorPane />}
    </div>
  );
}

/* =========================================================
   Alltag
   ========================================================= */

function DatePane() {
  const [a, setA] = useState(ymd(new Date()));
  const [b, setB] = useState(ymd(new Date(Date.now() + 30 * 86400000)));
  const [add, setAdd] = useState("30");
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  const diff = Math.round((db.getTime() - da.getTime()) / 86400000);
  const plus = new Date(da);
  plus.setDate(plus.getDate() + Math.round(num(add) || 0));
  return (
    <div className="stack">
      <div className="two">
        <Field label="Von">
          <input className="sel" type="date" value={a} onChange={(e) => setA(e.target.value)} aria-label="Von" />
        </Field>
        <Field label="Bis">
          <input className="sel" type="date" value={b} onChange={(e) => setB(e.target.value)} aria-label="Bis" />
        </Field>
      </div>
      <Facts
        rows={[
          ["Tage", Number.isFinite(diff) ? String(diff) : "–"],
          ["Wochen", Number.isFinite(diff) ? fmt(diff / 7, 1) : "–"],
          ["Monate (ca.)", Number.isFinite(diff) ? fmt(diff / 30.44, 1) : "–"],
        ]}
      />
      <Field label="Tage zum Startdatum addieren">
        <Input type="text" aria-label="Tage" value={add} onValueChange={setAdd} />
      </Field>
      <Facts
        rows={[
          ["Ergebnis", Number.isNaN(plus.getTime()) ? "–" : plus.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
        ]}
      />
    </div>
  );
}

type Grade = { id: number; g: string; w: string };

function GradePane() {
  const [rows, setRows] = useState<Grade[]>([
    { id: 1, g: "2", w: "1" },
    { id: 2, g: "1", w: "2" },
  ]);
  let sw = 0;
  let sg = 0;
  rows.forEach((r) => {
    const g = num(r.g);
    const w = num(r.w);
    if (g >= 1 && g <= 5 && w > 0) {
      sg += g * w;
      sw += w;
    }
  });
  const avg = sw > 0 ? sg / sw : NaN;
  const set = (id: number, p: Partial<Grade>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  return (
    <div className="stack">
      <div className="row-sub">Österreichische Noten von 1 bis 5. Gewicht 2 zählt doppelt (z. B. Schularbeit).</div>
      {rows.map((r) => (
        <div className="swap" key={r.id} style={{ gridTemplateColumns: "1fr 1fr auto" }}>
          <Field label="Note">
            <Input type="text" aria-label="Note" value={r.g} onValueChange={(v: string) => set(r.id, { g: v })} />
          </Field>
          <Field label="Gewicht">
            <Input type="text" aria-label="Gewicht" value={r.w} onValueChange={(v: string) => set(r.id, { w: v })} />
          </Field>
          <Button icon={<Trash size={16} />} aria-label="Entfernen" onClick={() => setRows(rows.filter((x) => x.id !== r.id))} />
        </div>
      ))}
      <Button icon={<Plus size={18} weight="bold" />} onClick={() => setRows([...rows, { id: uid(), g: "", w: "1" }])}>
        Note hinzufügen
      </Button>
      <div className="big">{Number.isFinite(avg) ? fmt(avg, 2) : "–"}</div>
      <div className="row-sub">{Number.isFinite(avg) ? `Gerundet: Note ${Math.round(avg)}` : "Trage mindestens eine Note ein."}</div>
    </div>
  );
}

function FuelPane() {
  const [cons, setCons] = useState("6,5");
  const [price, setPrice] = useState("1,69");
  const [km, setKm] = useState("100");
  const [lit, setLit] = useState("");
  const [drove, setDrove] = useState("");
  const liters = (num(cons) * num(km)) / 100;
  const real = (num(lit) / num(drove)) * 100;
  return (
    <div className="stack">
      <div className="two">
        <Field label="Verbrauch (l/100 km)">
          <Input type="text" aria-label="Verbrauch" value={cons} onValueChange={setCons} />
        </Field>
        <Field label="Preis pro Liter">
          <Input type="text" aria-label="Preis" value={price} onValueChange={setPrice} />
        </Field>
      </div>
      <Field label="Strecke (km)">
        <Input type="text" aria-label="Strecke" value={km} onValueChange={setKm} />
      </Field>
      <Facts
        rows={[
          ["Sprit", `${fmt(liters, 1)} l`],
          ["Kosten", money(liters * num(price))],
          ["Pro 100 km", money(((num(cons) || 0) * num(price)))],
        ]}
      />
      <div className="row-sub">Verbrauch aus der letzten Tankfüllung berechnen:</div>
      <div className="two">
        <Field label="Getankt (l)">
          <Input type="text" aria-label="Getankt" value={lit} onValueChange={setLit} />
        </Field>
        <Field label="Gefahren (km)">
          <Input type="text" aria-label="Gefahren" value={drove} onValueChange={setDrove} />
        </Field>
      </div>
      {Number.isFinite(real) && <div className="big">{fmt(real, 2)} l/100 km</div>}
    </div>
  );
}

function DiscountPane() {
  const [price, setPrice] = useState("99,90");
  const [d1, setD1] = useState("20");
  const [d2, setD2] = useState("");
  const p = num(price);
  const after = p * (1 - (num(d1) || 0) / 100) * (1 - (num(d2) || 0) / 100);
  return (
    <div className="stack">
      <Field label="Preis">
        <Input type="text" aria-label="Preis" value={price} onValueChange={setPrice} />
      </Field>
      <div className="two">
        <Field label="Rabatt (%)">
          <Input type="text" aria-label="Rabatt" value={d1} onValueChange={setD1} />
        </Field>
        <Field label="Zweiter Rabatt (%)">
          <Input type="text" aria-label="Zweiter Rabatt" value={d2} onValueChange={setD2} />
        </Field>
      </div>
      <div className="big">{money(after)}</div>
      <Facts rows={[["Du sparst", money(p - after)], ["Gesamtrabatt", `${fmt((1 - after / p) * 100, 1)} %`]]} />
    </div>
  );
}

export function DailyTool() {
  const [tab, setTab] = useState("date");
  return (
    <div>
      <Chips
        items={[
          ["date", "Datum"],
          ["grades", "Notenschnitt"],
          ["fuel", "Sprit"],
          ["discount", "Rabatt"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "date" && <DatePane />}
      {tab === "grades" && <GradePane />}
      {tab === "fuel" && <FuelPane />}
      {tab === "discount" && <DiscountPane />}
    </div>
  );
}