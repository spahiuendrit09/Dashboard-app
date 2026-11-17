import { useEffect, useRef, useState } from "react";
import { Button, Input, SegmentedControl, Slider } from "glisse";
import { ArrowDown, ArrowUp, DownloadSimple, Trash, UploadSimple } from "@phosphor-icons/react";
import { PDFDocument, degrees } from "pdf-lib";
import { toDataURL } from "qrcode";
import { fmt } from "./lib";
import { Field } from "./ui";

/* ---------- Helfer ---------- */
const kb = (n: number) => (n >= 1048576 ? `${fmt(n / 1048576, 1)} MB` : `${fmt(n / 1024, 0)} KB`);
const blobOf = (bytes: Uint8Array, type: string) => new Blob([bytes as BlobPart], { type });

function saveUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  saveUrl(url, name);
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function Drop({
  accept,
  multiple,
  label,
  onFiles,
}: {
  accept: string;
  multiple: boolean;
  label: string;
  onFiles: (f: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`drop${over ? " over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <UploadSimple size={26} />
      <div>{label}</div>
      <Button onClick={() => ref.current?.click()}>Dateien wählen</Button>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Rows({ files, setFiles, sortable }: { files: File[]; setFiles: (f: File[]) => void; sortable: boolean }) {
  const move = (i: number, d: number) => {
    const j = i + d;
    const a = files[i];
    const b = files[j];
    if (!a || !b) return;
    const next = [...files];
    next[i] = b;
    next[j] = a;
    setFiles(next);
  };
  return (
    <div>
      {files.map((f, i) => (
        <div className="frow" key={`${f.name}-${i}`}>
          <div className="row-main">
            <div className="row-title" style={{ fontSize: 15 }}>
              {f.name}
            </div>
            <div className="row-sub">{kb(f.size)}</div>
          </div>
          {sortable && (
            <>
              <Button icon={<ArrowUp size={16} weight="bold" />} aria-label="Nach oben" onClick={() => move(i, -1)} />
              <Button icon={<ArrowDown size={16} weight="bold" />} aria-label="Nach unten" onClick={() => move(i, 1)} />
            </>
          )}
          <Button icon={<Trash size={16} />} aria-label="Entfernen" onClick={() => setFiles(files.filter((_, k) => k !== i))} />
        </div>
      ))}
    </div>
  );
}

async function toJpeg(file: File): Promise<Uint8Array> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
  if (!blob) throw new Error("Bild konnte nicht umgewandelt werden.");
  return new Uint8Array(await blob.arrayBuffer());
}

/** "1-3, 5, 8-" in eine Liste von Seitenindizes (ab 0). */
function parseRange(s: string, total: number): number[] {
  const out: number[] = [];
  for (const part of s.split(",")) {
    const t = part.trim();
    if (!t) continue;
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(t);
    let a = 0;
    let b = 0;
    if (m) {
      a = m[1] ? Number(m[1]) : 1;
      b = m[2] ? Number(m[2]) : total;
    } else if (/^\d+$/.test(t)) {
      a = Number(t);
      b = a;
    } else throw new Error(`„${t}“ verstehe ich nicht.`);
    if (a < 1 || b > total || a > b) throw new Error(`„${t}“ liegt außerhalb (die PDF hat ${total} Seiten).`);
    for (let i = a; i <= b; i++) out.push(i - 1);
  }
  if (out.length === 0) throw new Error("Gib Seiten an, zum Beispiel 1-3, 5.");
  return out;
}

/* =========================================================
   PDF-Werkstatt
   ========================================================= */

export function PdfTool() {
  const [mode, setMode] = useState("merge");
  const [files, setFiles] = useState<File[]>([]);
  const [range, setRange] = useState("");
  const [rot, setRot] = useState("90");
  const [fit, setFit] = useState("a4");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pages, setPages] = useState(0);

  const multi = mode === "merge" || mode === "images";
  const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  const isImg = (f: File) => f.type.startsWith("image/");

  const first = files[0];
  useEffect(() => {
    let dead = false;
    if (!first || multi) {
      setPages(0);
      return;
    }
    void first
      .arrayBuffer()
      .then((b) => PDFDocument.load(b, { ignoreEncryption: true }))
      .then((d) => {
        if (!dead) setPages(d.getPageCount());
      })
      .catch(() => {
        if (!dead) setPages(0);
      });
    return () => {
      dead = true;
    };
  }, [first, multi]);

  const change = (v: string) => {
    setMode(v);
    setFiles([]);
    setMsg("");
  };

  const add = (list: File[]) => {
    const ok = list.filter(mode === "images" ? isImg : isPdf);
    setMsg(ok.length < list.length ? "Einige Dateien hatten das falsche Format und wurden ignoriert." : "");
    setFiles(multi ? [...files, ...ok] : ok.slice(0, 1));
  };

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (mode === "merge") {
        if (files.length < 2) throw new Error("Wähle mindestens zwei PDFs.");
        const out = await PDFDocument.create();
        for (const f of files) {
          const src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
          const pgs = await out.copyPages(src, src.getPageIndices());
          pgs.forEach((p) => out.addPage(p));
        }
        saveBlob(blobOf(await out.save(), "application/pdf"), "zusammengefuegt.pdf");
      } else if (mode === "images") {
        if (files.length === 0) throw new Error("Wähle mindestens ein Bild.");
        const out = await PDFDocument.create();
        for (const f of files) {
          const buf = new Uint8Array(await f.arrayBuffer());
          const img =
            f.type === "image/png"
              ? await out.embedPng(buf)
              : f.type === "image/jpeg"
                ? await out.embedJpg(buf)
                : await out.embedJpg(await toJpeg(f));
          const w = img.width;
          const h = img.height;
          if (fit === "image") {
            out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
          } else {
            const [pw, ph] = w > h ? [841.89, 595.28] : [595.28, 841.89];
            const m = 24;
            const s = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h);
            const dw = w * s;
            const dh = h * s;
            out.addPage([pw, ph]).drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
          }
        }
        saveBlob(blobOf(await out.save(), "application/pdf"), "bilder.pdf");
      } else {
        const f = files[0];
        if (!f) throw new Error("Wähle zuerst eine PDF.");
        const src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
        if (mode === "pages") {
          const idx = parseRange(range, src.getPageCount());
          const out = await PDFDocument.create();
          const pgs = await out.copyPages(src, idx);
          pgs.forEach((p) => out.addPage(p));
          saveBlob(blobOf(await out.save(), "application/pdf"), "seiten.pdf");
        } else {
          src.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + Number(rot)) % 360)));
          saveBlob(blobOf(await src.save(), "application/pdf"), "gedreht.pdf");
        }
      }
      setMsg("Fertig, die Datei wurde heruntergeladen.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    }
    setBusy(false);
  };

  return (
    <div className="stack">
      <SegmentedControl
        aria-label="PDF-Funktion"
        items={[
          { value: "merge", label: "Zusammenfügen" },
          { value: "images", label: "Bilder → PDF" },
          { value: "pages", label: "Seiten" },
          { value: "rotate", label: "Drehen" },
        ]}
        value={mode}
        onValueChange={change}
      />
      <Drop
        accept={mode === "images" ? "image/*" : "application/pdf,.pdf"}
        multiple={multi}
        label={multi ? "Dateien hierher ziehen" : "Eine PDF hierher ziehen"}
        onFiles={add}
      />
      {files.length > 0 && <Rows files={files} setFiles={setFiles} sortable={multi} />}

      {mode === "images" && (
        <SegmentedControl
          aria-label="Seitengröße"
          items={[
            { value: "a4", label: "A4-Seiten" },
            { value: "image", label: "Bildgröße" },
          ]}
          value={fit}
          onValueChange={setFit}
        />
      )}
      {mode === "pages" && (
        <Field label={pages > 0 ? `Seiten (die PDF hat ${pages})` : "Seiten"}>
          <Input type="text" aria-label="Seiten" placeholder="z. B. 1-3, 5, 8-" value={range} onValueChange={setRange} />
        </Field>
      )}
      {mode === "rotate" && (
        <SegmentedControl
          aria-label="Drehung"
          items={[
            { value: "90", label: "90° rechts" },
            { value: "180", label: "180°" },
            { value: "270", label: "90° links" },
          ]}
          value={rot}
          onValueChange={setRot}
        />
      )}

      <Button icon={<DownloadSimple size={18} weight="bold" />} onClick={() => void run()}>
        {busy ? "Arbeite …" : "PDF erstellen"}
      </Button>
      {msg && <div className="row-sub">{msg}</div>}
      <p className="tip small">
        Alles passiert nur in deinem Browser, nichts wird hochgeladen. PDF in Word umwandeln und Word in PDF gehen im
        Browser nicht zuverlässig.
      </p>
    </div>
  );
}

/* =========================================================
   Bilder umwandeln
   ========================================================= */

type Result = { name: string; url: string; blob: Blob; before: number };
const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function ImageTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [fmtId, setFmtId] = useState("jpg");
  const [qS, setQS] = useState(70);
  const [side, setSide] = useState(0);
  const [res, setRes] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const q = 0.5 + qS / 200;

  useEffect(() => () => res.forEach((r) => URL.revokeObjectURL(r.url)), [res]);

  const run = async () => {
    setBusy(true);
    setMsg("");
    const out: Result[] = [];
    try {
      for (const f of files) {
        const bmp = await createImageBitmap(f);
        const scale = side > 0 ? Math.min(1, side / Math.max(bmp.width, bmp.height)) : 1;
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden.");
        ctx.imageSmoothingQuality = "high";
        if (fmtId === "jpg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, MIME[fmtId] ?? "image/jpeg", q));
        if (!blob) throw new Error(`${f.name} konnte nicht umgewandelt werden.`);
        out.push({
          name: `${f.name.replace(/\.[^.]+$/, "")}.${fmtId}`,
          url: URL.createObjectURL(blob),
          blob,
          before: f.size,
        });
      }
      setRes(out);
    } catch (e) {
      out.forEach((r) => URL.revokeObjectURL(r.url));
      setMsg(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    }
    setBusy(false);
  };

  return (
    <div className="stack">
      <Drop
        accept="image/*"
        multiple
        label="Bilder hierher ziehen"
        onFiles={(l) => setFiles([...files, ...l.filter((f) => f.type.startsWith("image/"))])}
      />
      {files.length > 0 && <Rows files={files} setFiles={setFiles} sortable={false} />}

      <SegmentedControl
        aria-label="Format"
        items={[
          { value: "jpg", label: "JPG" },
          { value: "png", label: "PNG" },
          { value: "webp", label: "WebP" },
        ]}
        value={fmtId}
        onValueChange={setFmtId}
      />
      {fmtId !== "png" && (
        <div>
          <div className="meter-head">
            <span>Qualität</span>
            <b>{Math.round(q * 100)} %</b>
          </div>
          <Slider aria-label="Qualität" value={qS} onValueChange={(v: number) => setQS(Math.round(v))} />
        </div>
      )}
      <div>
        <div className="meter-head">
          <span>Längste Seite</span>
          <b>{side === 0 ? "Original" : `${side} px`}</b>
        </div>
        <div className="chips-wrap" style={{ paddingTop: 0 }}>
          {[0, 3840, 1920, 1280, 800, 512].map((s) => (
            <button key={s} className={`tag${side === s ? " on" : ""}`} onClick={() => setSide(s)}>
              {s === 0 ? "Original" : s}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={() => void run()}>{busy ? "Arbeite …" : `${files.length || ""} Bild${files.length === 1 ? "" : "er"} umwandeln`.trim()}</Button>
      {msg && <div className="row-sub">{msg}</div>}

      {res.map((r) => (
        <div className="res" key={r.name + r.url}>
          <img src={r.url} alt="" />
          <div className="row-main">
            <div className="row-title" style={{ fontSize: 15 }}>
              {r.name}
            </div>
            <div className="row-sub">
              {kb(r.before)} → {kb(r.blob.size)}
            </div>
          </div>
          <Button icon={<DownloadSimple size={18} />} aria-label="Laden" onClick={() => saveUrl(r.url, r.name)} />
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   QR-Codes
   ========================================================= */

const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

export function QrTool() {
  const [kind, setKind] = useState("text");
  const [text, setText] = useState("https://");
  const [ssid, setSsid] = useState("");
  const [pass, setPass] = useState("");
  const [sec, setSec] = useState("WPA");
  const [sizeS, setSizeS] = useState(50);
  const [url, setUrl] = useState("");
  const size = 192 + Math.round((sizeS / 100) * 576);
  const payload = kind === "wifi" ? `WIFI:T:${sec};S:${esc(ssid)};P:${esc(pass)};;` : text;
  const ready = kind === "wifi" ? ssid.trim() !== "" : text.trim() !== "";

  useEffect(() => {
    let dead = false;
    if (!ready) {
      setUrl("");
      return;
    }
    toDataURL(payload, { width: size, margin: 2, errorCorrectionLevel: "M" })
      .then((u) => {
        if (!dead) setUrl(u);
      })
      .catch(() => {
        if (!dead) setUrl("");
      });
    return () => {
      dead = true;
    };
  }, [payload, size, ready]);

  return (
    <div className="stack">
      <SegmentedControl
        aria-label="Art"
        items={[
          { value: "text", label: "Text oder Link" },
          { value: "wifi", label: "WLAN" },
        ]}
        value={kind}
        onValueChange={setKind}
      />
      {kind === "text" ? (
        <Field label="Inhalt">
          <Input type="text" aria-label="Inhalt" value={text} onValueChange={setText} />
        </Field>
      ) : (
        <>
          <Field label="Netzwerkname">
            <Input type="text" aria-label="Netzwerkname" value={ssid} onValueChange={setSsid} />
          </Field>
          <Field label="Passwort">
            <Input type="text" aria-label="Passwort" value={pass} onValueChange={setPass} />
          </Field>
          <SegmentedControl
            aria-label="Verschlüsselung"
            items={[
              { value: "WPA", label: "WPA/WPA2" },
              { value: "nopass", label: "Offen" },
            ]}
            value={sec}
            onValueChange={setSec}
          />
        </>
      )}
      <div>
        <div className="meter-head">
          <span>Größe</span>
          <b>{size} px</b>
        </div>
        <Slider aria-label="Größe" value={sizeS} onValueChange={(v: number) => setSizeS(Math.round(v))} />
      </div>
      {url ? (
        <>
          <div className="qr-box">
            <img src={url} alt="QR-Code" />
          </div>
          <Button icon={<DownloadSimple size={18} weight="bold" />} onClick={() => saveUrl(url, "qr-code.png")}>
            Als PNG laden
          </Button>
        </>
      ) : (
        <div className="empty">Gib oben etwas ein</div>
      )}
    </div>
  );
}