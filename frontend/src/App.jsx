import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import TabBar from "./components/TabBar.jsx";
import Filters from "./components/Filters.jsx";
import StatusTable from "./components/StatusTable.jsx";
import { fetchStatus } from "./api.js";
import "./styles/global.css";

const REFRESH_INTERVAL = 300_000; // 5 minutes

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

export default function App() {
  const [tech, setTech]               = useState("airflow");
  const [rows, setRows]               = useState([]);
  const [source, setSource]           = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [nextRefresh, setNextRefresh] = useState(Date.now() + REFRESH_INTERVAL);

  const [selectedClient, setSelectedClient] = useState("");
  const [selectedEnv, setSelectedEnv]       = useState("");
  const [onlyKo, setOnlyKo]                 = useState(false);

  const timerRef = useRef(null);

  const load = useCallback(async (currentTech) => {
    setLoading(true);
    setError(null);
    try {
      const { source, data } = await fetchStatus(currentTech);
      setRows(flattenData(data));
      setSource(source);
      setGeneratedAt(data.generated_at);
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
    load(tech);
  }, [tech, load]);

  useEffect(() => {
    timerRef.current = setInterval(() => load(tech), REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [tech, load]);

  const clients = useMemo(() => [...new Set(rows.map((r) => r.client))].sort(), [rows]);
  const envs    = useMemo(() => [...new Set(rows.map((r) => r.env))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (selectedClient && r.client !== selectedClient) return false;
    if (selectedEnv    && r.env    !== selectedEnv)    return false;
    if (onlyKo         && r.ok)                        return false;
    return true;
  }), [rows, selectedClient, selectedEnv, onlyKo]);

  return (
    <div id="root">
      <header className="app-header">
        <p className="app-title">◈ Smoke <span>Monitor</span></p>
        <TabBar active={tech} onChange={setTech} />
      </header>

      <main className="app-main">
        {error ? (
          <div className="state-box error">⚠ {error}</div>
        ) : loading && rows.length === 0 ? (
          <div className="state-box">Loading…</div>
        ) : (
          <>
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
              onClient={setSelectedClient} onEnv={setSelectedEnv} onOnlyKo={setOnlyKo}
              onRefresh={() => load(tech)} loading={loading} nextRefresh={nextRefresh}
            />

            <StatusTable rows={filtered} tech={tech} />
          </>
        )}
      </main>
    </div>
  );
}
