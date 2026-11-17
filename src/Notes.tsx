import { useState } from "react";
import { Button, Input } from "glisse";
import { MagnifyingGlass, Plus, Trash } from "@phosphor-icons/react";

export type Note = { id: number; text: string; at: number };

const title = (t: string) => (t.split("\n")[0] ?? "").trim() || "Neue Notiz";
const preview = (t: string) => t.split("\n").slice(1).join(" ").trim() || "Kein weiterer Text";

export function Notes({ notes, setNotes }: { notes: Note[]; setNotes: (n: Note[]) => void }) {
  const [sel, setSel] = useState<number | null>(notes[0]?.id ?? null);
  const [q, setQ] = useState("");

  const current = notes.find((n) => n.id === sel) ?? null;
  const list = notes
    .filter((n) => n.text.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.at - a.at);

  const create = () => {
    const n: Note = { id: Date.now(), text: "", at: Date.now() };
    setNotes([n, ...notes]);
    setSel(n.id);
  };
  const update = (text: string) => {
    if (!current) return;
    setNotes(notes.map((n) => (n.id === current.id ? { ...n, text, at: Date.now() } : n)));
  };
  const remove = () => {
    if (!current) return;
    const rest = notes.filter((n) => n.id !== current.id);
    setNotes(rest);
    setSel(rest[0]?.id ?? null);
  };

  return (
    <div className="notes">
      <div className="notes-list card spot">
        <div className="toolbar">
          <div className="grow">
            <Input
              type="search"
              aria-label="Notizen durchsuchen"
              placeholder="Suchen"
              icon={<MagnifyingGlass size={18} weight="bold" />}
              value={q}
              onValueChange={setQ}
            />
          </div>
          <Button icon={<Plus size={20} weight="bold" />} aria-label="Neue Notiz" onClick={create} />
        </div>
        {list.length === 0 && <div className="empty">Keine Notizen</div>}
        {list.map((n) => (
          <button key={n.id} className={`note-item ${n.id === sel ? "on" : ""}`} onClick={() => setSel(n.id)}>
            <b>{title(n.text)}</b>
            <span>{preview(n.text)}</span>
            <em>{new Date(n.at).toLocaleDateString("de-AT", { day: "numeric", month: "short" })}</em>
          </button>
        ))}
      </div>

      <div className="notes-edit card spot">
        {current ? (
          <>
            <div className="card-title">
              <span>
                Zuletzt geändert{" "}
                {new Date(current.at).toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <Button icon={<Trash size={18} />} aria-label="Notiz löschen" onClick={remove} />
            </div>
            <textarea
              className="note-area"
              value={current.text}
              placeholder="Erste Zeile = Titel. Schreib einfach los …"
              onChange={(e) => update(e.target.value)}
              autoFocus
            />
          </>
        ) : (
          <div className="empty">
            Wähle eine Notiz oder erstelle eine neue.
            <div style={{ marginTop: 12 }}>
              <Button icon={<Plus size={18} weight="bold" />} onClick={create}>
                Neue Notiz
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}