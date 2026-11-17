import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "glisse";
import type { Icon } from "@phosphor-icons/react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Crosshair,
  MagnifyingGlass,
  MapPin,
  Sun,
} from "@phosphor-icons/react";
import { useStored } from "./lib";

type Place = { name: string; lat: number; lon: number };
type Day = { date: string; code: number; max: number; min: number; rain: number };
type Weather = { at: number; temp: number; feels: number; code: number; wind: number; hum: number; days: Day[] };
type GeoResult = { name: string; country?: string; admin1?: string; latitude: number; longitude: number };
type Raw = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    relative_humidity_2m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

function describe(code: number): { label: string; icon: Icon } {
  if (code === 0) return { label: "Klar", icon: Sun };
  if (code <= 2) return { label: "Heiter", icon: CloudSun };
  if (code === 3) return { label: "Bedeckt", icon: Cloud };
  if (code === 45 || code === 48) return { label: "Nebel", icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: "Nieselregen", icon: CloudRain };
  if (code >= 61 && code <= 67) return { label: "Regen", icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: "Schnee", icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: "Schauer", icon: CloudRain };
  if (code === 85 || code === 86) return { label: "Schneeschauer", icon: CloudSnow };
  if (code >= 95) return { label: "Gewitter", icon: CloudLightning };
  return { label: "Wolkig", icon: Cloud };
}

const sky = (code: number) =>
  code <= 1
    ? "linear-gradient(180deg, #4a9cf0, #1d62c4)"
    : code <= 3
      ? "linear-gradient(180deg, #7390b0, #46607e)"
      : code >= 95
        ? "linear-gradient(180deg, #4a4b6e, #22233c)"
        : code === 45 || code === 48
          ? "linear-gradient(180deg, #8a97a6, #5b6877)"
          : "linear-gradient(180deg, #586a80, #2f3b4c)";

const weekday = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("de-AT", { weekday: "short" }).replace(".", "");

export function WeatherWidget({ sz }: { sz: { w: number; h: number } }) {
  const [place, setPlace] = useStored<Place | null>("ios-wx-place", null);
  const [data, setData] = useStored<Weather | null>("ios-wx-data", null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);

  const load = useCallback(
    async (p: Place) => {
      setErr("");
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
          `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
          `&timezone=auto&forecast_days=5`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const raw = (await res.json()) as Raw;
        const times = raw.daily?.time ?? [];
        setData({
          at: Date.now(),
          temp: raw.current?.temperature_2m ?? 0,
          feels: raw.current?.apparent_temperature ?? 0,
          code: raw.current?.weather_code ?? 0,
          wind: raw.current?.wind_speed_10m ?? 0,
          hum: raw.current?.relative_humidity_2m ?? 0,
          days: times.map((date, i) => ({
            date,
            code: raw.daily?.weather_code?.[i] ?? 0,
            max: raw.daily?.temperature_2m_max?.[i] ?? 0,
            min: raw.daily?.temperature_2m_min?.[i] ?? 0,
            rain: raw.daily?.precipitation_probability_max?.[i] ?? 0,
          })),
        });
      } catch {
        setErr("Wetter konnte nicht geladen werden.");
      }
    },
    [setData],
  );

  useEffect(() => {
    if (place && (!data || Date.now() - data.at > 15 * 60 * 1000)) void load(place);
  }, [place, data, load]);

  const pick = (p: Place) => {
    setPlace(p);
    setData(null);
    setEdit(false);
    setResults([]);
    setQ("");
  };

  const search = async () => {
    const name = q.trim();
    if (!name) return;
    setErr("");
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=de&format=json`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { results?: GeoResult[] };
      setResults(j.results ?? []);
      if (!j.results || j.results.length === 0) setErr("Ort nicht gefunden.");
    } catch {
      setErr("Suche fehlgeschlagen.");
    }
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setErr("Standort wird nicht unterstützt.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => pick({ name: "Mein Standort", lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setErr("Standort wurde nicht freigegeben."),
    );
  };

  if (!place || edit) {
    return (
      <div className="w">
        <div className="wh">
          <span className="wh-ic" style={{ background: "#0a84ff" }}>
            <CloudSun size={14} weight="fill" />
          </span>
          <b style={{ color: "#0a84ff" }}>Wetter</b>
        </div>
        <div
          className="quick"
          style={{ marginTop: 12 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
        >
          <div className="grow">
            <Input
              type="search"
              aria-label="Ort suchen"
              placeholder="Stadt suchen …"
              icon={<MagnifyingGlass size={18} weight="bold" />}
              value={q}
              onValueChange={setQ}
            />
          </div>
          <Button icon={<Crosshair size={18} weight="bold" />} aria-label="Mein Standort" onClick={locate} />
        </div>
        {err && <div className="wmuted">{err}</div>}
        <div className="geo-list">
          {results.map((r) => (
            <button
              key={`${r.latitude},${r.longitude}`}
              className="geo-item"
              onClick={() => pick({ name: r.name, lat: r.latitude, lon: r.longitude })}
            >
              {r.name}
              <small>{[r.admin1, r.country].filter(Boolean).join(", ")}</small>
            </button>
          ))}
        </div>
        {place && (
          <button className="link" onClick={() => setEdit(false)}>
            Abbrechen
          </button>
        )}
      </div>
    );
  }

  const cur = data ? describe(data.code) : null;
  const today = data?.days[0];
  const wide = sz.w >= 2;
  const tall = sz.h >= 2;

  return (
    <div className={`w wx${wide && !tall ? " row" : ""}`} style={{ background: sky(data?.code ?? 0) }}>
      <div className="wx-left">
        <button className="wx-place" onClick={() => setEdit(true)} aria-label="Ort ändern">
          <MapPin size={14} weight="fill" />
          {place.name}
        </button>
        {data && cur ? (
          <>
            <div className="wx-temp">{Math.round(data.temp)}°</div>
            <div className="wx-cond">
              <cur.icon size={18} weight="fill" />
              {cur.label}
            </div>
            {today && (
              <div className="wx-hl">
                H:{Math.round(today.max)}° T:{Math.round(today.min)}°
              </div>
            )}
          </>
        ) : (
          <div className="wx-cond">{err || "Lade …"}</div>
        )}
      </div>

      {data && (wide || tall) && (
        <div className={`wx-days ${tall ? "col" : "row"}`}>
          {data.days.slice(0, tall ? 5 : 4).map((d) => {
            const info = describe(d.code);
            return tall ? (
              <div className="wx-day-r" key={d.date}>
                <span>{weekday(d.date)}</span>
                <info.icon size={20} weight="fill" />
                <em>{Math.round(d.min)}°</em>
                <b>{Math.round(d.max)}°</b>
              </div>
            ) : (
              <div className="wx-day" key={d.date}>
                <span>{weekday(d.date)}</span>
                <info.icon size={22} weight="fill" />
                <b>{Math.round(d.max)}°</b>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}