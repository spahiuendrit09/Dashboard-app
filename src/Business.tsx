import { useState } from "react";
import { Button, Input } from "glisse";
import { DownloadSimple, Play, Plus, Stop, Trash } from "@phosphor-icons/react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import { fmt, money, num, pad, uid, useStored, ymd } from "./lib";
import { useNow } from "./quick";
import { Card, Facts, Field } from "./ui";
import "./widgets2.css";

/* =========================================================
   Rechnung
   ========================================================= */

type Item = { id: number; text: string; qty: string; price: string; vat: string };
type Me = { name: string; addr: string; uid: string; iban: string; counter: number; small: boolean };
type Draft = { cust: string; custAddr: string; date: string; days: string; note: string; items: Item[] };

const ME0: Me = { name: "", addr: "", uid: "", iban: "", counter: 1, small: false };
const mkItem = (): Item => ({ id: uid(), text: "", qty: "1", price: "", vat: "20" });
const draft0 = (): Draft => ({ cust: "", custAddr: "", date: ymd(new Date()), days: "14", note: "", items: [mkItem()] });

const SMALL_NOTE = "Umsatzsteuerbefreit gemäß § 6 Abs 1 Z 27 UStG (Kleinunternehmerregelung).";

const clean = (s: string) => s.replace(/[\u202f\u2009\u2007]/g, " ").replace(/[^\x20-\x7e\xa0-\xff€]/g, "?");
const eur = (n: number) => `${n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function totals(items: Item[], small: boolean) {
  const byRate: Record<string, number> = {};
  let net = 0;
  for (const it of items) {
    const n = (num(it.qty) || 0) * (num(it.price) || 0);
    net += n;
    if (!small) byRate[it.vat] = (byRate[it.vat] ?? 0) + n * (Number(it.vat) / 100);
  }
  const vat = Object.values(byRate).reduce((s, v) => s + v, 0);
  return { net, byRate, vat, gross: net + vat };
}

function wrapText(s: string, f: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of clean(s).split("\n")) {
    let cur = "";
    for (const w of para.split(" ")) {
      const next = cur ? `${cur} ${w}` : w;
      if (!cur || f.widthOfTextAtSize(next, size) <= max) cur = next;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
  }
  return out;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function buildPdf(me: Me, d: Draft, no: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 56;
  const ink = rgb(0.08, 0.08, 0.1);
  const grey = rgb(0.42, 0.42, 0.46);
  const rule = rgb(0.86, 0.86, 0.89);
  let page = doc.addPage([W, H]);
  let y = H - 60;

  const put = (s: string, x: number, yy: number, size = 10, f: PDFFont = font, color = ink) =>
    page.drawText(clean(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size = 10, f: PDFFont = font, color = ink) =>
    put(s, xr - f.widthOfTextAtSize(clean(s), size), yy, size, f, color);
  const hr = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.6, color: rule });

  /* Absender */
  put(me.name || "Absender", M, y, 12, bold);
  y -= 15;
  for (const l of wrapText(me.addr, font, 9, 250)) {
    if (l) {
      put(l, M, y, 9, font, grey);
      y -= 12;
    }
  }
  if (me.uid.trim()) {
    put(`UID: ${me.uid.trim()}`, M, y, 9, font, grey);
    y -= 12;
  }

  /* Kunde und Eckdaten */
  y -= 30;
  const top = y;
  put("Rechnung an", M, y, 8, font, grey);
  y -= 14;
  put(d.cust || "Kunde", M, y, 11, bold);
  y -= 14;
  for (const l of wrapText(d.custAddr, font, 10, 260)) {
    if (l) {
      put(l, M, y, 10);
      y -= 13;
    }
  }
  const date = new Date(`${d.date}T00:00:00`);
  const due = new Date(date);
  due.setDate(due.getDate() + Math.round(num(d.days) || 0));
  const meta: [string, string][] = [
    ["Rechnungsnr.", no],
    ["Datum", date.toLocaleDateString("de-AT")],
    ["Fällig am", due.toLocaleDateString("de-AT")],
  ];
  meta.forEach(([k, v], i) => {
    put(k, 360, top - i * 14, 9, font, grey);
    right(v, W - M, top - i * 14, 10, bold);
  });
  y = Math.min(y, top - 50) - 34;

  put("Rechnung", M, y, 22, bold);
  y -= 34;

  /* Tabelle */
  const head = () => {
    put("Beschreibung", M, y, 8, bold, grey);
    right("Menge", 345, y, 8, bold, grey);
    right("Einzel", 420, y, 8, bold, grey);
    right("USt", 470, y, 8, bold, grey);
    right("Gesamt", W - M, y, 8, bold, grey);
    y -= 8;
    hr(y);
    y -= 16;
  };
  head();

  for (const it of d.items) {
    const lines = wrapText(it.text || "-", font, 10, 240);
    if (y - lines.length * 12 < 170) {
      page = doc.addPage([W, H]);
      y = H - 70;
      head();
    }
    const qty = num(it.qty) || 0;
    const price = num(it.price) || 0;
    lines.forEach((l, i) => put(l, M, y - i * 12, 10));
    right(fmt(qty, 3), 345, y, 10);
    right(eur(price), 420, y, 10);
    right(me.small ? "-" : `${it.vat} %`, 470, y, 10);
    right(eur(qty * price), W - M, y, 10);
    y -= lines.length * 12 + 8;
  }
  hr(y + 2);
  y -= 18;

  /* Summen */
  const t = totals(d.items, me.small);
  const row = (k: string, v: string, f: PDFFont = font, size = 10) => {
    put(k, 360, y, size, f, f === bold ? ink : grey);
    right(v, W - M, y, size, f);
    y -= 16;
  };
  row("Netto", eur(t.net));
  for (const [rate, amount] of Object.entries(t.byRate)) if (amount !== 0) row(`USt ${rate} %`, eur(amount));
  y -= 4;
  row("Gesamtbetrag", eur(t.gross), bold, 12);

  /* Hinweise und Bankdaten */
  y -= 16;
  const notes = [me.small ? SMALL_NOTE : "", d.note.trim(), `Zahlbar bis ${due.toLocaleDateString("de-AT")} ohne Abzug.`].filter(Boolean);
  for (const n of notes) {
    for (const l of wrapText(n, font, 9, W - 2 * M)) {
      put(l, M, y, 9, font, grey);
      y -= 12;
    }
    y -= 4;
  }
  if (me.iban.trim()) put(`IBAN: ${me.iban.trim()}`, M, 48, 9, font, grey);

  return doc.save();
}

function Invoice() {
  const [meRaw, setMe] = useStored<Me>("ios-invoice-me", ME0);
  const [dRaw, setD] = useStored<Draft>("ios-invoice-draft", draft0());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const me: Me = { ...ME0, ...meRaw };
  const d: Draft = { ...draft0(), ...dRaw, items: Array.isArray(dRaw.items) && dRaw.items.length > 0 ? dRaw.items : [mkItem()] };

  const t = totals(d.items, me.small);
  const no = `${new Date().getFullYear()}-${String(me.counter).padStart(3, "0")}`;
  const setItem = (id: number, p: Partial<Item>) => setD({ ...d, items: d.items.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  const make = async () => {
    setBusy(true);
    setMsg("");
    try {
      const bytes = await buildPdf(me, d, no);
      saveBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `Rechnung-${no}.pdf`);
      setMe({ ...me, counter: me.counter + 1 });
      setMsg("Rechnung heruntergeladen. Die nächste Nummer ist schon eingestellt.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    }
    setBusy(false);
  };

  return (
    <div className="split">
      <div className="col stack-lg">
        <Card title="Dein Unternehmen">
          <div className="stack">
            <Field label="Name oder Firma">
              <Input type="text" aria-label="Name" value={me.name} onValueChange={(v: string) => setMe({ ...me, name: v })} />
            </Field>
            <Field label="Adresse">
              <textarea className="ta" style={{ minHeight: 70 }} value={me.addr} onChange={(e) => setMe({ ...me, addr: e.target.value })} aria-label="Adresse" />
            </Field>
            <div className="two">
              <Field label="UID (optional)">
                <Input type="text" aria-label="UID" value={me.uid} onValueChange={(v: string) => setMe({ ...me, uid: v })} />
              </Field>
              <Field label="IBAN (optional)">
                <Input type="text" aria-label="IBAN" value={me.iban} onValueChange={(v: string) => setMe({ ...me, iban: v })} />
              </Field>
            </div>
            <div className="chips-wrap" style={{ paddingTop: 0 }}>
              <button className={`tag${me.small ? " on" : ""}`} aria-pressed={me.small} onClick={() => setMe({ ...me, small: !me.small })}>
                Kleinunternehmer (keine USt)
              </button>
            </div>
          </div>
        </Card>

        <Card title="Kunde und Details">
          <div className="stack">
            <Field label="Kunde">
              <Input type="text" aria-label="Kunde" value={d.cust} onValueChange={(v: string) => setD({ ...d, cust: v })} />
            </Field>
            <Field label="Adresse des Kunden">
              <textarea className="ta" style={{ minHeight: 70 }} value={d.custAddr} onChange={(e) => setD({ ...d, custAddr: e.target.value })} aria-label="Adresse des Kunden" />
            </Field>
            <div className="two">
              <Field label="Datum">
                <input className="sel" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} aria-label="Datum" />
              </Field>
              <Field label="Zahlungsziel (Tage)">
                <Input type="text" aria-label="Zahlungsziel" value={d.days} onValueChange={(v: string) => setD({ ...d, days: v })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Positionen">
          {d.items.map((it) => (
            <div className="inv-item" key={it.id}>
              <div className="t">
                <Input type="text" aria-label="Beschreibung" placeholder="Leistung oder Produkt" value={it.text} onValueChange={(v: string) => setItem(it.id, { text: v })} />
              </div>
              <Input type="text" aria-label="Menge" placeholder="Menge" value={it.qty} onValueChange={(v: string) => setItem(it.id, { qty: v })} />
              <Input type="text" aria-label="Einzelpreis netto" placeholder="Preis netto" value={it.price} onValueChange={(v: string) => setItem(it.id, { price: v })} />
              <select className="sel" aria-label="Umsatzsteuer" value={it.vat} onChange={(e) => setItem(it.id, { vat: e.target.value })} disabled={me.small}>
                {["0", "10", "13", "20"].map((r) => (
                  <option key={r} value={r}>
                    {r} %
                  </option>
                ))}
              </select>
              <Button
                icon={<Trash size={16} />}
                aria-label="Position löschen"
                onClick={() => setD({ ...d, items: d.items.length > 1 ? d.items.filter((x) => x.id !== it.id) : [mkItem()] })}
              />
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <Button icon={<Plus size={18} weight="bold" />} onClick={() => setD({ ...d, items: [...d.items, mkItem()] })}>
              Position hinzufügen
            </Button>
          </div>
        </Card>

        <Card title="Zusatztext (optional)">
          <textarea className="ta" style={{ minHeight: 70 }} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} aria-label="Zusatztext" placeholder="z. B. Vielen Dank für Ihren Auftrag." />
        </Card>
      </div>

      <aside className="split-side free">
        <Card title="Summe">
          <div className="big">{money(t.gross)}</div>
          <Facts
            rows={[
              ["Netto", money(t.net)],
              ["Umsatzsteuer", me.small ? "keine" : money(t.vat)],
              ["Rechnungsnr.", no],
            ]}
          />
          <div className="stack" style={{ marginTop: 14 }}>
            <Field label="Nächste Rechnungsnummer (Zähler)">
              <Input
                type="text"
                aria-label="Zähler"
                value={String(me.counter)}
                onValueChange={(v: string) => setMe({ ...me, counter: Math.max(1, Math.round(num(v)) || 1) })}
              />
            </Field>
            <Button icon={<DownloadSimple size={18} weight="bold" />} onClick={() => void make()}>
              {busy ? "Erstelle …" : "PDF erstellen"}
            </Button>
            {msg && <div className="row-sub">{msg}</div>}
          </div>
          <p className="tip small">
            Deine Angaben bleiben nur in diesem Browser. Prüfe die Pflichtangaben auf der Rechnung selbst. Das ist keine
            Rechts- oder Steuerberatung.
          </p>
        </Card>
      </aside>
    </div>
  );
}

/* =========================================================
   Zeiterfassung
   ========================================================= */

type Proj = { id: number; name: string; rate: string };
type Entry = { id: number; proj: number; start: number; end: number; note: string };
type Run = { proj: number; start: number; note: string } | null;

const dur = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

function TimeTrack() {
  const [projs, setProjs] = useStored<Proj[]>("ios-time-projects", []);
  const [entries, setEntries] = useStored<Entry[]>("ios-time-entries", []);
  const [run, setRun] = useStored<Run>("ios-time-run", null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const now = useNow(1000, run !== null);

  const cur = sel ?? projs[0]?.id ?? null;
  const nameOf = (id: number) => projs.find((p) => p.id === id)?.name ?? "Gelöscht";

  const addProj = () => {
    if (!name.trim()) return;
    const p: Proj = { id: uid(), name: name.trim(), rate: rate.trim() };
    setProjs([...projs, p]);
    setSel(p.id);
    setName("");
    setRate("");
  };
  const start = () => {
    if (cur === null || run) return;
    setRun({ proj: cur, start: Date.now(), note: note.trim() });
    setNote("");
  };
  const stop = () => {
    if (!run) return;
    setEntries([{ id: uid(), proj: run.proj, start: run.start, end: Date.now(), note: run.note }, ...entries]);
    setRun(null);
  };

  const first = new Date();
  const monthStart = new Date(first.getFullYear(), first.getMonth(), 1).getTime();
  const perProj = projs.map((p) => {
    const ms = entries.filter((e) => e.proj === p.id && e.start >= monthStart).reduce((s, e) => s + (e.end - e.start), 0);
    const hours = ms / 3600000;
    return { p, hours, amount: hours * (num(p.rate) || 0) };
  });

  const toInvoice = (p: Proj, hours: number) => {
    try {
      const raw = localStorage.getItem("ios-invoice-draft");
      const old = raw ? (JSON.parse(raw) as Partial<Draft>) : {};
      const items = Array.isArray(old.items) ? old.items : [];
      const it: Item = {
        id: uid(),
        text: `${p.name} - Stunden`,
        qty: String(Math.round(hours * 100) / 100).replace(".", ","),
        price: p.rate,
        vat: "20",
      };
      localStorage.setItem(
        "ios-invoice-draft",
        JSON.stringify({ ...draft0(), ...old, items: [...items.filter((i) => i.text || i.price), it] }),
      );
      setMsg("Zur Rechnung hinzugefügt. Öffne den Tab Rechnung.");
    } catch {
      setMsg("Das hat nicht geklappt.");
    }
  };

  return (
    <div className="split">
      <div className="col stack-lg">
        <Card title="Zeit erfassen">
          {projs.length === 0 ? (
            <div className="empty">Lege rechts dein erstes Projekt an</div>
          ) : (
            <div className="stack">
              <select className="sel" aria-label="Projekt" value={cur ?? ""} disabled={run !== null} onChange={(e) => setSel(Number(e.target.value))}>
                {projs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {!run && <Input type="text" aria-label="Notiz" placeholder="Woran arbeitest du? (optional)" value={note} onValueChange={setNote} />}
              <div className="sw-time">{run ? dur(now - run.start) : "0:00:00"}</div>
              {run && <div className="row-sub" style={{ textAlign: "center" }}>{nameOf(run.proj)}{run.note ? ` · ${run.note}` : ""}</div>}
              <div className="controls" style={{ marginTop: 0 }}>
                {run ? (
                  <Button icon={<Stop size={18} weight="fill" />} onClick={stop}>
                    Stopp
                  </Button>
                ) : (
                  <Button icon={<Play size={18} weight="fill" />} onClick={start}>
                    Start
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card title="Letzte Einträge" className="list">
          {entries.length === 0 && <div className="empty">Noch nichts erfasst</div>}
          {entries.slice(0, 12).map((e) => (
            <div className="row" key={e.id}>
              <div className="row-main">
                <div className="row-title">{nameOf(e.proj)}</div>
                <div className="row-sub">
                  {new Date(e.start).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" })}
                  {e.note ? ` · ${e.note}` : ""}
                </div>
              </div>
              <b className="tm-time">{dur(e.end - e.start)}</b>
              <Button icon={<Trash size={16} />} aria-label="Eintrag löschen" onClick={() => setEntries(entries.filter((x) => x.id !== e.id))} />
            </div>
          ))}
        </Card>
      </div>

      <aside className="split-side free">
        <Card title="Projekte">
          <div
            className="stack"
            onKeyDown={(e) => {
              if (e.key === "Enter") addProj();
            }}
          >
            <Input type="text" aria-label="Projektname" placeholder="Projektname" value={name} onValueChange={setName} />
            <div className="swap" style={{ gridTemplateColumns: "1fr auto" }}>
              <Input type="text" aria-label="Stundensatz" placeholder="Stundensatz netto (EUR)" value={rate} onValueChange={setRate} />
              <Button icon={<Plus size={20} weight="bold" />} aria-label="Projekt anlegen" onClick={addProj} />
            </div>
          </div>
        </Card>

        <Card title="Dieser Monat">
          {perProj.length === 0 && <div className="empty">Keine Projekte</div>}
          {perProj.map(({ p, hours, amount }) => (
            <div className="row" key={p.id}>
              <div className="row-main">
                <div className="row-title">{p.name}</div>
                <div className="row-sub">
                  {fmt(hours, 2)} h{p.rate ? ` · ${money(amount)}` : ""}
                </div>
              </div>
              <Button onClick={() => toInvoice(p, hours)}>Auf Rechnung</Button>
              <Button icon={<Trash size={16} />} aria-label="Projekt löschen" onClick={() => setProjs(projs.filter((x) => x.id !== p.id))} />
            </div>
          ))}
          {msg && <div className="row-sub" style={{ marginTop: 8 }}>{msg}</div>}
        </Card>
      </aside>
    </div>
  );
}

export function BusinessTool() {
  const [tab, setTab] = useState("invoice");
  return (
    <div>
      <div className="chips-wrap" style={{ paddingTop: 0, marginBottom: 14 }}>
        <button className={`tag${tab === "invoice" ? " on" : ""}`} onClick={() => setTab("invoice")}>
          Rechnung
        </button>
        <button className={`tag${tab === "time" ? " on" : ""}`} onClick={() => setTab("time")}>
          Zeiterfassung
        </button>
      </div>
      {tab === "invoice" ? <Invoice /> : <TimeTrack />}
    </div>
  );
}