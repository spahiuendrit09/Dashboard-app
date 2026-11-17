import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Button, Input, Menu, SegmentedControl } from "glisse";
import { Plus, Trash } from "@phosphor-icons/react";
import { dayKey, fmt, money, num, useStored } from "./lib";
import type { Push } from "./notifications";
import { Card, Facts, Field, Spark } from "./ui";

type MenuItems = ComponentProps<typeof Menu>["items"];

export type Quote = {
  price: number;
  change: number;
  pct: number;
  high?: number;
  low?: number;
  prev?: number;
  at: number;
};
export type Position = { id: number; kind: "stock" | "crypto"; symbol: string; shares: number; buy: number };
type Rates = { at: number; r: Record<string, number> };

export const COINS: Record<string, { sym: string; name: string }> = {
  bitcoin: { sym: "BTC", name: "Bitcoin" },
  ethereum: { sym: "ETH", name: "Ethereum" },
  solana: { sym: "SOL", name: "Solana" },
  ripple: { sym: "XRP", name: "XRP" },
  dogecoin: { sym: "DOGE", name: "Dogecoin" },
  cardano: { sym: "ADA", name: "Cardano" },
  litecoin: { sym: "LTC", name: "Litecoin" },
  binancecoin: { sym: "BNB", name: "BNB" },
};

const RATE_URLS = [
  "https://api.frankfurter.dev/v1/latest?base=EUR",
  "https://api.frankfurter.app/latest?from=EUR",
];

const sign = (n: number) => (n >= 0 ? "+" : "");

/* =========================================================
   Daten-Hook: Kurse, Watchlist, Portfolio, Wechselkurse
   ========================================================= */

export function useMarket(active: boolean, push: (p: Omit<Push, "id">) => void) {
  const [key, setKey] = useStored("ios-finnhub", "");
  const [stocks, setStocks] = useStored<string[]>("ios-stocks", ["AAPL", "MSFT", "NVDA", "TSLA"]);
  const [coins, setCoins] = useStored<string[]>("ios-coins", ["bitcoin", "ethereum"]);
  const [positions, setPositions] = useStored<Position[]>("ios-positions", []);
  const [quotes, setQuotes] = useStored<Record<string, Quote>>("ios-quotes", {});
  const [hist, setHist] = useStored<Record<string, number[]>>("ios-hist", {});
  const [rates, setRates] = useStored<Rates>("ios-rates", { at: 0, r: {} });
  const [alerted, setAlerted] = useStored<string[]>("ios-alerted", []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshRates = useCallback(async () => {
    for (const url of RATE_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const j = await res.json();
        if (j && j.rates) {
          setRates({ at: Date.now(), r: { EUR: 1, ...j.rates } });
          return true;
        }
      } catch {
        /* nächste URL probieren */
      }
    }
    return false;
  }, [setRates]);

  const refresh = async () => {
    setLoading(true);
    const next: Record<string, Quote> = {};
    const errs: string[] = [];

    const wantStocks = new Set([...stocks, ...positions.filter((p) => p.kind === "stock").map((p) => p.symbol)]);
    const wantCoins = new Set([...coins, ...positions.filter((p) => p.kind === "crypto").map((p) => p.symbol)]);

    if (wantCoins.size > 0) {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${[...wantCoins].join(",")}&vs_currencies=eur&include_24hr_change=true`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        for (const id of wantCoins) {
          const d = j[id];
          if (d && typeof d.eur === "number") {
            const pct = typeof d.eur_24h_change === "number" ? d.eur_24h_change : 0;
            next["c:" + id] = { price: d.eur, pct, change: d.eur - d.eur / (1 + pct / 100), at: Date.now() };
          }
        }
      } catch {
        errs.push("Krypto");
      }
    }

    if (key && wantStocks.size > 0) {
      await Promise.all(
        [...wantStocks].map(async (s) => {
          try {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s)}&token=${encodeURIComponent(key)}`,
            );
            if (!res.ok) throw new Error(String(res.status));
            const j = await res.json();
            if (j && typeof j.c === "number" && j.c > 0) {
              next[s] = { price: j.c, change: j.d ?? 0, pct: j.dp ?? 0, high: j.h, low: j.l, prev: j.pc, at: Date.now() };
            } else errs.push(s);
          } catch {
            errs.push(s);
          }
        }),
      );
    }

    if (Date.now() - rates.at > 6 * 3600 * 1000) await refreshRates();

    setQuotes((q) => ({ ...q, ...next }));
    setHist((h) => {
      const out = { ...h };
      for (const [k, q] of Object.entries(next)) {
        const arr = out[k] ?? [];
        if (arr[arr.length - 1] !== q.price) out[k] = [...arr, q.price].slice(-48);
      }
      return out;
    });

    /* Meldung bei starken Tagesbewegungen (einmal pro Tag und Wert) */
    const today = dayKey();
    const fresh = alerted.filter((a) => a.startsWith(today));
    const added: string[] = [];
    for (const [k, q] of Object.entries(next)) {
      const id = `${today}:${k}`;
      if (Math.abs(q.pct) >= 5 && !fresh.includes(id)) {
        const name = k.startsWith("c:") ? (COINS[k.slice(2)]?.name ?? k.slice(2)) : k;
        push({
          kind: "system",
          title: `${name} ${q.pct > 0 ? "steigt" : "fällt"} stark`,
          body: `${q.pct > 0 ? "+" : ""}${fmt(q.pct, 1)} % im Tagesverlauf`,
          tab: "market",
        });
        added.push(id);
      }
    }
    if (added.length > 0) setAlerted([...fresh, ...added]);

    setError(errs.length > 0 ? `Kein Kurs für: ${[...new Set(errs)].join(", ")}` : "");
    setLoading(false);
  };

  const ref = useRef(refresh);
  ref.current = refresh;

  useEffect(() => {
    if (active) ref.current();
  }, [active, stocks, coins, key, positions]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (!document.hidden) ref.current();
    }, 60000);
    return () => window.clearInterval(id);
  }, [active]);

  const usd = rates.r["USD"] ?? 0;
  const eurPerUsd = usd > 0 ? 1 / usd : 0;
  const updatedAt = Object.values(quotes).reduce((t, q) => Math.max(t, q.at), 0);

  return {
    key,
    setKey,
    stocks,
    setStocks,
    coins,
    setCoins,
    positions,
    setPositions,
    quotes,
    hist,
    rates,
    refreshRates,
    eurPerUsd,
    updatedAt,
    loading,
    error,
    refresh,
  };
}

