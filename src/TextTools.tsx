import { useState } from "react";
import { Button, Slider } from "glisse";
import { Copy, SpeakerHigh, Stop } from "@phosphor-icons/react";
import { fmt } from "./lib";
import { Card, Facts } from "./ui";
import "./tools2.css";

const copy = (s: string) => {
  void navigator.clipboard?.writeText(s).catch(() => {});
};

type Op = { id: string; label: string; run: (s: string) => string };

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s\-_])(\p{L})/gu, (_m: string, a: string, b: string) => a + b.toUpperCase());

const OPS: Op[] = [
  { id: "up", label: "GROSS", run: (s) => s.toUpperCase() },
  { id: "low", label: "klein", run: (s) => s.toLowerCase() },
  { id: "title", label: "Titel", run: titleCase },
  { id: "sort", label: "A-Z sortieren", run: (s) => s.split("\n").sort((a, b) => a.localeCompare(b, "de")).join("\n") },
  { id: "uniq", label: "Duplikate entfernen", run: (s) => [...new Set(s.split("\n"))].join("\n") },
  { id: "rev", label: "Zeilen umkehren", run: (s) => s.split("\n").reverse().join("\n") },
  { id: "num", label: "Nummerieren", run: (s) => s.split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n") },
  {
    id: "trim",
    label: "Leerzeichen säubern",
    run: (s) =>
      s
        .split("\n")
        .map((l) => l.trim().replace(/\s+/g, " "))
        .filter((l) => l)
        .join("\n"),
  },
  {
    id: "slug",
    label: "Slug",
    run: (s) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
  },
];

const LOREM =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur".split(
    " ",
  );

function lorem(paragraphs: number) {
  const out: string[] = [];
  for (let p = 0; p < paragraphs; p++) {
    const words: string[] = [];
    for (let i = 0; i < 46; i++) words.push(LOREM[(p * 7 + i) % LOREM.length] ?? "");
    const text = words.join(" ");
    out.push(`${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
  }
  return out.join("\n\n");
}

export function TextTool() {
  const [text, setText] = useState("");
  const [rate, setRate] = useState(50);
  const [paras, setParas] = useState(2);
  const [speaking, setSpeaking] = useState(false);
  const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const speak = () => {
    if (!synth || !text.trim()) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    u.rate = 0.6 + (rate / 100) * 1.2;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };
  const stop = () => {
    synth?.cancel();
    setSpeaking(false);
  };

  return (
    <div className="split">
      <div className="col stack-lg">
        <Card title="Text">
          <textarea className="ta" style={{ minHeight: 200 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text einfügen oder tippen …" aria-label="Text" />
          <div className="chips-wrap" style={{ paddingTop: 0 }}>
            {OPS.map((o) => (
              <button key={o.id} className="tag" onClick={() => setText(o.run(text))}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="controls" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <Button icon={<Copy size={18} />} onClick={() => copy(text)}>
              Kopieren
            </Button>
          </div>
        </Card>

        <Card title="Lorem Ipsum">
          <div className="chips-wrap" style={{ paddingTop: 0 }}>
            {[1, 2, 3, 5].map((n) => (
              <button key={n} className={`tag${paras === n ? " on" : ""}`} onClick={() => setParas(n)}>
                {n} {n === 1 ? "Absatz" : "Absätze"}
              </button>
            ))}
          </div>
          <div className="controls" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <Button onClick={() => setText(lorem(paras))}>In den Text einfügen</Button>
          </div>
        </Card>
      </div>

      <aside className="split-side free">
        <Card title="Statistik">
          <Facts
            rows={[
              ["Zeichen", fmt(text.length, 0)],
              ["Wörter", fmt(words, 0)],
              ["Zeilen", fmt(text ? text.split("\n").length : 0, 0)],
              ["Lesezeit", words === 0 ? "-" : `${Math.max(1, Math.round(words / 200))} min`],
            ]}
          />
        </Card>
        <Card title="Vorlesen">
          {synth ? (
            <div className="stack">
              <div className="meter-head">
                <span>Tempo</span>
                <b>{fmt(0.6 + (rate / 100) * 1.2, 1)}×</b>
              </div>
              <Slider aria-label="Tempo" value={rate} onValueChange={(v: number) => setRate(Math.round(v))} />
              {speaking ? (
                <Button icon={<Stop size={18} weight="fill" />} onClick={stop}>
                  Stopp
                </Button>
              ) : (
                <Button icon={<SpeakerHigh size={18} weight="fill" />} onClick={speak}>
                  Vorlesen
                </Button>
              )}
              <p className="tip small">Nutzt die Stimmen deines Geräts. Es wird nichts hochgeladen.</p>
            </div>
          ) : (
            <div className="empty">Dein Browser unterstützt kein Vorlesen.</div>
          )}
        </Card>
      </aside>
    </div>
  );
}