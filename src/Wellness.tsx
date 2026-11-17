import { useState } from "react";
import { Button, Input, Menu } from "glisse";
import { CheckCircle, Circle, Drop, Minus, Plus, Trash } from "@phosphor-icons/react";
import { dayDate, dayKey, uid } from "./lib";
import type { FocusLog } from "./lib";
import { Card } from "./ui";

export type Well = Record<string, { water: number; mood: number }>;
export type ListItem = { id: number; text: string; done: boolean };
export type TodoList = { id: number; name: string; items: ListItem[] };

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
const MOOD_NAMES = ["Schlecht", "Mau", "Okay", "Gut", "Super"];

/* =========================================================
   Aktivitäts-Heatmap
   ========================================================= */

export function Heatmap({
  log,
  habitDays,
  goal,
  weeks = 20,
}: {
  log: FocusLog;
  habitDays: string[][];
  goal: number;
  weeks?: number;
}) {
  const counts: Record<string, number> = {};
  for (const days of habitDays) for (const d of days) counts[d] = (counts[d] ?? 0) + 1;

  const dow = (new Date().getDay() + 6) % 7;
  const start = (weeks - 1) * 7 + dow;
  let activeDays = 0;
  let totalMin = 0;

  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const back = start - i;
    if (back < 0) return { key: `f${i}`, level: -1, title: "" };
    const key = dayKey(back);
    const min = log[key] ?? 0;
    const habits = counts[key] ?? 0;
    const v = min + habits * 12;
    if (v > 0) activeDays++;
    totalMin += min;
    const level = v <= 0 ? 0 : v < goal * 0.25 ? 1 : v < goal * 0.5 ? 2 : v < goal * 0.9 ? 3 : 4;
    const date = dayDate(back).toLocaleDateString("de-AT", { day: "numeric", month: "short" });
    return { key, level, title: `${date}: ${min} min Fokus, ${habits} Routinen` };
  });

  return (
    <div>
      <div className="heat" role="img" aria-label="Aktivität der letzten Wochen">
        {cells.map((c) => (
          <span key={c.key} className={`hc ${c.level < 0 ? "off" : `l${c.level}`}`} title={c.title} />
        ))}
      </div>
      <div className="heat-foot">
        <span>
          {activeDays} aktive Tage · {Math.round(totalMin / 60)} h Fokus
        </span>
        <span className="heat-legend">
          Weniger
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`hc l${l}`} />
          ))}
          Mehr
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   Wohlbefinden: Wasser & Stimmung
   ========================================================= */