export type MarketState = ReturnType<typeof useMarket>;

/* =========================================================
   Bausteine
   ========================================================= */

function QuoteRow({
  title,
  sub,
  q,
  cur,
  data,
  menu,
}: {
  title: string;
  sub: string;
  q?: Quote;
  cur: string;
  data: number[];
  menu?: MenuItems;
}) {
  const up = (q?.pct ?? 0) >= 0;
  return (
    <div className="row quote">
      <div className="row-main">
        <div className="row-title">{title}</div>
        <div className="row-sub">{sub}</div>
      </div>
      <Spark data={data} up={up} />
      <div className="quote-r">
        <div className="quote-p">{q ? money(q.price, cur) : "–"}</div>
        {q && (
          <span className={`pill ${up ? "up" : "down"}`}>
            {sign(q.pct)}
            {fmt(q.pct, 2)} %
          </span>
        )}
      </div>
      {menu && <Menu aria-label="Optionen" items={menu} />}
    </div>
  );
}

function KeyPrompt({ m }: { m: MarketState }) {
  const [v, setV] = useState("");
  return (
    <div className="keybox">
      <p className="tip">
        Für Aktienkurse brauchst du einen kostenlosen API-Key von <b>finnhub.io</b> (Registrierung, dann Key kopieren).
        Der Key bleibt nur auf diesem Gerät. Die Gratis-Version liefert US-Aktien wie AAPL, MSFT oder TSLA.
      </p>
      <div
        className="quick"
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) m.setKey(v.trim());
        }}
      >
        <div className="grow">
          <Input type="text" aria-label="Finnhub API-Key" placeholder="API-Key einfügen" value={v} onValueChange={setV} />
        </div>
        <Button onClick={() => v.trim() && m.setKey(v.trim())}>Speichern</Button>
      </div>
    </div>
  );
}

