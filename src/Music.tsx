import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button, Glass, Input, Menu, Slider } from "glisse";
import {
  ArrowsClockwise,
  FilePlus,
  FolderOpen,
  MagnifyingGlass,
  MusicNotes,
  Pause,
  Play,
  Repeat,
  RepeatOnce,
  Shuffle,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerSlash,
  Trash,
} from "@phosphor-icons/react";
import { Eq } from "./DynamicIsland";
import type { MusicApi, Track } from "./player";
import { Card } from "./ui";

const mmss = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/* Das Glas ändert sich nie: als feste Konstante wird es bei den Sekunden-Updates nicht neu gezeichnet */
const NP_GLASS = (
  <Glass
    style={
      {
        width: "100%",
        height: 620,
        borderRadius: 32,
        background: "none",
        "--lg-glass-bend": 0.45,
        "--lg-glass-dispersion": 0.4,
        "--lg-blur": "0px",
        "--lg-rim-shine": 0.13,
      } as CSSProperties
    }
  />
);

type Row = { t: Track; i: number };

/** Die Titelliste zeichnet sich nur neu, wenn sich Liste, aktueller Titel oder Wiedergabe ändern (nicht jede Sekunde). */
const TrackList = memo(function TrackList({
  rows,
  current,
  playing,
  onPlay,
}: {
  rows: Row[];
  current: number;
  playing: boolean;
  onPlay: (i: number) => void;
}) {
  return (
    <>
      {rows.map(({ t, i }, n) => {
        const on = i === current;
        return (
          <button key={t.id + n} className={`track${on ? " on" : ""}`} onClick={() => onPlay(i)}>
            <span className="track-n">{on ? <Eq on={playing} /> : n + 1}</span>
            <span className="track-main">
              <b>{t.title}</b>
              <span>{t.artist || "Unbekannter Interpret"}</span>
            </span>
          </button>
        );
      })}
    </>
  );
});

