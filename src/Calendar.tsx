import { useMemo, useState } from "react";
import { Button, Input } from "glisse";
import { CaretLeft, CaretRight, Plus, Trash } from "@phosphor-icons/react";
import { addMonths, dayKey, monthLabel, pad, relDay, uid } from "./lib";
import { Card, Field } from "./ui";

export type CalEvent = { id: number; title: string; date: string; time: string };

const byTime = (a: CalEvent, b: CalEvent) => (a.date + a.time).localeCompare(b.date + b.time);

/** Nächste Termine für das Dashboard. */
export function UpcomingEvents({ events }: { events: CalEvent[] }) {
  const today = dayKey();
  const list = events
    .filter((e) => e.date >= today)
    .sort(byTime)
    .slice(0, 4);

  if (list.length === 0) return <div className="empty">Keine Termine</div>;
  return (
    <div>
      {list.map((e) => (
        <div className="row" key={e.id}>
          <div className="row-main">
            <div className="row-title">{e.title}</div>
            <div className="row-sub">
              {relDay(e.date)}
              {e.time ? ` · ${e.time} Uhr` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const DOW = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function CalendarView({
  events,
  setEvents,
}: {
  events: CalEvent[];
  setEvents: (e: CalEvent[]) => void;
}) {
  const [cursor, setCursor] = useState(() => addMonths(new Date(), 0));
  const [sel, setSel] = useState(dayKey());
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  const y = cursor.getFullYear();
  const mo = cursor.getMonth();
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
  const dim = new Date(y, mo + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];

  const today = dayKey();
  const dayEvents = [...(byDate[sel] ?? [])].sort(byTime);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    setEvents([...events, { id: uid(), title: t, date: sel, time }]);
    setTitle("");
    setTime("");
  };

  return (
    <div className="split">
      <Card>
        <div className="cal-head">
          <Button icon={<CaretLeft size={18} weight="bold" />} aria-label="Vorheriger Monat" onClick={() => setCursor(addMonths(cursor, -1))} />
          <div className="cal-title">{monthLabel(cursor)}</div>
          <Button icon={<CaretRight size={18} weight="bold" />} aria-label="Nächster Monat" onClick={() => setCursor(addMonths(cursor, 1))} />
        </div>

        <div className="cal-grid">
          {DOW.map((d) => (
            <div className="cal-dow" key={d}>
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <span className="cal-blank" key={`b${i}`} />;
            const key = `${y}-${pad(mo + 1)}-${pad(d)}`;
            const count = byDate[key]?.length ?? 0;
            return (
              <button
                key={key}
                className={`cal-day ${key === today ? "today" : ""} ${key === sel ? "sel" : ""}`}
                onClick={() => setSel(key)}
                aria-label={`${d}. ${monthLabel(cursor)}${count ? `, ${count} Termine` : ""}`}
                aria-pressed={key === sel}
              >
                {d}
                <span className="cal-dots">
                  {Array.from({ length: Math.min(count, 3) }, (_, n) => (
                    <i key={n} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <aside className="split-side">
        <Card title={relDay(sel)} action={<span className="muted-sm">{dayEvents.length} Termine</span>}>
          <div
            className="stack"
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          >
            <Input type="text" aria-label="Neuer Termin" placeholder="Neuer Termin …" value={title} onValueChange={setTitle} />
            <div className="swap" style={{ gridTemplateColumns: "1fr auto" }}>
              <Field label="Uhrzeit (optional)">
                <input
                  className="sel"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-label="Uhrzeit"
                />
              </Field>
              <Button icon={<Plus size={20} weight="bold" />} aria-label="Termin hinzufügen" onClick={add} />
            </div>
          </div>

          {dayEvents.length === 0 && <div className="empty">Nichts geplant</div>}
          {dayEvents.map((e) => (
            <div className="row" key={e.id}>
              <div className="row-main">
                <div className="row-title">{e.title}</div>
                <div className="row-sub">{e.time ? `${e.time} Uhr` : "Ganztägig"}</div>
              </div>
              <Button
                icon={<Trash size={18} />}
                aria-label="Termin löschen"
                onClick={() => setEvents(events.filter((x) => x.id !== e.id))}
              />
            </div>
          ))}
        </Card>
      </aside>
    </div>
  );
}