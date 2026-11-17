import { Suspense, lazy, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "glisse";
import {
  Cake,
  Calculator,
  CalendarDots,
  CaretLeft,
  Cards,
  Code,
  CreditCard,
  FilePdf,
  Heartbeat,
  Hourglass,
  ImageSquare,
  QrCode,
  Receipt,
  TextAa,
  Toolbox,
  UsersThree,
  Wallet,
  X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { DailyTool, DevTool } from "./Dev";
import { Extras } from "./Extras";
import { HealthTool } from "./Health";
import { CardsTool, SubsTool } from "./Life";
import type { MarketState } from "./Market";
import { Money } from "./Money";
import type { MoneyView, Txn } from "./Money";
import { BirthdaysTool, SplitTool } from "./People";
import { TextTool } from "./TextTools";
import { TimersTool } from "./Timers";
import { Tools } from "./Tools";

/* Schwere Bibliotheken (PDF, QR) werden erst geladen, wenn man das Tool öffnet */
const PdfTool = lazy(() => import("./Files").then((m) => ({ default: m.PdfTool })));
const ImageTool = lazy(() => import("./Files").then((m) => ({ default: m.ImageTool })));
const QrTool = lazy(() => import("./Files").then((m) => ({ default: m.QrTool })));
const BusinessTool = lazy(() => import("./Business").then((m) => ({ default: m.BusinessTool })));

const Loading = () => <div className="empty">Lädt …</div>;

const QUERY = "(min-width: 1024px)";

/** true auf dem PC, false auf dem Handy. */
export function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

type AppDef = { id: string; label: string; desc: string; icon: Icon; color: string; render: () => ReactNode };

export type HubProps = {
  m: MarketState;
  open: string[];
  setOpen: (o: string[]) => void;
  moneyView: MoneyView;
  setMoneyView: (v: MoneyView) => void;
  txns: Txn[];
  setTxns: (t: Txn[]) => void;
  budget: number;
  setBudget: (n: number) => void;
  onAdd: (t: Txn) => void;
};

export function Hub(p: HubProps) {
  const wide = useWide();

  const apps: AppDef[] = [
    {
      id: "money",
      label: "Geld",
      desc: "Budget, Aktien, Krypto, Portfolio",
      icon: Wallet,
      color: "#30d158",
      render: () => (
        <Money
          view={p.moneyView}
          setView={p.setMoneyView}
          m={p.m}
          txns={p.txns}
          setTxns={p.setTxns}
          budget={p.budget}
          setBudget={p.setBudget}
          onAdd={p.onAdd}
        />
      ),
    },
    { id: "calc", label: "Rechner", desc: "Rechner, Währung, Finanzen, Einheiten, Zeit", icon: Calculator, color: "#ff9f0a", render: () => <Tools m={p.m} /> },
    { id: "timer", label: "Timer", desc: "Küchentimer und Stoppuhr, auch in der Island", icon: Hourglass, color: "#ffd60a", render: () => <TimersTool /> },
    { id: "business", label: "Rechnung", desc: "PDF-Rechnungen und Zeiterfassung", icon: Receipt, color: "#34c759", render: () => <BusinessTool /> },
    { id: "split", label: "Teilen", desc: "Gruppenausgaben und Ausgleich", icon: UsersThree, color: "#5e5ce6", render: () => <SplitTool /> },
    { id: "subs", label: "Abos", desc: "Fixkosten und nächste Abbuchungen", icon: CreditCard, color: "#bf5af2", render: () => <SubsTool /> },
    { id: "cards", label: "Karteikarten", desc: "Lernen mit Wiederholung", icon: Cards, color: "#ff9500", render: () => <CardsTool /> },
    { id: "health", label: "Gesundheit", desc: "Atmen, Schlaf, BMI, Kalorien, Wasser", icon: Heartbeat, color: "#ff2d55", render: () => <HealthTool /> },
    { id: "bdays", label: "Geburtstage", desc: "Nie wieder einen vergessen", icon: Cake, color: "#ff375f", render: () => <BirthdaysTool /> },
    { id: "text", label: "Text", desc: "Umwandeln, sortieren, vorlesen", icon: TextAa, color: "#64d2ff", render: () => <TextTool /> },
    { id: "pdf", label: "PDF-Werkstatt", desc: "Zusammenfügen, Seiten, Drehen, Bilder zu PDF", icon: FilePdf, color: "#ff453a", render: () => <PdfTool /> },
    { id: "images", label: "Bilder", desc: "Format ändern, verkleinern, komprimieren", icon: ImageSquare, color: "#af52de", render: () => <ImageTool /> },
    { id: "qr", label: "QR-Codes", desc: "Für Links, Text und WLAN", icon: QrCode, color: "#40c8e0", render: () => <QrTool /> },
    { id: "dev", label: "Entwickler", desc: "JSON, Base64, Hash, UUID, Farbe", icon: Code, color: "#5e5ce6", render: () => <DevTool /> },
    { id: "daily", label: "Alltag", desc: "Datum, Notenschnitt, Sprit, Rabatt", icon: CalendarDots, color: "#0a84ff", render: () => <DailyTool /> },
    { id: "extras", label: "Extras", desc: "Passwort, Countdown, Würfel, Text", icon: Toolbox, color: "#ff375f", render: () => <Extras /> },
  ];

  const openApps = p.open
    .map((id) => apps.find((a) => a.id === id))
    .filter((a): a is AppDef => a !== undefined);
  const shown = wide ? openApps : openApps.slice(-1);

  const toggle = (id: string) => {
    if (!wide) {
      p.setOpen([id]);
      return;
    }
    if (p.open.includes(id)) p.setOpen(p.open.filter((x) => x !== id));
    else p.setOpen([...p.open, id].slice(-4));
  };

  const iconStyle = (color: string) => ({ "--ic": color }) as CSSProperties;

  /* Handy: ein Tool füllt die ganze Seite */
  const single = shown[0];
  if (!wide && single) {
    return (
      <div className="page" key={single.id}>
        <div className="back-row">
          <Button icon={<CaretLeft size={18} weight="bold" />} aria-label="Zurück zu den Tools" onClick={() => p.setOpen([])} />
          <b>{single.label}</b>
        </div>
        <div className="embed">
          <Suspense fallback={<Loading />}>{single.render()}</Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="page" key="hub">
      <header className="head">
        <div>
          <div className="eyebrow">{wide ? "Öffne mehrere Tools nebeneinander" : "Alles an einem Ort"}</div>
          <h1 className="large-title">Tools</h1>
        </div>
        {wide && shown.length > 0 && (
          <button className="link" onClick={() => p.setOpen([])}>
            Alle schließen
          </button>
        )}
      </header>

      {shown.length === 0 ? (
        <div className="launch stagger">
          {apps.map((a) => (
            <button key={a.id} className="tile-app" onClick={() => toggle(a.id)}>
              <span className="ta-ic" style={iconStyle(a.color)}>
                <a.icon size={24} weight="fill" />
              </span>
              <b>{a.label}</b>
              <small>{a.desc}</small>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="strip">
            {apps.map((a) => (
              <button key={a.id} className={`strip-btn${p.open.includes(a.id) ? " on" : ""}`} onClick={() => toggle(a.id)} aria-pressed={p.open.includes(a.id)}>
                <span className="ta-ic sm" style={iconStyle(a.color)}>
                  <a.icon size={16} weight="fill" />
                </span>
                {a.label}
              </button>
            ))}
          </div>
          <div className={`ws n${shown.length}`}>
            {shown.map((a) => (
              <section key={a.id} className="card hub-win">
                <div className="win-head">
                  <span className="ta-ic sm" style={iconStyle(a.color)}>
                    <a.icon size={16} weight="fill" />
                  </span>
                  <b>{a.label}</b>
                  <Button icon={<X size={16} weight="bold" />} aria-label={`${a.label} schließen`} onClick={() => toggle(a.id)} />
                </div>
                <div className="win-body embed">
                  <Suspense fallback={<Loading />}>{a.render()}</Suspense>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}