/** Kleine Karte fürs Dashboard. */
export function MusicMini({ p, onOpen }: { p: MusicApi; onOpen: () => void }) {
  const c = p.current;
  const has = p.tracks.length > 0;
  return (
    <Card className="mini-np-card" title="Musik" action={<Eq on={p.playing} />}>
      {!has ? (
        <div className="mini-np">
          <div className="row-sub">{p.needsAccess ? `Ordner „${p.dirName}“ verbinden` : "Spiele deine Musik aus einem Ordner."}</div>
          <Button icon={<MusicNotes size={18} weight="fill" />} onClick={onOpen}>
            Musik öffnen
          </Button>
        </div>
      ) : (
        <div className="mini-np">
          <button className="mini-row" onClick={onOpen} aria-label="Musik öffnen">
            <span className="mini-cover" style={p.cover ? { backgroundImage: `url("${p.cover}")` } : undefined}>
              {!p.cover && <MusicNotes size={24} weight="fill" />}
            </span>
            <span className="row-main">
              <span className="row-title">{c ? c.title : "Titel wählen"}</span>
              <span className="row-sub" style={{ display: "block" }}>
                {c ? c.artist || "Unbekannter Interpret" : `${p.tracks.length} Titel`}
              </span>
            </span>
          </button>
          <div className="mini-ctl">
            <Button icon={<SkipBack size={18} weight="fill" />} aria-label="Zurück" onClick={p.prev} />
            <Button
              icon={p.playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
              aria-label={p.playing ? "Pause" : "Abspielen"}
              onClick={p.toggle}
            />
            <Button icon={<SkipForward size={18} weight="fill" />} aria-label="Weiter" onClick={() => p.next()} />
          </div>
        </div>
      )}
    </Card>
  );
}

/** Die Musik-Seite. */
export function Music({ p }: { p: MusicApi }) {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(300);
  const files = useRef<HTMLInputElement>(null);
  const dir = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dir.current?.setAttribute("webkitdirectory", "");
  }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = p.tracks.map((t, i) => ({ t, i }));
    return s ? all.filter(({ t }) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(s)) : all;
  }, [p.tracks, q]);

  const shown = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const has = p.tracks.length > 0;
  const c = p.current;
  const progress = p.duration > 0 ? (p.time / p.duration) * 100 : 0;
  const chooseFolder = () => {
    if (p.supportsFolder) void p.pickFolder();
    else dir.current?.click();
  };
  const onPicked = (list: FileList | null) => {
    if (list && list.length > 0) p.addFiles(Array.from(list));
  };

  const menu = [
    ...(p.supportsFolder && p.dirName
      ? [{ label: "Ordner neu einlesen", icon: <ArrowsClockwise size={18} />, onSelect: () => void p.reconnect() }]
      : []),
    { label: "Bibliothek leeren", icon: <Trash size={18} />, onSelect: p.forget, destructive: true },
  ];

  return (
    <div className="page" key="music">
      <header className="head">
        <div>
          <div className="eyebrow">{p.dirName ? `${p.tracks.length} Titel · ${p.dirName}` : "Deine Musik"}</div>
          <h1 className="large-title">Musik</h1>
        </div>
        <div className="head-actions">
          <Button icon={<FolderOpen size={18} weight="bold" />} onClick={chooseFolder}>
            Ordner
          </Button>
          <Button icon={<FilePlus size={18} weight="bold" />} onClick={() => files.current?.click()}>
            Dateien
          </Button>
          {(p.dirName !== "" || has) && <Menu aria-label="Musik-Optionen" items={menu} />}
        </div>
      </header>

      <input
        ref={files}
        type="file"
        hidden
        multiple
        accept="audio/*,.mp3,.m4a,.flac,.ogg,.opus,.wav,.aac"
        onChange={(e) => {
          onPicked(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={dir}
        type="file"
        hidden
        multiple
        onChange={(e) => {
          onPicked(e.target.files);
          e.target.value = "";
        }}
      />

      {p.needsAccess && (
        <div className="notice" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>Dein Ordner „{p.dirName}“ muss kurz neu freigegeben werden.</span>
          <Button onClick={() => void p.reconnect()}>Verbinden</Button>
        </div>
      )}
      {p.status && <div className="notice">{p.status}</div>}

      <div className="music-grid stagger">
        <section className="np spot" aria-label="Jetzt läuft">
          <div className="np-glass">{NP_GLASS}</div>
          <div className="np-body">
            <div className={`np-cover${p.playing ? " on" : ""}`} style={p.cover ? { backgroundImage: `url("${p.cover}")` } : undefined}>
              {!p.cover && <MusicNotes size={72} weight="fill" />}
            </div>

            <div className="np-meta">
              <div className="np-title">{c ? c.title : has ? "Titel wählen" : "Keine Musik geladen"}</div>
              <div className="np-artist">{c ? [c.artist || "Unbekannter Interpret", c.album].filter(Boolean).join(" · ") : " "}</div>
            </div>

            <div className="np-seek">
              <Slider
                aria-label="Position"
                value={progress}
                disabled={!c}
                onValueChange={(v: number) => p.seek((v / 100) * p.duration)}
              />
              <div className="np-times">
                <span>{mmss(p.time)}</span>
                <span>{mmss(p.duration)}</span>
              </div>
            </div>

            <div className="np-ctl">
              <Button
                icon={<Shuffle size={18} weight={p.shuffle ? "fill" : "bold"} color={p.shuffle ? "var(--accent)" : "currentColor"} />}
                aria-label="Zufällig"
                aria-pressed={p.shuffle}
                onClick={p.toggleShuffle}
              />
              <Button icon={<SkipBack size={20} weight="fill" />} aria-label="Zurück" onClick={p.prev} />
              <Button
                icon={p.playing ? <Pause size={26} weight="fill" /> : <Play size={26} weight="fill" />}
                aria-label={p.playing ? "Pause" : "Abspielen"}
                onClick={p.toggle}
              />
              <Button icon={<SkipForward size={20} weight="fill" />} aria-label="Weiter" onClick={() => p.next()} />
              <Button
                icon={
                  p.repeat === "one" ? (
                    <RepeatOnce size={18} weight="fill" color="var(--accent)" />
                  ) : (
                    <Repeat size={18} weight={p.repeat === "all" ? "fill" : "bold"} color={p.repeat === "all" ? "var(--accent)" : "currentColor"} />
                  )
                }
                aria-label="Wiederholen"
                onClick={p.cycleRepeat}
              />
            </div>

            <div className="np-vol">
              {p.volume === 0 ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />}
              <div>
                <Slider aria-label="Lautstärke" value={p.volume} onValueChange={(v: number) => p.setVolume(Math.round(v))} />
              </div>
            </div>
          </div>
        </section>

        <Card title="Bibliothek" action={<span className="muted-sm">{rows.length} Titel</span>}>
          {!has ? (
            <div className="music-empty">
              <MusicNotes size={44} weight="duotone" />
              <div>
                Wähle deinen Musikordner. Auf Chrome und Edge am PC merkt sich die App den Ordner. Auf dem iPhone wählst
                du die Dateien jedes Mal neu aus.
              </div>
              <div className="controls" style={{ marginTop: 0 }}>
                <Button icon={<FolderOpen size={18} weight="bold" />} onClick={chooseFolder}>
                  Ordner wählen
                </Button>
                <Button icon={<FilePlus size={18} weight="bold" />} onClick={() => files.current?.click()}>
                  Dateien wählen
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Input
                type="search"
                aria-label="Musik suchen"
                placeholder="Titel, Interpret oder Album"
                icon={<MagnifyingGlass size={18} weight="bold" />}
                value={q}
                onValueChange={(v: string) => {
                  setQ(v);
                  setLimit(300);
                }}
              />
              <div className="tracks" style={{ marginTop: 10 }}>
                <TrackList rows={shown} current={p.currentIndex} playing={p.playing} onPlay={p.play} />
                {rows.length === 0 && <div className="empty">Nichts gefunden</div>}
                {rows.length > limit && (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <Button onClick={() => setLimit(limit + 300)}>Mehr anzeigen</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}