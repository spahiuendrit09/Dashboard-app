import { useCallback, useEffect, useRef, useState } from "react";
import { useStored } from "./lib";

export type Track = { id: string; file: File; title: string; artist: string; album: string };
export type Repeat = "off" | "all" | "one";
type Tags = { title?: string; artist?: string; album?: string; cover?: Blob };

/* File System Access API: eigene Typen, damit es in jeder TypeScript-Version kompiliert */
interface FsFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}
interface FsDirHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<FsFileHandle | FsDirHandle>;
  queryPermission?(d: { mode: "read" }): Promise<string>;
  requestPermission?(d: { mode: "read" }): Promise<string>;
}
type PickerWindow = { showDirectoryPicker?: (o?: { mode?: "read" }) => Promise<FsDirHandle> };

const COLLATOR = new Intl.Collator("de", { numeric: true });
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm)$/i;

/* ---------- IndexedDB: merkt sich den Musikordner ---------- */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("ios-dashboard", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvGet<T>(key: string): Promise<T | undefined> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const r = d.transaction("kv").objectStore("kv").get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}
async function kvSet(key: string, value: unknown): Promise<void> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const r = d.transaction("kv", "readwrite").objectStore("kv").put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
async function kvDel(key: string): Promise<void> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const r = d.transaction("kv", "readwrite").objectStore("kv").delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

/* ---------- Ordner einlesen ---------- */
async function scan(dir: FsDirHandle, depth = 0, out: File[] = []): Promise<File[]> {
  for await (const e of dir.values()) {
    if (out.length >= 4000) break;
    if (e.kind === "file") {
      if (AUDIO.test(e.name)) out.push(await e.getFile());
    } else if (depth < 6) {
      await scan(e, depth + 1, out);
    }
  }
  return out;
}

/* ---------- ID3-Tags (MP3) ---------- */
const syncsafe = (b: Uint8Array, o: number) =>
  ((b[o] ?? 0) << 21) | ((b[o + 1] ?? 0) << 14) | ((b[o + 2] ?? 0) << 7) | (b[o + 3] ?? 0);
const be32 = (b: Uint8Array, o: number) =>
  (b[o] ?? 0) * 16777216 + ((b[o + 1] ?? 0) << 16) + ((b[o + 2] ?? 0) << 8) + (b[o + 3] ?? 0);

function decodeText(b: Uint8Array): string {
  const enc = b[0] ?? 0;
  const body = b.subarray(1);
  let label = "iso-8859-1";
  if (enc === 1) label = body[0] === 0xfe && body[1] === 0xff ? "utf-16be" : "utf-16le";
  else if (enc === 2) label = "utf-16be";
  else if (enc === 3) label = "utf-8";
  try {
    return (new TextDecoder(label).decode(body).split("\0")[0] ?? "").trim();
  } catch {
    return "";
  }
}

