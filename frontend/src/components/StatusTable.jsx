import { useState, useMemo } from "react";
import StatusBadge from "./StatusBadge.jsx";

const AIRFLOW_COMPONENTS = ["scheduler", "metadatabase", "dag_processor", "triggerer"];

function Tooltip({ text, children }) {
  return (
    <span className="tooltip-wrap">
      {children}
      {text && <span className="tooltip-box">{text}</span>}
    </span>
  );
}

function ComponentBadge({ component }) {
  if (!component) return <span className="cell-mono">—</span>;
  const ok = component.status === "healthy";
  const heartbeat = component.latest_heartbeat
    ? new Date(component.latest_heartbeat).toLocaleTimeString()
    : null;
  return (
    <Tooltip text={heartbeat ? `Last heartbeat: ${heartbeat}` : "No heartbeat data"}>
      <StatusBadge ok={ok} label={ok ? "healthy" : "unhealthy"} />
    </Tooltip>
  );
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="sort-icon sort-idle">↕</span>;
  return <span className="sort-icon sort-active">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export function exportCSV(rows, tech) {
  const hasComponents = tech === "airflow";
  const baseHeaders = ["Client", "Env", "Label", "Instance", "Namespace", "Status", "HTTP"];
  const compHeaders = hasComponents ? ["Scheduler", "Metadb", "DAG Processor", "Triggerer"] : [];
  const headers = [...baseHeaders, ...compHeaders];

  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const lines = [
    headers.join(","),
    ...rows.map((r) => {
      const base = [
        r.client, r.env, r.label, r.instance, r.namespace,
        r.ok ? "OK" : "KO", r.status_code,
      ];
      const comps = hasComponents
        ? AIRFLOW_COMPONENTS.map((k) => r.components?.[k]?.status ?? "—")
        : [];
      return [...base, ...comps].map(escape).join(",");
    }),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `smoke-tests-${tech}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SORT_COLS = ["client", "env", "ok", "status_code", "instance"];

export default function StatusTable({ rows, tech }) {
  const hasComponents = tech === "airflow";
  const [sortCol, setSortCol] = useState("client");
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (col) => {
    if (!SORT_COLS.includes(col)) return;
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (typeof av === "string")  return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  const colProps = (col) => ({
    onClick: SORT_COLS.includes(col) ? () => handleSort(col) : undefined,
    className: SORT_COLS.includes(col) ? "th-sortable" : "",
  });

  if (rows.length === 0) {
    return (
      <div className="table-wrap">
        <table><tbody>
          <tr className="empty-row">
            <td colSpan={hasComponents ? 11 : 7}>No results match the current filters.</td>
          </tr>
        </tbody></table>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <span className="table-count">{rows.length} result{rows.length > 1 ? "s" : ""}</span>
        <button className="export-btn" onClick={() => exportCSV(rows, tech)}>
          ↓ Export CSV
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th {...colProps("client")}>Client <SortIcon col="client" sortCol={sortCol} sortDir={sortDir} /></th>
            <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
            <th>Label</th>
            <th {...colProps("instance")}>Instance <SortIcon col="instance" sortCol={sortCol} sortDir={sortDir} /></th>
            <th>Namespace</th>
            <th {...colProps("ok")}>Status <SortIcon col="ok" sortCol={sortCol} sortDir={sortDir} /></th>
            <th {...colProps("status_code")}>HTTP <SortIcon col="status_code" sortCol={sortCol} sortDir={sortDir} /></th>
            {hasComponents && (
              <>
                <th>Scheduler</th>
                <th>Metadb</th>
                <th>DAG Processor</th>
                <th>Triggerer</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className={!row.ok ? "row-ko" : ""}>
              <td className="cell-mono">{row.client}</td>
              <td className="cell-mono">{row.env}</td>
              <td className="cell-label">{row.label}</td>
              <td className="cell-mono">{row.instance}</td>
              <td className="cell-mono">{row.namespace}</td>
              <td><StatusBadge ok={row.ok} /></td>
              <td className="cell-mono">{row.status_code}</td>
              {hasComponents && AIRFLOW_COMPONENTS.map((key) => (
                <td key={key}>
                  <ComponentBadge component={row.components?.[key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
