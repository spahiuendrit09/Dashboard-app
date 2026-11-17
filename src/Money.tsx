import { useState } from "react";
import { Button, Input, Menu, SegmentedControl } from "glisse";
import { ArrowsClockwise, CaretLeft, CaretRight, Plus, Trash } from "@phosphor-icons/react";
import { addMonths, dayKey, fmt, money, monthKey, monthLabel, num, relDay, uid } from "./lib";
import { Card, Facts, Field, Meter } from "./ui";
import { Portfolio, Watchlist } from "./Market";
import type { MarketState } from "./Market";

export type Txn = { id: number; kind: "in" | "out"; amount: number; cat: string; note: string; date: string };
type Cat = { id: string; label: string; color: string };

const OTHER: Cat = { id: "other", label: "Sonstiges", color: "#98989d" };
const INCOME: Cat = { id: "income", label: "Einnahme", color: "#30d158" };

export const CATS: Cat[] = [
  { id: "food", label: "Essen & Trinken", color: "#ff9f0a" },
  { id: "home", label: "Wohnen", color: "#0a84ff" },
  { id: "move", label: "Mobilität", color: "#30d158" },
  { id: "fun", label: "Freizeit", color: "#bf5af2" },
  { id: "shop", label: "Shopping", color: "#ff453a" },
  { id: "health", label: "Gesundheit", color: "#64d2ff" },
  { id: "subs", label: "Abos", color: "#ffd60a" },
  OTHER,
];

export const catOf = (id: string): Cat => (id === "income" ? INCOME : (CATS.find((c) => c.id === id) ?? OTHER));

/** Summen für einen Monat ("2026-11"). */
export function summary(txns: Txn[], mk: string) {
  const list = txns.filter((t) => t.date.startsWith(mk));
  let income = 0;
  let spent = 0;
  const byCat: Record<string, number> = {};
  for (const t of list) {
    if (t.kind === "in") income += t.amount;
    else {
      spent += t.amount;
      byCat[t.cat] = (byCat[t.cat] ?? 0) + t.amount;
    }
  }
  return { list, income, spent, byCat };
}

/** Kompakte Übersicht für das Dashboard. */
export function BudgetGlance({ txns, budget }: { txns: Txn[]; budget: number }) {
  const { income, spent } = summary(txns, monthKey(new Date()));
  return (
    <div className="stack">
      <Meter
        label="Ausgaben diesen Monat"
        text={`${money(spent)} / ${money(budget)}`}
        value={spent}
        max={budget}
        color={spent > budget ? "var(--red)" : "var(--green)"}
      />
      <Facts
        rows={[
          ["Einnahmen", money(income)],
          ["Saldo", money(income - spent)],
        ]}
      />
    </div>
  );
}

/* =========================================================
   Budget
   ========================================================= */

