import { useRef, useState } from "react";
import type { BgState as Bg } from "./theme";
import { Button, SegmentedControl, Slider } from "glisse";
import { Trash, UploadSimple } from "@phosphor-icons/react";
import { getPerf, setPerf } from "./perf";
import type { PerfMode } from "./perf";
import { ACCENTS, PRESETS, compressImage } from "./theme";
import type { BgState } from "./theme";

export function Appearance({
  bg,
  setBg,
  image,
  setImage,
}: {
  bg: BgState;
  setBg: (b: BgState) => void;
  image: string;
  setImage: (s: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [perf, setPerfState] = useState<PerfMode>(getPerf);
  const isImage = bg.mode === "image" && image !== "";

  /* Slider: höchstens eine Änderung pro Bild, sonst wird die ganze App bei jedem Pixel neu gezeichnet */
  const bgRef = useRef(bg);
  bgRef.current = bg;
  const pend = useRef<Bg | null>(null);
  const raf = useRef(0);
  const patch = (p: Partial<Bg>) => {
    pend.current = { ...(pend.current ?? bgRef.current), ...p };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const n = pend.current;
      pend.current = null;
      if (n) setBg(n);
    });
  };

  const onFile = async (file: File) => {
    setErr("");
    setBusy(true);
    try {
      const data = await compressImage(file);
      try {
        localStorage.setItem("ios-bg-image", JSON.stringify(data));
      } catch {
        setErr("Das Bild ist zu groß für den Browser-Speicher. Nimm ein kleineres.");
        setBusy(false);
        return;
      }
      setImage(data);
      setBg({ ...bg, mode: "image" });
    } catch {
      setErr("Das Bild konnte nicht gelesen werden.");
    }
    setBusy(false);
  };

  return (
    <div className="card spot appearance">
      <div className="card-title">
        <span>Hintergrund</span>
      </div>

      <div className="swatches">
        {PRESETS.map((p) => {
          const [a, b, c] = p.colors;
          return (
            <button
              key={p.id}
              className={`swatch ${!isImage && bg.preset === p.id ? "on" : ""}`}
              style={{ background: `linear-gradient(135deg, ${a}, ${b} 55%, ${c}), ${p.base}` }}
              aria-pressed={!isImage && bg.preset === p.id}
              onClick={() => setBg({ ...bg, mode: "preset", preset: p.id })}
            >
              {p.name}
            </button>
          );
        })}
        {image && (
          <button
            className={`swatch img ${isImage ? "on" : ""}`}
            style={{ backgroundImage: `url(${image})` }}
            aria-pressed={isImage}
            onClick={() => setBg({ ...bg, mode: "image" })}
          >
            Mein Bild
          </button>
        )}
      </div>

      <div className="controls" style={{ justifyContent: "flex-start", marginTop: 16 }}>
        <Button icon={<UploadSimple size={18} weight="bold" />} onClick={() => fileRef.current?.click()}>
          {busy ? "Lädt …" : image ? "Bild ändern" : "Eigenes Bild"}
        </Button>
        {image && (
          <Button
            icon={<Trash size={18} />}
            onClick={() => {
              setImage("");
              setBg({ ...bg, mode: "preset" });
            }}
          >
            Bild entfernen
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {err && <div className="row-sub" style={{ color: "var(--red)", marginTop: 8 }}>{err}</div>}

      <div className="ctl">
        <div>
          <div className="meter-head">
            <span>Abdunkeln</span>
            <b>{bg.dim}%</b>
          </div>
          <Slider aria-label="Abdunkeln" value={Math.round(bg.dim / 0.8)} onValueChange={(v: number) => patch({ dim: Math.round(v * 0.8) })} />
        </div>
        {isImage && (
          <div>
            <div className="meter-head">
              <span>Weichzeichnen</span>
              <b>{bg.blur} px</b>
            </div>
            <Slider aria-label="Weichzeichnen" value={Math.round(bg.blur / 0.3)} onValueChange={(v: number) => patch({ blur: Math.round(v * 0.3) })} />
          </div>
        )}
        <div>
          <div className="meter-head">
            <span>Glas-Stärke der Karten</span>
            <b>{bg.glass}%</b>
          </div>
          <Slider aria-label="Glas-Stärke" value={bg.glass} onValueChange={(v: number) => patch({ glass: Math.round(v) })} />
        </div>
        <div>
          <div className="meter-head">
            <span>Akzentfarbe</span>
          </div>
          <div className="accents">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                className={`accent-dot ${bg.accent === a.color ? "on" : ""}`}
                style={{ background: a.color }}
                aria-label={a.name}
                aria-pressed={bg.accent === a.color}
                onClick={() => setBg({ ...bg, accent: a.color })}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="meter-head">
            <span>Leistung</span>
            <b>{perf === "lite" ? "Sparsam" : "Voll"}</b>
          </div>
          <SegmentedControl
            aria-label="Leistung"
            items={[
              { value: "full", label: "Voll" },
              { value: "lite", label: "Sparsam" },
            ]}
            value={perf}
            onValueChange={(v: string) => {
              const m: PerfMode = v === "lite" ? "lite" : "full";
              setPerfState(m);
              setPerf(m);
            }}
          />
          <div className="row-sub" style={{ marginTop: 8 }}>
            „Sparsam“ schaltet Unschärfe-Effekte und Animationen ab. Nutze es, wenn die App auf deinem Gerät ruckelt.
          </div>
        </div>
      </div>
    </div>
  );
}