function parseApic(b: Uint8Array): Blob | null {
  const enc = b[0] ?? 0;
  let i = 1;
  let mime = "";
  while (i < b.length && b[i] !== 0) {
    mime += String.fromCharCode(b[i] ?? 0);
    i++;
  }
  i += 2; /* Nullbyte und Bildtyp */
  if (enc === 1 || enc === 2) {
    while (i + 1 < b.length && !(b[i] === 0 && b[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < b.length && b[i] !== 0) i++;
    i += 1;
  }
  if (i >= b.length) return null;
  const type = mime.includes("/") ? mime : mime.toLowerCase().includes("png") ? "image/png" : "image/jpeg";
  return new Blob([b.slice(i) as BlobPart], { type });
}

async function readTags(file: File, wantCover: boolean): Promise<Tags> {
  const out: Tags = {};
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return out;
    const ver = head[3] ?? 3;
    const size = syncsafe(head, 6);
    const buf = new Uint8Array(await file.slice(10, 10 + Math.min(size, wantCover ? 6000000 : 131072)).arrayBuffer());
    const hl = ver === 2 ? 6 : 10;
    let p = 0;
    while (p + hl < buf.length) {
      const id = String.fromCharCode(...buf.subarray(p, p + (ver === 2 ? 3 : 4)));
      if (!/^[A-Z0-9]+$/.test(id)) break;
      const len =
        ver === 2
          ? ((buf[p + 3] ?? 0) << 16) | ((buf[p + 4] ?? 0) << 8) | (buf[p + 5] ?? 0)
          : ver === 4
            ? syncsafe(buf, p + 4)
            : be32(buf, p + 4);
      const start = p + hl;
      if (len <= 0 || start + len > buf.length) break;
      const body = buf.subarray(start, start + len);
      if (id === "TIT2" || id === "TT2") out.title = decodeText(body);
      else if (id === "TPE1" || id === "TP1") out.artist = decodeText(body);
      else if (id === "TALB" || id === "TAL") out.album = decodeText(body);
      else if (id === "APIC" && wantCover && ver >= 3) {
        const c = parseApic(body);
        if (c) out.cover = c;
      }
      p = start + len;
    }
  } catch {
    /* defekter Tag, der Dateiname reicht */
  }
  return out;
}

function toTrack(file: File): Track {
  const base = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/_/g, " ")
    .replace(/^\d{1,3}[\s.\-_]+(?=\D)/, "")
    .trim();
  const [a, ...rest] = base.split(" - ");
  const hasArtist = rest.length > 0;
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    file,
    title: hasArtist ? rest.join(" - ") : base,
    artist: hasArtist ? (a ?? "") : "",
    album: "",
  };
}

function rebuild(on: boolean, count: number, cur: number | undefined) {
  const ids = Array.from({ length: count }, (_, i) => i);
  if (!on) return { order: ids, pos: cur ?? -1 };
  const rest = ids.filter((i) => i !== cur);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = rest[i] ?? 0;
    rest[i] = rest[j] ?? 0;
    rest[j] = a;
  }
  return cur === undefined ? { order: rest, pos: -1 } : { order: [cur, ...rest], pos: 0 };
}

/* =========================================================
   Der Player
   ========================================================= */