function Budget({
  txns,
  setTxns,
  budget,
  setBudget,
  onAdd,
}: {
  txns: Txn[];
  setTxns: (t: Txn[]) => void;
  budget: number;
  setBudget: (n: number) => void;
  onAdd: (t: Txn) => void;
}) {
  const [cursor, setCursor] = useState(() => addMonths(new Date(), 0));
  const [kind, setKind] = useState("out");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(dayKey());
  const [bt, setBt] = useState(String(budget));

  const mk = monthKey(cursor);
  const { list, income, spent, byCat } = summary(txns, mk);
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const isNow = mk === monthKey(new Date());
  const daysDone = isNow ? new Date().getDate() : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cats = CATS.map((c) => ({ ...c, v: byCat[c.id] ?? 0 }))
    .filter((c) => c.v > 0)
    .sort((a, b) => b.v - a.v);
  const saldo = income - spent;

  const add = () => {
    const a = num(amount);
    if (!(a > 0)) return;
    onAdd({
      id: uid(),
      kind: kind === "in" ? "in" : "out",
      amount: a,
      cat: kind === "in" ? "income" : cat,
      note: note.trim(),
      date: date || dayKey(),
    });
    setAmount("");
    setNote("");
  };

  return (
    <div className="stagger">
      <div className="cal-head" style={{ maxWidth: 420 }}>
        <Button icon={<CaretLeft size={18} weight="bold" />} aria-label="Vorheriger Monat" onClick={() => setCursor(addMonths(cursor, -1))} />
        <div className="cal-title">{monthLabel(cursor)}</div>
        <Button icon={<CaretRight size={18} weight="bold" />} aria-label="Nächster Monat" onClick={() => setCursor(addMonths(cursor, 1))} />
      </div>

      <div className="sum-grid">
        <div className="sum in">
          <span>Einnahmen</span>
          <b>{money(income)}</b>
        </div>
        <div className="sum out">
          <span>Ausgaben</span>
          <b>{money(spent)}</b>
        </div>
        <div className={`sum ${saldo >= 0 ? "in" : "out"}`}>
          <span>Saldo</span>
          <b>{money(saldo)}</b>
        </div>
      </div>

      <div className="split">
        <div className="col">
          <Card title="Buchung hinzufügen">
            <div
              className="stack"
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
            >
              <SegmentedControl
                aria-label="Art"
                items={[
                  { value: "out", label: "Ausgabe" },
                  { value: "in", label: "Einnahme" },
                ]}
                value={kind}
                onValueChange={setKind}
              />
              <div className="two">
                <Field label="Betrag (EUR)">
                  <Input type="text" aria-label="Betrag" placeholder="z. B. 12,50" value={amount} onValueChange={setAmount} />
                </Field>
                <Field label="Datum">
                  <input className="sel" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Datum" />
                </Field>
              </div>
              {kind === "out" && (
                <Field label="Kategorie">
                  <select className="sel" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategorie">
                    {CATS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Notiz (optional)">
                <Input type="text" aria-label="Notiz" placeholder="z. B. Supermarkt" value={note} onValueChange={setNote} />
              </Field>
              <Button icon={<Plus size={18} weight="bold" />} onClick={add}>
                Buchen
              </Button>
            </div>
          </Card>

          <Card title={`Buchungen · ${sorted.length}`} className="mt list">
            {sorted.length === 0 && <div className="empty">Keine Buchungen in diesem Monat</div>}
            {sorted.map((t) => {
              const c = catOf(t.cat);
              return (
                <div className="row" key={t.id}>
                  <span className="dotc" style={{ background: c.color }} />
                  <div className="row-main">
                    <div className="row-title">{t.note || c.label}</div>
                    <div className="row-sub">
                      {relDay(t.date)} · {c.label}
                    </div>
                  </div>
                  <span className={`amt ${t.kind}`}>
                    {t.kind === "in" ? "+" : "−"}
                    {money(t.amount)}
                  </span>
                  <Menu
                    aria-label="Optionen"
                    items={[
                      {
                        label: "Löschen",
                        icon: <Trash size={18} />,
                        destructive: true,
                        onSelect: () => setTxns(txns.filter((x) => x.id !== t.id)),
                      },
                    ]}
                  />
                </div>
              );
            })}
          </Card>
        </div>

        <aside className="split-side">
          <Card title="Monatsbudget">
            <div className="stack">
              <Meter
                label="Ausgegeben"
                text={`${money(spent)} / ${money(budget)}`}
                value={spent}
                max={budget}
                color={spent > budget ? "var(--red)" : "var(--green)"}
              />
              <Field label="Budget pro Monat (EUR)">
                <Input
                  type="text"
                  aria-label="Monatsbudget"
                  value={bt}
                  onValueChange={(v: string) => {
                    setBt(v);
                    const n = num(v);
                    if (Number.isFinite(n) && n >= 0) setBudget(n);
                  }}
                />
              </Field>
              <Facts
                rows={[
                  ["Übrig", money(budget - spent)],
                  ["Ø pro Tag", money(spent / Math.max(daysDone, 1))],
                  ["Sparquote", income > 0 ? `${fmt(((income - spent) / income) * 100, 1)} %` : "–"],
                ]}
              />
            </div>
          </Card>

          <Card title="Nach Kategorie">
            {cats.length === 0 && <div className="empty">Noch keine Ausgaben</div>}
            <div className="cat-list">
              {cats.map((c) => (
                <Meter key={c.id} label={c.label} text={money(c.v)} value={c.v} max={spent} color={c.color} />
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
   Geld-Seite: Budget, Watchlist, Portfolio
   ========================================================= */

export type MoneyView = "budget" | "watch" | "port";

export function Money({
  view,
  setView,
  m,
  txns,
  setTxns,
  budget,
  setBudget,
  onAdd,
}: {
  view: MoneyView;
  setView: (v: MoneyView) => void;
  m: MarketState;
  txns: Txn[];
  setTxns: (t: Txn[]) => void;
  budget: number;
  setBudget: (n: number) => void;
  onAdd: (t: Txn) => void;
}) {
  const updatedText = m.updatedAt
    ? `Aktualisiert ${new Date(m.updatedAt).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}`
    : "Noch keine Kurse";

  return (
    <div className="page" key="money">
      <header className="head">
        <div>
          <div className="eyebrow">{view === "budget" ? "Einnahmen & Ausgaben" : updatedText}</div>
          <h1 className="large-title">Geld</h1>
        </div>
        <div className="head-actions">
          <div className="seg wide">
            <SegmentedControl
              aria-label="Ansicht"
              items={[
                { value: "budget", label: "Budget" },
                { value: "watch", label: "Watchlist" },
                { value: "port", label: "Portfolio" },
              ]}
              value={view}
              onValueChange={(v: string) => setView(v === "watch" ? "watch" : v === "port" ? "port" : "budget")}
            />
          </div>
          {view !== "budget" && (
            <Button
              icon={<ArrowsClockwise size={18} weight="bold" className={m.loading ? "spin" : ""} />}
              aria-label="Aktualisieren"
              onClick={() => m.refresh()}
            />
          )}
        </div>
      </header>

      {view !== "budget" && m.error && <div className="notice">{m.error}</div>}

      {view === "budget" && (
        <Budget txns={txns} setTxns={setTxns} budget={budget} setBudget={setBudget} onAdd={onAdd} />
      )}
      {view === "watch" && <Watchlist m={m} />}
      {view === "port" && <Portfolio m={m} />}
    </div>
  );
}