import { useState } from "react";
import { Button, Input } from "glisse";
import { Plus, Trash } from "@phosphor-icons/react";
import { money, num, uid, useStored, ymd } from "./lib";
import { Card, Field } from "./ui";
import "./tools2.css";

/* =========================================================
   Teilen (wie Splitwise)
   ========================================================= */

export type Person = { id: number; name: string };
export type Exp = { id: number; title: string; amount: number; paidBy: number; split: number[]; date: string };
export type Group = { id: number; name: string; people: Person[]; exps: Exp[] };
export type Pay = { from: number; to: number; amount: number };

export function balances(g: Group): Record<number, number> {
  const b: Record<number, number> = {};
  for (const p of g.people) b[p.id] = 0;
  for (const e of g.exps) {
    const who = e.split.filter((id) => id in b);
    if (who.length === 0 || !(e.paidBy in b)) continue;
    const share = e.amount / who.length;
    b[e.paidBy] = (b[e.paidBy] ?? 0) + e.amount;
    for (const id of who) b[id] = (b[id] ?? 0) - share;
  }
  return b;
}

/** Wenige Zahlungen, die alle Schulden ausgleichen. */
export function settle(g: Group): Pay[] {
  const b = balances(g);
  const entries = Object.entries(b).map(([k, v]) => ({ id: Number(k), v }));
  const cred = entries.filter((x) => x.v > 0.005).sort((a, c) => c.v - a.v);
  const debt = entries
    .filter((x) => x.v < -0.005)
    .map((x) => ({ id: x.id, v: -x.v }))
    .sort((a, c) => c.v - a.v);
  const out: Pay[] = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const d = debt[i];
    const c = cred[j];
    if (!d || !c) break;
    const amt = Math.min(d.v, c.v);
    out.push({ from: d.id, to: c.id, amount: amt });
    d.v -= amt;
    c.v -= amt;
    if (d.v < 0.005) i++;
    if (c.v < 0.005) j++;
  }
  return out;
}

const who = (g: Group, id: number) => g.people.find((p) => p.id === id)?.name ?? "?";