export function WellnessCard({
  well,
  setWell,
  className = "",
}: {
  well: Well;
  setWell: (w: Well) => void;
  className?: string;
}) {
  const today = dayKey();
  const cur = well[today] ?? { water: 0, mood: 0 };
  const put = (p: Partial<{ water: number; mood: number }>) => setWell({ ...well, [today]: { ...cur, ...p } });
  const cups = Math.max(8, cur.water);

  const week = [6, 5, 4, 3, 2, 1, 0].map((o) => {
    const k = dayKey(o);
    return {
      k,
      mood: well[k]?.mood ?? 0,
      label: dayDate(o).toLocaleDateString("de-AT", { weekday: "narrow" }),
    };
  });

  return (
    <Card
      className={className}
      title="Wohlbefinden"
      action={<span className="muted-sm">{cur.water * 250} ml</span>}
    >
      <div className="row-head" style={{ marginBottom: 10 }}>
        <div className="row-title">Wasser</div>
        <div className="well-step">
          <Button
            icon={<Minus size={16} weight="bold" />}
            aria-label="Weniger Wasser"
            onClick={() => put({ water: Math.max(0, cur.water - 1) })}
          />
          <b>{cur.water}</b>
          <Button icon={<Plus size={16} weight="bold" />} aria-label="Mehr Wasser" onClick={() => put({ water: cur.water + 1 })} />
        </div>
      </div>
      <div className="cups">
        {Array.from({ length: cups }, (_, i) => (
          <button
            key={i}
            className={`cup ${i < cur.water ? "on" : ""}`}
            aria-label={`Glas ${i + 1}`}
            aria-pressed={i < cur.water}
            onClick={() => put({ water: i + 1 === cur.water ? i : i + 1 })}
          >
            <Drop size={18} weight={i < cur.water ? "fill" : "regular"} />
          </button>
        ))}
      </div>

      <div className="row-title" style={{ margin: "18px 0 10px" }}>
        Stimmung heute
      </div>
      <div className="moods">
        {MOODS.map((m, i) => (
          <button
            key={m}
            className={`mood ${cur.mood === i + 1 ? "on" : ""}`}
            aria-label={MOOD_NAMES[i]}
            aria-pressed={cur.mood === i + 1}
            onClick={() => put({ mood: cur.mood === i + 1 ? 0 : i + 1 })}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="mood-week" aria-label="Stimmung der letzten 7 Tage">
        {week.map((d) => (
          <div key={d.k}>
            <span>{d.mood > 0 ? (MOODS[d.mood - 1] ?? "·") : "·"}</span>
            <em>{d.label}</em>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* =========================================================
   Listen (z. B. Einkauf)
   ========================================================= */

export function ListGlance({ lists, setLists }: { lists: TodoList[]; setLists: (l: TodoList[]) => void }) {
  const first = lists[0];
  if (!first) return <div className="empty">Noch keine Liste</div>;
  const open = first.items.filter((i) => !i.done).slice(0, 5);

  const toggle = (id: number) =>
    setLists(
      lists.map((l) =>
        l.id === first.id ? { ...l, items: l.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) } : l,
      ),
    );

  return (
    <div>
      <div className="row-sub" style={{ marginBottom: 4 }}>
        {first.name} · {first.items.filter((i) => !i.done).length} offen
      </div>
      {open.length === 0 && <div className="empty">Alles erledigt</div>}
      {open.map((i) => (
        <div className="row" key={i.id}>
          <button className="check" aria-label="Abhaken" onClick={() => toggle(i.id)}>
            <Circle size={24} />
          </button>
          <div className="row-main">
            <div className="row-title">{i.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListsView({ lists, setLists }: { lists: TodoList[]; setLists: (l: TodoList[]) => void }) {
  const [sel, setSel] = useState<number | null>(lists[0]?.id ?? null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");

  const current = lists.find((l) => l.id === sel) ?? lists[0] ?? null;

  const patch = (fn: (l: TodoList) => TodoList) => {
    if (!current) return;
    setLists(lists.map((l) => (l.id === current.id ? fn(l) : l)));
  };

  const addItem = () => {
    const t = text.trim();
    if (!t) return;
    patch((l) => ({ ...l, items: [{ id: uid(), text: t, done: false }, ...l.items] }));
    setText("");
  };

  const addList = () => {
    const n = name.trim();
    if (!n) return;
    const l: TodoList = { id: uid(), name: n, items: [] };
    setLists([...lists, l]);
    setSel(l.id);
    setName("");
  };

  const removeList = (id: number) => {
    const rest = lists.filter((l) => l.id !== id);
    setLists(rest);
    setSel(rest[0]?.id ?? null);
  };

  const sorted = current ? [...current.items].sort((a, b) => Number(a.done) - Number(b.done)) : [];
  const doneCount = current ? current.items.filter((i) => i.done).length : 0;

  return (
    <div className="split">
      <div className="col">
        {current ? (
          <>
            <div
              className="toolbar"
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem();
              }}
            >
              <div className="grow">
                <Input
                  type="text"
                  aria-label="Neuer Eintrag"
                  placeholder={`Zu „${current.name}“ hinzufügen …`}
                  value={text}
                  onValueChange={setText}
                />
              </div>
              <Button icon={<Plus size={20} weight="bold" />} aria-label="Hinzufügen" onClick={addItem} />
            </div>

            <div className="card spot list" style={{ marginTop: 16 }}>
              {sorted.length === 0 && <div className="empty">Diese Liste ist leer</div>}
              {sorted.map((i) => (
                <div className="row" key={i.id}>
                  <button
                    className={`check ${i.done ? "done" : ""}`}
                    aria-label={i.done ? "Als offen markieren" : "Abhaken"}
                    onClick={() =>
                      patch((l) => ({ ...l, items: l.items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)) }))
                    }
                  >
                    {i.done ? <CheckCircle size={26} weight="fill" /> : <Circle size={26} />}
                  </button>
                  <div className="row-main">
                    <div className={`row-title ${i.done ? "done" : ""}`}>{i.text}</div>
                  </div>
                  <Button
                    icon={<Trash size={16} />}
                    aria-label="Eintrag löschen"
                    onClick={() => patch((l) => ({ ...l, items: l.items.filter((x) => x.id !== i.id) }))}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="card spot">
            <div className="empty">Lege rechts deine erste Liste an</div>
          </div>
        )}
      </div>

      <aside className="split-side free">
        <Card title="Meine Listen">
          {lists.map((l) => (
            <div className="row" key={l.id}>
              <button
                className={`list-pick ${current?.id === l.id ? "on" : ""}`}
                onClick={() => setSel(l.id)}
                aria-pressed={current?.id === l.id}
              >
                <b>{l.name}</b>
                <span>{l.items.filter((i) => !i.done).length} offen</span>
              </button>
              <Menu
                aria-label="Optionen"
                items={[
                  {
                    label: "Erledigte entfernen",
                    icon: <CheckCircle size={18} />,
                    onSelect: () =>
                      setLists(lists.map((x) => (x.id === l.id ? { ...x, items: x.items.filter((i) => !i.done) } : x))),
                  },
                  "separator",
                  { label: "Liste löschen", icon: <Trash size={18} />, destructive: true, onSelect: () => removeList(l.id) },
                ]}
              />
            </div>
          ))}
          <div
            className="quick"
            style={{ marginTop: 10 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addList();
            }}
          >
            <div className="grow">
              <Input type="text" aria-label="Neue Liste" placeholder="Neue Liste …" value={name} onValueChange={setName} />
            </div>
            <Button icon={<Plus size={20} weight="bold" />} aria-label="Liste anlegen" onClick={addList} />
          </div>
        </Card>

        {current && (
          <Card title="Fortschritt">
            <div className="meter-head">
              <span>{current.name}</span>
              <b>
                {doneCount} / {current.items.length}
              </b>
            </div>
            <div className="meter-bar">
              <i
                style={{
                  width: `${current.items.length > 0 ? (doneCount / current.items.length) * 100 : 0}%`,
                  background: "var(--green)",
                }}
              />
            </div>
          </Card>
        )}
      </aside>
    </div>
  );
}