/** Kompakte Übersicht für das Dashboard. */
export function MarketGlance({ m }: { m: MarketState }) {
  const items = [
    ...m.stocks.slice(0, 3).map((s) => ({ k: s, title: s, cur: "USD" })),
    ...m.coins.slice(0, 3).map((c) => ({ k: "c:" + c, title: COINS[c]?.sym ?? c, cur: "EUR" })),
  ];

  const rows = items.flatMap((x) => {
    const q = m.quotes[x.k];
    return q ? [{ ...x, q }] : [];
  });

  if (rows.length === 0) return <div className="empty">Öffne den Geld-Tab, um Kurse zu laden</div>;

  return (
    <div>
      {rows.slice(0, 5).map(({ k, title, cur, q }) => {
        const up = q.pct >= 0;
        return (
          <div className="row quote" key={k}>
            <div className="row-main">
              <div className="row-title">{title}</div>
            </div>
            <Spark data={m.hist[k] ?? []} up={up} />
            <div className="quote-r">
              <div className="quote-p">{money(q.price, cur)}</div>
              <span className={`pill ${up ? "up" : "down"}`}>
                {sign(q.pct)}
                {fmt(q.pct, 2)} %
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   Watchlist
   ========================================================= */

export function Watchlist({ m }: { m: MarketState }) {
  const [sym, setSym] = useState("");

  const addStock = () => {
    const s = sym.trim().toUpperCase();
    if (!s || m.stocks.includes(s)) return;
    m.setStocks([...m.stocks, s]);
    setSym("");
  };
  const addCoin = (id: string) => {
    if (!m.coins.includes(id)) m.setCoins([...m.coins, id]);
  };

  const stockMenu = (s: string): MenuItems => [
    { label: "Entfernen", icon: <Trash size={18} />, destructive: true, onSelect: () => m.setStocks(m.stocks.filter((x) => x !== s)) },
  ];
  const coinMenu = (id: string): MenuItems => [
    { label: "Entfernen", icon: <Trash size={18} />, destructive: true, onSelect: () => m.setCoins(m.coins.filter((x) => x !== id)) },
  ];

  return (
    <div className="cols stagger">
      <div className="col">
        <Card title="Aktien">
          {!m.key ? (
            <KeyPrompt m={m} />
          ) : (
            <>
              <div
                className="quick"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addStock();
                }}
              >
                <div className="grow">
                  <Input type="text" aria-label="Symbol" placeholder="Symbol, z. B. AMZN" value={sym} onValueChange={setSym} />
                </div>
                <Button icon={<Plus size={20} weight="bold" />} aria-label="Hinzufügen" onClick={addStock} />
              </div>
              {m.stocks.length === 0 && <div className="empty">Noch keine Aktien</div>}
              {m.stocks.map((s) => {
                const q = m.quotes[s];
                return (
                  <QuoteRow
                    key={s}
                    title={s}
                    sub={q?.low && q?.high ? `Tag ${fmt(q.low)} – ${fmt(q.high)}` : "US-Aktie"}
                    q={q}
                    cur="USD"
                    data={m.hist[s] ?? []}
                    menu={stockMenu(s)}
                  />
                );
              })}
            </>
          )}
        </Card>
      </div>

      <div className="col">
        <Card title="Krypto">
          {m.coins.length === 0 && <div className="empty">Noch keine Coins</div>}
          {m.coins.map((id) => (
            <QuoteRow
              key={id}
              title={COINS[id]?.name ?? id}
              sub={`${COINS[id]?.sym ?? id} · 24 h`}
              q={m.quotes["c:" + id]}
              cur="EUR"
              data={m.hist["c:" + id] ?? []}
              menu={coinMenu(id)}
            />
          ))}
          {Object.keys(COINS).some((id) => !m.coins.includes(id)) && (
            <div className="chips-wrap">
              {Object.entries(COINS)
                .filter(([id]) => !m.coins.includes(id))
                .map(([id, c]) => (
                  <button key={id} className="tag" onClick={() => addCoin(id)}>
                    + {c.sym}
                  </button>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* =========================================================
   Portfolio
   ========================================================= */

export function Portfolio({ m }: { m: MarketState }) {
  const [kind, setKind] = useState("stock");
  const [pSym, setPSym] = useState("");
  const [pCoin, setPCoin] = useState("bitcoin");
  const [shares, setShares] = useState("");
  const [buy, setBuy] = useState("");

  const addPosition = () => {
    const symbol = kind === "stock" ? pSym.trim().toUpperCase() : pCoin;
    const sh = num(shares);
    const b = num(buy);
    if (!symbol || !(sh > 0) || !(b >= 0)) return;
    m.setPositions([...m.positions, { id: Date.now(), kind: kind === "stock" ? "stock" : "crypto", symbol, shares: sh, buy: b }]);
    setPSym("");
    setShares("");
    setBuy("");
  };

  const toEur = (k: "stock" | "crypto", v: number) => (k === "stock" ? (m.eurPerUsd ? v * m.eurPerUsd : NaN) : v);

  const rows = m.positions.map((p) => {
    const q = m.quotes[p.kind === "stock" ? p.symbol : "c:" + p.symbol];
    const value = q ? toEur(p.kind, q.price * p.shares) : NaN;
    const cost = toEur(p.kind, p.buy * p.shares);
    return { p, q, value, cost, pl: value - cost };
  });
  const valid = rows.filter((r) => Number.isFinite(r.value) && Number.isFinite(r.cost));
  const totalValue = valid.reduce((s, r) => s + r.value, 0);
  const totalCost = valid.reduce((s, r) => s + r.cost, 0);
  const totalPl = totalValue - totalCost;
  const totalPct = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;

  return (
    <div className="split stagger">
      <div className="col">
        <Card title="Positionen">
          {rows.length === 0 && <div className="empty">Füge unten deine erste Position hinzu</div>}
          {rows.map(({ p, q, pl, cost }) => {
            const cur = p.kind === "stock" ? "USD" : "EUR";
            const plPct = cost > 0 && Number.isFinite(pl) ? (pl / cost) * 100 : NaN;
            const up = !Number.isFinite(pl) || pl >= 0;
            return (
              <div className="row quote" key={p.id}>
                <div className="row-main">
                  <div className="row-title">{p.kind === "stock" ? p.symbol : (COINS[p.symbol]?.name ?? p.symbol)}</div>
                  <div className="row-sub">
                    {fmt(p.shares, 6)} Stk. · Kauf {money(p.buy, cur)}
                  </div>
                </div>
                <div className="quote-r">
                  <div className="quote-p">{q ? money(q.price, cur) : "–"}</div>
                  {Number.isFinite(pl) ? (
                    <span className={`pill ${up ? "up" : "down"}`}>
                      {sign(pl)}
                      {money(pl)} ({sign(plPct)}
                      {fmt(plPct, 1)} %)
                    </span>
                  ) : (
                    <span className="row-sub">kein Kurs</span>
                  )}
                </div>
                <Menu
                  aria-label="Optionen"
                  items={[
                    {
                      label: "Löschen",
                      icon: <Trash size={18} />,
                      destructive: true,
                      onSelect: () => m.setPositions(m.positions.filter((x) => x.id !== p.id)),
                    },
                  ]}
                />
              </div>
            );
          })}
        </Card>

        <Card title="Position hinzufügen" className="mt">
          <div className="stack">
            <SegmentedControl
              aria-label="Art"
              items={[
                { value: "stock", label: "Aktie" },
                { value: "crypto", label: "Krypto" },
              ]}
              value={kind}
              onValueChange={setKind}
            />
            {kind === "stock" ? (
              <Field label="Symbol">
                <Input type="text" aria-label="Symbol" placeholder="z. B. AAPL" value={pSym} onValueChange={setPSym} />
              </Field>
            ) : (
              <Field label="Coin">
                <select className="sel" value={pCoin} onChange={(e) => setPCoin(e.target.value)} aria-label="Coin">
                  {Object.entries(COINS).map(([id, c]) => (
                    <option key={id} value={id}>
                      {c.name} ({c.sym})
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="two">
              <Field label="Anzahl">
                <Input type="text" aria-label="Anzahl" placeholder="z. B. 2,5" value={shares} onValueChange={setShares} />
              </Field>
              <Field label={`Kaufkurs (${kind === "stock" ? "USD" : "EUR"})`}>
                <Input type="text" aria-label="Kaufkurs" placeholder="pro Stück" value={buy} onValueChange={setBuy} />
              </Field>
            </div>
            <Button icon={<Plus size={18} weight="bold" />} onClick={addPosition}>
              Hinzufügen
            </Button>
          </div>
        </Card>
      </div>

      <aside className="split-side">
        <Card title="Gesamt (in EUR)">
          <div className="big">{money(totalValue)}</div>
          <div className={`pill ${totalPl >= 0 ? "up" : "down"} inline`}>
            {sign(totalPl)}
            {money(totalPl)} ({sign(totalPct)}
            {fmt(totalPct, 1)} %)
          </div>
          <Facts
            rows={[
              ["Eingesetzt", money(totalCost)],
              ["Positionen", String(m.positions.length)],
              ["USD → EUR", m.eurPerUsd ? fmt(m.eurPerUsd, 4) : "–"],
            ]}
          />
          <p className="tip small">
            Aktien werden mit dem aktuellen Dollarkurs in Euro umgerechnet. Alle Angaben ohne Gewähr und keine
            Anlageberatung.
          </p>
        </Card>
      </aside>
    </div>
  );
}