export function useMusic(notify: (title: string, body: string) => void) {
  const [el] = useState(() => new Audio());
  const [tracks, setTracks] = useState<Track[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cover, setCover] = useState("");
  const [dirName, setDirName] = useState("");
  const [status, setStatus] = useState("");
  const [needsAccess, setNeedsAccess] = useState(false);
  const [volume, setVolume] = useStored("ios-music-vol", 80);
  const [shuffle, setShuffleStored] = useStored("ios-music-shuffle", false);
  const [repeat, setRepeat] = useStored<Repeat>("ios-music-repeat", "off");

  const dirRef = useRef<FsDirHandle | null>(null);
  const urlRef = useRef("");
  const coverRef = useRef("");
  const genRef = useRef(0);
  const shuffleRef = useRef(shuffle);
  const notifyRef = useRef(notify);
  const endedRef = useRef<() => void>(() => {});

  useEffect(() => {
    shuffleRef.current = shuffle;
    notifyRef.current = notify;
  });

  const ti = pos >= 0 ? order[pos] : undefined;
  const current = ti === undefined ? null : (tracks[ti] ?? null);
  const currentFile = current?.file ?? null;
  const supportsFolder = typeof (window as unknown as PickerWindow).showDirectoryPicker === "function";

  /* Audio-Ereignisse */
  useEffect(() => {
    /* Nur einmal pro Sekunde, sonst wird die ganze App ständig neu gezeichnet */
    const onTime = () => {
      const t = Math.floor(el.currentTime);
      setTime((p) => (p === t ? p : t));
    };
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => endedRef.current();
    const onError = () => {
      setPlaying(false);
      notifyRef.current("Musik", "Diese Datei kann der Browser nicht abspielen.");
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
  }, [el]);

  useEffect(() => {
    el.volume = Math.min(Math.max(volume / 100, 0), 1);
  }, [el, volume]);

  const loadTrack = useCallback(
    (t: Track | null, autoplay: boolean) => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
      setTime(0);
      setDuration(0);
      if (!t) {
        el.removeAttribute("src");
        el.load();
        return;
      }
      urlRef.current = URL.createObjectURL(t.file);
      el.src = urlRef.current;
      if (autoplay) void el.play().catch(() => setPlaying(false));
    },
    [el],
  );

  /* Cover des aktuellen Titels */
  useEffect(() => {
    let dead = false;
    if (coverRef.current) URL.revokeObjectURL(coverRef.current);
    coverRef.current = "";
    setCover("");
    if (!currentFile) return;
    void readTags(currentFile, true).then((t) => {
      if (dead || !t.cover) return;
      coverRef.current = URL.createObjectURL(t.cover);
      setCover(coverRef.current);
    });
    return () => {
      dead = true;
    };
  }, [currentFile]);

  /* Bibliothek setzen und Tags im Hintergrund lesen */
  const setLibrary = useCallback(
    (files: File[], name: string) => {
      const gen = ++genRef.current;
      loadTrack(null, false);
      setPlaying(false);
      const list = files
        .map(toTrack)
        .sort((a, b) => COLLATOR.compare(a.file.name, b.file.name));
      const r = rebuild(shuffleRef.current, list.length, undefined);
      setTracks(list);
      setOrder(r.order);
      setPos(-1);
      setDirName(name);

      const found = new Map<string, Tags>();
      const flush = () =>
        setTracks((prev) =>
          prev.map((t) => {
            const u = found.get(t.id);
            return u
              ? { ...t, title: u.title || t.title, artist: u.artist || t.artist, album: u.album || t.album }
              : t;
          }),
        );
      void (async () => {
        let n = 0;
        let lastFlush = performance.now();
        for (const t of list) {
          if (gen !== genRef.current) return;
          const tg = await readTags(t.file, false);
          if (gen !== genRef.current) return;
          if (tg.title || tg.artist || tg.album) found.set(t.id, tg);
          n++;
          if (n % 20 === 0) {
            /* Dem Browser Luft lassen, damit nichts ruckelt */
            await new Promise<void>((r) => setTimeout(r, 0));
            if (performance.now() - lastFlush > 1500) {
              flush();
              lastFlush = performance.now();
            }
          }
        }
        flush();
      })();
    },
    [loadTrack],
  );

  /* Gespeicherten Ordner beim Start wieder öffnen */
  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const dir = await kvGet<FsDirHandle>("music-dir");
        if (!dir || dead) return;
        dirRef.current = dir;
        setDirName(dir.name);
        const perm = dir.queryPermission ? await dir.queryPermission({ mode: "read" }) : "prompt";
        if (perm === "granted") {
          const files = await scan(dir);
          if (!dead) setLibrary(files, dir.name);
        } else setNeedsAccess(true);
      } catch {
        /* kein Ordner gespeichert */
      }
    })();
    return () => {
      dead = true;
    };
  }, [setLibrary]);

  const pickFolder = useCallback(async () => {
    const w = window as unknown as PickerWindow;
    if (!w.showDirectoryPicker) return;
    try {
      const dir = await w.showDirectoryPicker({ mode: "read" });
      setStatus("Lese Ordner …");
      const files = await scan(dir);
      dirRef.current = dir;
      void kvSet("music-dir", dir).catch(() => {});
      setNeedsAccess(false);
      setLibrary(files, dir.name);
      setStatus(files.length > 0 ? "" : "Keine Musikdateien gefunden.");
    } catch (e) {
      setStatus(e instanceof Error && e.name === "AbortError" ? "" : "Ordner konnte nicht gelesen werden.");
    }
  }, [setLibrary]);

  const reconnect = useCallback(async () => {
    const dir = dirRef.current;
    if (!dir) return;
    try {
      const perm = dir.requestPermission ? await dir.requestPermission({ mode: "read" }) : "granted";
      if (perm !== "granted") {
        setStatus("Zugriff wurde nicht erlaubt.");
        return;
      }
      setStatus("Lese Ordner …");
      const files = await scan(dir);
      setNeedsAccess(false);
      setLibrary(files, dir.name);
      setStatus(files.length > 0 ? "" : "Keine Musikdateien gefunden.");
    } catch {
      setStatus("Ordner nicht mehr erreichbar.");
    }
  }, [setLibrary]);

  const addFiles = useCallback(
    (list: File[]) => {
      const files = list.filter((f) => f.type.startsWith("audio/") || AUDIO.test(f.name));
      if (files.length === 0) {
        setStatus("Keine Musikdateien gefunden.");
        return;
      }
      const rel = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
      dirRef.current = null;
      setNeedsAccess(false);
      setLibrary(files, rel ? (rel.split("/")[0] ?? "Ordner") : "Ausgewählte Dateien");
      setStatus("");
    },
    [setLibrary],
  );

  const forget = useCallback(() => {
    void kvDel("music-dir").catch(() => {});
    dirRef.current = null;
    setNeedsAccess(false);
    setLibrary([], "");
    setStatus("");
  }, [setLibrary]);

  /* Steuerung */
  const go = useCallback(
    (p: number) => {
      const i = order[p];
      const t = i === undefined ? null : (tracks[i] ?? null);
      setPos(p);
      loadTrack(t, true);
    },
    [order, tracks, loadTrack],
  );

  const next = useCallback(
    (auto = false) => {
      if (order.length === 0) return;
      if (auto && repeat === "one") {
        el.currentTime = 0;
        void el.play().catch(() => {});
        return;
      }
      let p = pos + 1;
      if (p >= order.length) {
        if (repeat === "all" || !auto) p = 0;
        else {
          el.pause();
          el.currentTime = 0;
          setTime(0);
          return;
        }
      }
      go(p);
    },
    [order.length, repeat, pos, el, go],
  );

  const prev = useCallback(() => {
    if (order.length === 0) return;
    if (el.currentTime > 3 || pos < 0) {
      el.currentTime = 0;
      return;
    }
    go(pos > 0 ? pos - 1 : order.length - 1);
  }, [order.length, pos, el, go]);

  useEffect(() => {
    endedRef.current = () => next(true);
  });

  const toggle = useCallback(() => {
    if (!current) {
      if (order.length > 0) go(0);
      return;
    }
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }, [current, order.length, el, go]);

  const play = useCallback(
    (trackIndex: number) => {
      const p = order.indexOf(trackIndex);
      if (p >= 0) go(p);
    },
    [order, go],
  );

  const seek = useCallback(
    (s: number) => {
      if (!Number.isFinite(s)) return;
      el.currentTime = Math.max(0, s);
      setTime(Math.floor(el.currentTime));
    },
    [el],
  );

  const toggleShuffle = () => {
    const on = !shuffle;
    setShuffleStored(on);
    const r = rebuild(on, tracks.length, ti);
    setOrder(r.order);
    setPos(r.pos);
  };
  const cycleRepeat = () => setRepeat(repeat === "off" ? "all" : repeat === "all" ? "one" : "off");

  /* Sperrbildschirm und Mediensteuerung des Handys */
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!current) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album,
      artwork: cover ? [{ src: cover, sizes: "512x512" }] : [],
    });
  }, [current, cover]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* nicht unterstützt */
      }
    };
    set("play", () => void el.play().catch(() => {}));
    set("pause", () => el.pause());
    set("nexttrack", () => next());
    set("previoustrack", () => prev());
    set("seekto", (d) => {
      if (d.seekTime !== undefined) seek(d.seekTime);
    });
    return () => {
      set("play", null);
      set("pause", null);
      set("nexttrack", null);
      set("previoustrack", null);
      set("seekto", null);
    };
  }, [el, next, prev, seek]);

  return {
    tracks,
    current,
    currentIndex: ti ?? -1,
    playing,
    time,
    duration,
    cover,
    dirName,
    status,
    needsAccess,
    volume,
    shuffle,
    repeat,
    supportsFolder,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    pickFolder,
    reconnect,
    addFiles,
    forget,
    play,
    toggle,
    next,
    prev,
    seek,
  };
}

export type MusicApi = ReturnType<typeof useMusic>;