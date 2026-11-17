import { useState } from "react";
import { Button, Input } from "glisse";
import { ArrowCounterClockwise, Plus, Trash } from "@phosphor-icons/react";
import { fmt, money, num, uid, useStored, ymd } from "./lib";
import { Card, Facts, Field } from "./ui";
import "./widgets2.css";

/* =========================================================
   Abos und Fixkosten
   ========================================================= */

export type Sub = { id: number; name: string; price: number; every: "week" | "month" | "year"; next: string };

export const monthly = (s: Sub) => (s.every === "month" ? s.price : s.every === "year" ? s.price / 12 : (s.price * 52) / 12);

export function nextDue(s: Sub, from = new Date()): Date {
  const d = new Date(`${s.next}T00:00:00`);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let guard = 0;
  while (d < base && guard++ < 600) {
    if (s.every === "week") d.setDate(d.getDate() + 7);
    else if (s.every === "month") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

const EVERY: Record<Sub["every"], string> = { week: "Woche", month: "Monat", year: "Jahr" };
const SUB_PRESETS = ["Netflix", "Spotify", "YouTube Premium", "iCloud", "Disney+", "Amazon Prime", "ChatGPT", "Fitnessstudio", "Handyvertrag", "Strom", "Miete", "Versicherung"];

export function SubsTool() {
  const [subs, setSubs] = useStored<Sub[]>("ios-subs", []);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [every, setEvery] = useState<Sub["every"]>("month");
  const [next, setNext] = useState(ymd(new Date()));

  const add = () => {
    const p = num(price);
    if (!name.trim() || !(p >= 0)) return;
    setSubs([...subs, { id: uid(), name: name.trim(), price: p, every, next: next || ymd(new Date()) }]);
    setName("");
    setPrice("");
  };

  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const list = subs.map((s) => ({ s, due: nextDue(s) })).sort((a, b) => a.due.getTime() - b.due.getTime());
  const perMonth = subs.reduce((t, s) => t + monthly(s), 0);
  const days = (d: Date) => Math.round((d.getTime() - t0.getTime()) / 86400000);
  const top = [...subs].sort((a, b) => monthly(b) - monthly(a))[0];

  return (
    <div className="split">
      <div className="col stack-lg">
        <Card title="Abo hinzufügen">
          <div
            className="stack"
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          >
            <div className="chips-wrap" style={{ paddingTop: 0 }}>
              {SUB_PRESETS.map((n) => (
                <button key={n} className="tag" onClick={() => setName(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="two">
              <Field label="Name">
                <Input type="text" aria-label="Name" value={name} onValueChange={setName} />
              </Field>
              <Field label="Preis (EUR)">
                <Input type="text" aria-label="Preis" value={price} onValueChange={setPrice} />
              </Field>
            </div>
            <div className="chips-wrap" style={{ paddingTop: 0 }}>
              {(["week", "month", "year"] as const).map((e) => (
                <button key={e} className={`tag${every === e ? " on" : ""}`} onClick={() => setEvery(e)}>
                  pro {EVERY[e]}
                </button>
              ))}
            </div>
            <Field label="Nächste Abbuchung">
              <input className="sel" type="date" value={next} onChange={(e) => setNext(e.target.value)} aria-label="Nächste Abbuchung" />
            </Field>
            <Button icon={<Plus size={18} weight="bold" />} onClick={add}>
              Hinzufügen
            </Button>
          </div>
        </Card>

        <Card title={`Alle Abos · ${subs.length}`} className="list">
          {list.length === 0 && <div className="empty">Noch keine Abos</div>}
          {list.map(({ s, due }) => (
            <div className="row" key={s.id}>
              <div className="row-main">
                <div className="row-title">{s.name}</div>
                <div className="row-sub">
                  {money(s.price)} pro {EVERY[s.every]} · {due.toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" })}
                </div>
              </div>
              <span className="muted-sm">
                {days(due) === 0 ? "heute" : days(due) === 1 ? "morgen" : `in ${days(due)} Tagen`}
              </span>
              <Button icon={<Trash size={16} />} aria-label={`${s.name} löschen`} onClick={() => setSubs(subs.filter((x) => x.id !== s.id))} />
            </div>
          ))}
        </Card>
      </div>

      <aside className="split-side free">
        <Card title="Kosten">
          <div className="big">{money(perMonth)}</div>
          <div className="row-sub" style={{ margin: "4px 0 10px" }}>
            pro Monat
          </div>
          <Facts
            rows={[
              ["Pro Jahr", money(perMonth * 12)],
              ["Pro Tag", money(perMonth / 30.44)],
              ["Teuerstes", top ? `${top.name} (${money(monthly(top))})` : "-"],
            ]}
          />
        </Card>
      </aside>
    </div>
  );
}

/* =========================================================
   Karteikarten (Leitner-System)
   ========================================================= */

export type FlashCard = { id: number; q: string; a: string; box: number; due: string };
export type Deck = { id: number; name: string; cards: FlashCard[] };

const INTERVALS = [0, 1, 3, 7, 16];

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const dueCount = (decks: Deck[], today: string) =>
  decks.reduce((s, d) => s + d.cards.filter((c) => c.due <= today).length, 0);

function shuffle(ids: number[]) {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) continue;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

export function CardsTool() {
  const [decks, setDecks] = useStored<Deck[]>("ios-decks", []);
  const [sel, setSel] = useState<number | null>(null);
  const [deckName, setDeckName] = useState("");
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [bulk, setBulk] = useState("");
  const [studying, setStudying] = useState(false);
  const [queue, setQueue] = useState<number[]>([]);
  const [reveal, setReveal] = useState(false);

  const today = ymd(new Date());
  const deck = decks.find((d) => d.id === (sel ?? decks[0]?.id)) ?? null;
  const patch = (fn: (d: Deck) => Deck) => {
    if (deck) setDecks(decks.map((d) => (d.id === deck.id ? fn(d) : d)));
  };
  const dueIds = deck ? deck.cards.filter((c) => c.due <= today).map((c) => c.id) : [];
  const mk = (qq: string, aa: string): FlashCard => ({ id: uid(), q: qq, a: aa, box: 1, due: today });

  const addDeck = () => {
    if (!deckName.trim()) return;
    const d: Deck = { id: uid(), name: deckName.trim(), cards: [] };
    setDecks([...decks, d]);
    setSel(d.id);
    setDeckName("");
  };
  const addCard = () => {
    if (!q.trim() || !a.trim()) return;
    patch((d) => ({ ...d, cards: [...d.cards, mk(q.trim(), a.trim())] }));
    setQ("");
    setA("");
  };
  const importBulk = () => {
    const cards = bulk
      .split("\n")
      .map((l) => l.split(/;|\t/))
      .flatMap((p) => {
        const qq = (p[0] ?? "").trim();
        const aa = p.slice(1).join(";").trim();
        return qq && aa ? [mk(qq, aa)] : [];
      });
    if (cards.length === 0) return;
    patch((d) => ({ ...d, cards: [...d.cards, ...cards] }));
    setBulk("");
  };

  const begin = () => {
    setQueue(shuffle(dueIds));
    setReveal(false);
    setStudying(true);
  };
  const answer = (ok: boolean) => {
    const id = queue[0];
    if (id === undefined) return;
    patch((d) => ({
      ...d,
      cards: d.cards.map((c) => {
        if (c.id !== id) return c;
        if (!ok) return { ...c, box: 1, due: today };
        const box = Math.min(5, c.box + 1);
        return { ...c, box, due: addDays(today, INTERVALS[box - 1] ?? 1) };
      }),
    }));
    setQueue(ok ? queue.slice(1) : [...queue.slice(1), id]);
    setReveal(false);
  };

  const card = studying && deck ? deck.cards.find((c) => c.id === queue[0]) : undefined;

  return (
    <div className="split">
      <div className="col stack-lg">
        {studying ? (
          <Card
            title={deck ? deck.name : "Lernen"}
            action={
              <button className="link" onClick={() => setStudying(false)}>
                Beenden
              </button>
            }
          >
            {card ? (
              <div className="study">
                <div className="row-sub">{queue.length} übrig</div>
                <div className="study-card">
                  <div className="study-q">{card.q}</div>
                  {reveal && <div className="study-a">{card.a}</div>}
                </div>
                {reveal ? (
                  <div className="two">
                    <Button icon={<ArrowCounterClockwise size={18} weight="bold" />} onClick={() => answer(false)}>
                      Nicht gewusst
                    </Button>
                    <Button onClick={() => answer(true)}>Gewusst</Button>
                  </div>
                ) : (
                  <Button onClick={() => setReveal(true)}>Antwort zeigen</Button>
                )}
              </div>
            ) : (
              <div className="empty">
                Geschafft! Alle fälligen Karten sind durch.
                <div style={{ marginTop: 12 }}>
                  <Button onClick={() => setStudying(false)}>Fertig</Button>
                </div>
              </div>
            )}
          </Card>
        ) : deck ? (
          <>
            <Card title={deck.name} action={<span className="muted-sm">{deck.cards.length} Karten</span>}>
              <div className="stack">
                <Button disabled={dueIds.length === 0} onClick={begin}>
                  {dueIds.length > 0 ? `${dueIds.length} fällige Karten lernen` : "Heute nichts fällig"}
                </Button>
                <div
                  className="two"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCard();
                  }}
                >
                  <Field label="Frage">
                    <Input type="text" aria-label="Frage" value={q} onValueChange={setQ} />
                  </Field>
                  <Field label="Antwort">
                    <Input type="text" aria-label="Antwort" value={a} onValueChange={setA} />
                  </Field>
                </div>
                <Button icon={<Plus size={18} weight="bold" />} onClick={addCard}>
                  Karte hinzufügen
                </Button>
              </div>
            </Card>

            <Card title="Viele auf einmal importieren">
              <textarea className="ta" value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Import" placeholder={"Frage;Antwort\nHauptstadt von Österreich;Wien"} />
              <Button onClick={importBulk}>Importieren</Button>
            </Card>

            <Card title="Karten" className="list">
              {deck.cards.length === 0 && <div className="empty">Noch keine Karten</div>}
              {deck.cards.slice(0, 60).map((c) => (
                <div className="row" key={c.id}>
                  <div className="row-main">
                    <div className="row-title">{c.q}</div>
                    <div className="row-sub">
                      {c.a} · Fach {c.box}
                    </div>
                  </div>
                  <Button icon={<Trash size={16} />} aria-label="Karte löschen" onClick={() => patch((d) => ({ ...d, cards: d.cards.filter((x) => x.id !== c.id) }))} />
                </div>
              ))}
            </Card>
          </>
        ) : (
          <Card>
            <div className="empty">Lege rechts dein erstes Deck an</div>
          </Card>
        )}
      </div>

      <aside className="split-side free">
        <Card title="Decks">
          {decks.map((d) => (
            <div className="row" key={d.id}>
              <button className={`list-pick${deck?.id === d.id ? " on" : ""}`} onClick={() => { setSel(d.id); setStudying(false); }}>
                <b>{d.name}</b>
                <span>
                  {d.cards.filter((c) => c.due <= today).length} fällig · {d.cards.length} Karten
                </span>
              </button>
              <Button icon={<Trash size={16} />} aria-label={`${d.name} löschen`} onClick={() => setDecks(decks.filter((x) => x.id !== d.id))} />
            </div>
          ))}
          <div
            className="quick"
            style={{ marginTop: 10 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addDeck();
            }}
          >
            <div className="grow">
              <Input type="text" aria-label="Neues Deck" placeholder="Neues Deck …" value={deckName} onValueChange={setDeckName} />
            </div>
            <Button icon={<Plus size={20} weight="bold" />} aria-label="Deck anlegen" onClick={addDeck} />
          </div>
        </Card>
        <Card title="So funktioniert es">
          <p className="tip">
            Gewusste Karten wandern ein Fach weiter und kommen später wieder (nach 1, 3, 7 und 16 Tagen). Nicht gewusste
            starten von vorn. {fmt(dueCount(decks, today), 0)} Karten sind heute insgesamt fällig.
          </p>
        </Card>
      </aside>
    </div>
  );
}