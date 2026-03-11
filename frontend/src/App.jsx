import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import TabBar from "./components/TabBar.jsx";
import Filters from "./components/Filters.jsx";
import StatusTable from "./components/StatusTable.jsx";
import UptimeChart from "./components/UptimeChart.jsx";
import { fetchStatus } from "./api.js";
import "./styles/global.css";

const REFRESH_INTERVAL = 300_000;
const HISTORY_MAX_HOURS = 24;
const HISTORY_KEY = (tech) => `smoke_history_${tech}`;

function flattenData(data) {
  const rows = [];
  for (const client of data.clients ?? []) {
    for (const env of client.environments ?? []) {
      for (const check of env.checks ?? []) {
        rows.push({ ...check, client: client.name, env: env.name });
      }
    }
  }
  return rows;
}

function loadHistory(tech) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(tech));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const cutoff = Date.now() - HISTORY_MAX_HOURS * 60 * 60 * 1000;
    return parsed.filter((s) => s.ts >= cutoff);
  } catch { return []; }
}

function saveHistory(tech, history) {
  try {
    localStorage.setItem(HISTORY_KEY(tech), JSON.stringify(history));
  } catch {}
}

function KpiCards({ rows, activeCard, onCardClick }) {
  const total  = rows.length;
  const ok     = rows.filter((r) => r.ok).length;
  const ko     = total - ok;
  const uptime = total > 0 ? Math.round((ok / total) * 100) : 0;

  const cards = [
    { key: "total",  value: total,        label: "Total checks", cls: "",                       valueCls: "" },
    { key: "ok",     value: ok,           label: "OK",           cls: "kpi-ok",                 valueCls: "kpi-value-ok" },
    { key: "ko",     value: ko,           label: "KO",           cls: ko > 0 ? "kpi-ko" : "",   valueCls: ko > 0 ? "kpi-value-ko" : "" },
    { key: "uptime", value: `${uptime}%`, label: "Uptime",       cls: "",                       valueCls: uptime === 100 ? "kpi-value-ok" : "kpi-value-ko" },
  ];

  return (
    <div className="kpi-bar">
      {cards.map((c) => (
        <div
          key={c.key}
          className={`kpi-card ${c.cls} ${activeCard === c.key ? "kpi-active" : ""}`}
          onClick={() => onCardClick(c.key)}
        >
          <span className={`kpi-value ${c.valueCls}`}>{c.value}</span>
          <span className="kpi-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBanner({ rows }) {
  if (rows.length === 0) return null;
  const ko = rows.filter((r) => !r.ok).length;
  const allOk = ko === 0;
  return (
    <div className={`status-banner ${allOk ? "banner-ok" : "banner-ko"}`}>
      <span className="banner-dot" />
      {allOk ? "All systems operational" : `${ko} incident${ko > 1 ? "s" : ""} detected`}
    </div>
  );
}

export default function App() {
  const [tech, setTech]               = useState("airflow");
  const [rows, setRows]               = useState([]);
  const [source, setSource]           = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [nextRefresh, setNextRefresh] = useState(Date.now() + REFRESH_INTERVAL);
  const [history, setHistory]         = useState(() => loadHistory("airflow"));
  const [showHistory, setShowHistory] = useState(false);

  const [selectedClient, setSelectedClient] = useState("");
  const [selectedEnv, setSelectedEnv]       = useState("");
  const [onlyKo, setOnlyKo]                 = useState(false);
  const [activeCard, setActiveCard]         = useState("total");

  const timerRef = useRef(null);

  const load = useCallback(async (currentTech) => {
    setLoading(true);
    setError(null);
    try {
      const { source, data } = await fetchStatus(currentTech);
      const newRows = flattenData(data);
      setRows(newRows);
      setSource(source);
      setGeneratedAt(data.generated_at);

      const snap = { ts: Date.now(), rows: newRows };
      setHistory((prev) => {
        const cutoff = Date.now() - HISTORY_MAX_HOURS * 60 * 60 * 1000;
        const updated = [...prev.filter((s) => s.ts >= cutoff), snap];
        saveHistory(currentTech, updated);
        return updated;
      });
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
      setNextRefresh(Date.now() + REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => {
    setSelectedClient("");
    setSelectedEnv("");
    setOnlyKo(false);
    setActiveCard("total");
    const h = loadHistory(tech);
    setHistory(h);
    load(tech);
  }, [tech, load]);

  useEffect(() => {
    timerRef.current = setInterval(() => load(tech), REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [tech, load]);

  const handleCardClick = (key) => {
    setActiveCard(key);
    setSelectedClient("");
    setSelectedEnv("");
    if (key === "ko") setOnlyKo(true);
    else              setOnlyKo(false);
  };

  const handleClientChange = (v) => { setSelectedClient(v); setActiveCard(null); };
  const handleEnvChange    = (v) => { setSelectedEnv(v);    setActiveCard(null); };
  const handleOnlyKo       = (v) => { setOnlyKo(v);         setActiveCard(v ? "ko" : null); };

  const clients = useMemo(() => [...new Set(rows.map((r) => r.client))].sort(), [rows]);
  const envs    = useMemo(() => [...new Set(rows.map((r) => r.env))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (selectedClient && r.client !== selectedClient) return false;
    if (selectedEnv    && r.env    !== selectedEnv)    return false;
    if (onlyKo         && r.ok)                        return false;
    if (activeCard === "ok" && !r.ok)                  return false;
    return true;
  }), [rows, selectedClient, selectedEnv, onlyKo, activeCard]);

  return (
    <div id="root">
      <header className="app-header">
        <p className="app-title">◈ Datahub v2 <span>Smoke Tests</span></p>
        <TabBar active={tech} onChange={setTech} />
      </header>

      <main className="app-main">
        {error ? (
          <div className="state-box error">⚠ {error}</div>
        ) : loading && rows.length === 0 ? (
          <div className="state-box">Loading…</div>
        ) : (
          <>
            <StatusBanner rows={rows} />
            <KpiCards rows={rows} activeCard={activeCard} onCardClick={handleCardClick} />

            <div className="section-toggle-bar">
              <button
                className={`section-toggle-btn ${showHistory ? "section-toggle-active" : ""}`}
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? "▾" : "▸"} Uptime history (24h)
                {history.length > 0 && (
                  <span className="history-count">{history.length} snapshots</span>
                )}
              </button>
            </div>

            {showHistory && <UptimeChart history={history} />}

            {generatedAt && (
              <div className="meta-bar">
                <span>Generated at: <strong>{new Date(generatedAt).toLocaleString()}</strong></span>
                {source && <span className="source">[{source}]</span>}
                <span>{filtered.length} / {rows.length} checks</span>
              </div>
            )}

            <Filters
              clients={clients} envs={envs}
              selectedClient={selectedClient} selectedEnv={selectedEnv} onlyKo={onlyKo}
              onClient={handleClientChange} onEnv={handleEnvChange} onOnlyKo={handleOnlyKo}
              onRefresh={() => load(tech)} loading={loading} nextRefresh={nextRefresh}
            />

            <StatusTable rows={filtered} tech={tech} />
          </>
        )}
      </main>
    </div>
  );
}