export function SplitTool() {
  const [groups, setGroups] = useStored<Group[]>("ios-split", []);
  const [sel, setSel] = useState<number | null>(null);
  const [gname, setGname] = useState("");
  const [pname, setPname] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState("");
  const [skip, setSkip] = useState<number[]>([]);

  const g = groups.find((x) => x.id === sel) ?? groups[0] ?? null;
  const patch = (fn: (x: Group) => Group) => {
    if (g) setGroups(groups.map((x) => (x.id === g.id ? fn(x) : x)));
  };

  const addGroup = () => {
    const n = gname.trim();
    if (!n) return;
    const x: Group = { id: uid(), name: n, people: [], exps: [] };
    setGroups([...groups, x]);
    setSel(x.id);
    setGname("");
  };
  const addPerson = () => {
    const n = pname.trim();
    if (!n) return;
    patch((x) => ({ ...x, people: [...x.people, { id: uid(), name: n }] }));
    setPname("");
  };
  const removePerson = (id: number) => {
    if (!window.confirm("Person und ihre Ausgaben löschen?")) return;
    patch((x) => ({
      ...x,
      people: x.people.filter((p) => p.id !== id),
      exps: x.exps
        .filter((e) => e.paidBy !== id)
        .map((e) => ({ ...e, split: e.split.filter((s) => s !== id) }))
        .filter((e) => e.split.length > 0),
    }));
  };
  const addExp = () => {
    if (!g) return;
    const a = num(amount);
    const by = Number(payer) || g.people[0]?.id;
    const split = g.people.map((p) => p.id).filter((id) => !skip.includes(id));
    if (!(a > 0) || by === undefined || split.length === 0) return;
    patch((x) => ({
      ...x,
      exps: [{ id: uid(), title: title.trim() || "Ausgabe", amount: a, paidBy: by, split, date: ymd(new Date()) }, ...x.exps],
    }));
    setTitle("");
    setAmount("");
    setSkip([]);
  };

  const bal = g ? balances(g) : {};
  const pays = g ? settle(g) : [];

  return (
    <div className="split">
      <div className="col stack-lg">
        {g && g.people.length >= 2 ? (
          <Card title="Ausgabe hinzufügen">
            <div
              className="stack"
              onKeyDown={(e) => {
                if (e.key === "Enter") addExp();
              }}
            >
              <div className="two">
                <Field label="Wofür?">
                  <Input type="text" aria-label="Titel" placeholder="z. B. Abendessen" value={title} onValueChange={setTitle} />
                </Field>
                <Field label="Betrag (EUR)">
                  <Input type="text" aria-label="Betrag" value={amount} onValueChange={setAmount} />
                </Field>
              </div>
              <Field label="Bezahlt von">
                <select className="sel" aria-label="Bezahlt von" value={payer || String(g.people[0]?.id ?? "")} onChange={(e) => setPayer(e.target.value)}>
                  {g.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <div className="row-sub" style={{ marginBottom: 6 }}>
                  Geteilt durch (antippen zum Ausschließen)
                </div>
                <div className="chips-wrap" style={{ paddingTop: 0 }}>
                  {g.people.map((p) => (
                    <button
                      key={p.id}
                      className={`tag${skip.includes(p.id) ? "" : " on"}`}
                      aria-pressed={!skip.includes(p.id)}
                      onClick={() => setSkip(skip.includes(p.id) ? skip.filter((x) => x !== p.id) : [...skip, p.id])}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <Button icon={<Plus size={18} weight="bold" />} onClick={addExp}>
                Hinzufügen
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="empty">{g ? "Füge rechts mindestens zwei Personen hinzu." : "Lege rechts deine erste Gruppe an."}</div>
          </Card>
        )}

        {g && (
          <Card title={`Ausgaben · ${g.exps.length}`} className="list">
            {g.exps.length === 0 && <div className="empty">Noch keine Ausgaben</div>}
            {g.exps.map((e) => (
              <div className="row" key={e.id}>
                <div className="row-main">
                  <div className="row-title">{e.title}</div>
                  <div className="row-sub">
                    {who(g, e.paidBy)} zahlte · {e.split.length} Personen
                  </div>
                </div>
                <b className="tm-time">{money(e.amount)}</b>
                <Button
                  icon={<Trash size={16} />}
                  aria-label="Ausgabe löschen"
                  onClick={() => patch((x) => ({ ...x, exps: x.exps.filter((y) => y.id !== e.id) }))}
                />
              </div>
            ))}
          </Card>
        )}
      </div>

      <aside className="split-side free">
        <Card title="Gruppen">
          {groups.map((x) => (
            <div className="row" key={x.id}>
              <button className={`list-pick${g?.id === x.id ? " on" : ""}`} onClick={() => setSel(x.id)}>
                <b>{x.name}</b>
                <span>
                  {x.people.length} Personen · {x.exps.length} Ausgaben
                </span>
              </button>
              <Button icon={<Trash size={16} />} aria-label={`${x.name} löschen`} onClick={() => setGroups(groups.filter((y) => y.id !== x.id))} />
            </div>
          ))}
          <div
            className="quick"
            style={{ marginTop: 10 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addGroup();
            }}
          >
            <div className="grow">
              <Input type="text" aria-label="Neue Gruppe" placeholder="Neue Gruppe …" value={gname} onValueChange={setGname} />
            </div>
            <Button icon={<Plus size={20} weight="bold" />} aria-label="Gruppe anlegen" onClick={addGroup} />
          </div>
        </Card>

        {g && (
          <Card title="Personen">
            {g.people.map((p) => (
              <div className="row" key={p.id}>
                <div className="row-main">
                  <div className="row-title">{p.name}</div>
                </div>
                <Button icon={<Trash size={16} />} aria-label={`${p.name} entfernen`} onClick={() => removePerson(p.id)} />
              </div>
            ))}
            <div
              className="quick"
              style={{ marginTop: 10 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPerson();
              }}
            >
              <div className="grow">
                <Input type="text" aria-label="Neue Person" placeholder="Name …" value={pname} onValueChange={setPname} />
              </div>
              <Button icon={<Plus size={20} weight="bold" />} aria-label="Person hinzufügen" onClick={addPerson} />
            </div>
          </Card>
        )}

        {g && g.exps.length > 0 && (
          <>
            <Card title="Salden">
              {Object.entries(bal).map(([id, v]) => (
                <div className="owe" key={id}>
                  <span>{who(g, Number(id))}</span>
                  <b className={v >= 0 ? "bal-pos" : "bal-neg"}>
                    {v >= 0 ? "+" : ""}
                    {money(v)}
                  </b>
                </div>
              ))}
            </Card>
            <Card title="Ausgleich">
              {pays.length === 0 && <div className="empty">Alles ausgeglichen</div>}
              {pays.map((p, i) => (
                <div className="owe" key={i}>
                  <span>
                    {who(g, p.from)} → {who(g, p.to)}
                  </span>
                  <b>{money(p.amount)}</b>
                </div>
              ))}
            </Card>
          </>
        )}
      </aside>
    </div>
  );
}

/* =========================================================
   Geburtstage
   ========================================================= */

export type Bday = { id: number; name: string; m: number; d: number; y: number };

export function nextBday(b: Bday, from = new Date()) {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let t = new Date(base.getFullYear(), b.m - 1, b.d);
  if (t < base) t = new Date(base.getFullYear() + 1, b.m - 1, b.d);
  const days = Math.round((t.getTime() - base.getTime()) / 86400000);
  const age = b.y > 0 ? t.getFullYear() - b.y : 0;
  return { date: t, days, age };
}

export function BirthdaysTool() {
  const [items, setItems] = useStored<Bday[]>("ios-bdays", []);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [noYear, setNoYear] = useState(false);

  const add = () => {
    const n = name.trim();
    const parts = date.split("-").map(Number);
    const y = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const d = parts[2] ?? 0;
    if (!n || !m || !d) return;
    setItems([...items, { id: uid(), name: n, m, d, y: noYear ? 0 : y }]);
    setName("");
    setDate("");
  };

  const list = items.map((b) => ({ b, n: nextBday(b) })).sort((a, c) => a.n.days - c.n.days);

  return (
    <div className="split">
      <div className="col">
        <Card title={`Alle Geburtstage · ${items.length}`} className="list">
          {list.length === 0 && <div className="empty">Noch keine Geburtstage</div>}
          {list.map(({ b, n }) => (
            <div className="row" key={b.id}>
              <div className="bd-n">
                <b>{n.days}</b>
                <span>{n.days === 1 ? "Tag" : "Tage"}</span>
              </div>
              <div className="row-main">
                <div className="row-title">{b.name}</div>
                <div className="row-sub">
                  {n.date.toLocaleDateString("de-AT", { day: "numeric", month: "long" })}
                  {n.age > 0 ? ` · wird ${n.age}` : ""}
                </div>
              </div>
              <Button icon={<Trash size={16} />} aria-label={`${b.name} löschen`} onClick={() => setItems(items.filter((x) => x.id !== b.id))} />
            </div>
          ))}
        </Card>
      </div>
      <aside className="split-side free">
        <Card title="Hinzufügen">
          <div
            className="stack"
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          >
            <Field label="Name">
              <Input type="text" aria-label="Name" value={name} onValueChange={setName} />
            </Field>
            <Field label="Geburtstag">
              <input className="sel" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Geburtstag" />
            </Field>
            <div className="chips-wrap" style={{ paddingTop: 0 }}>
              <button className={`tag${noYear ? " on" : ""}`} aria-pressed={noYear} onClick={() => setNoYear(!noYear)}>
                Jahr unbekannt
              </button>
            </div>
            <Button icon={<Plus size={18} weight="bold" />} onClick={add}>
              Hinzufügen
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}