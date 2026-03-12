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

function TextBadge({ value, okValue }) {
  if (!value) return <span className="cell-mono">—</span>;
  const ok = value === okValue;
  return <StatusBadge ok={ok} label={value} />;
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="sort-icon sort-idle">↕</span>;
  return <span className="sort-icon sort-active">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export function exportCSV(rows, tech) {
  let headers, lines;
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  if (tech === "spark") {
    headers = ["Business Line", "Env", "Tenant Name", "Status", "Sync(ArgoCD)", "Global Status", "All Healthy", "Version", "Deprecated", "IBM Account", "IKS Cluster"];
    lines = [
      headers.join(","),
      ...rows.map((r) => [
        r.client, r.env, r.tenant_name, r.status, r.sync_argo,
        r.global_status, r.all_healthy, r.version, r.deprecated,
        r.ibm_account, r.iks_cluster,
      ].map(escape).join(",")),
    ];
  } else {
    const compHeaders = ["Scheduler", "Metadb", "DAG Processor", "Triggerer"];
    headers = ["Client", "Env", "Label", "Instance", "Namespace", "Status", "HTTP", ...compHeaders];
    lines = [
      headers.join(","),
      ...rows.map((r) => {
        const base = [r.client, r.env, r.label, r.instance, r.namespace, r.ok ? "OK" : "KO", r.status_code];
        const comps = AIRFLOW_COMPONENTS.map((k) => r.components?.[k]?.status ?? "—");
        return [...base, ...comps].map(escape).join(",");
      }),
    ];
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `smoke-tests-${tech}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SORT_COLS_AIRFLOW = ["env", "ok", "status_code", "instance"];
const SORT_COLS_SPARK   = ["env", "ok", "version", "tenant_name", "status", "sync_argo"];

// ─── Spark rows ────────────────────────────────────────────────────────────────

function SparkTableRows({ rows, sortCol, sortDir }) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return sorted.map((row, i) => (
    <tr key={row.id ?? i} className={!row.ok ? "row-ko" : ""}>
      <td className="cell-mono">{row.env}</td>
      <td className="cell-mono cell-tenant">{row.tenant_name}</td>
      <td><TextBadge value={row.status} okValue="Healthy" /></td>
      <td><TextBadge value={row.sync_argo} okValue="Synced" /></td>
      <td><TextBadge value={row.global_status} okValue="Synced" /></td>
      <td className="cell-mono">{row.version}</td>
      <td className="cell-mono">{row.deprecated ? "Yes" : "No"}</td>
      <td className="cell-mono cell-account">{row.ibm_account}</td>
      <td className="cell-mono cell-cluster">{row.iks_cluster}</td>
    </tr>
  ));
}

function SparkAccordionSection({ clientName, rows, sortCol, sortDir, colProps }) {
  const [open, setOpen] = useState(true);
  const total = rows.length;
  const ko    = rows.filter((r) => !r.ok).length;
  const ok    = total - ko;

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setOpen((v) => !v)}>
        <span className="accordion-chevron">{open ? "▾" : "▸"}</span>
        <span className="accordion-client">{clientName}</span>
        <span className="accordion-stats">
          <span className="acc-stat acc-ok">✓ {ok} OK</span>
          {ko > 0 && <span className="acc-stat acc-ko">✗ {ko} KO</span>}
          <span className="acc-stat acc-total">{total} tenants</span>
        </span>
      </div>

      {open && (
        <div className="accordion-body">
          <table>
            <thead>
              <tr>
                <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("tenant_name")}>Tenant Name <SortIcon col="tenant_name" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("status")}>Status <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("sync_argo")}>Sync(ArgoCD) <SortIcon col="sync_argo" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Global Status</th>
                <th {...colProps("version")}>Version <SortIcon col="version" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Deprecated</th>
                <th>IBM Account</th>
                <th>IKS Cluster</th>
              </tr>
            </thead>
            <tbody>
              <SparkTableRows rows={rows} sortCol={sortCol} sortDir={sortDir} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SparkFlatTable({ rows, sortCol, sortDir, handleSort }) {
  const colProps = (col) => ({
    onClick: () => handleSort(col),
    className: SORT_COLS_SPARK.includes(col) ? "th-sortable" : "",
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return (
    <table>
      <thead>
        <tr>
          <th {...colProps("client")}>Business Line <SortIcon col="client" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("tenant_name")}>Tenant Name <SortIcon col="tenant_name" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("status")}>Status <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("sync_argo")}>Sync(ArgoCD) <SortIcon col="sync_argo" sortCol={sortCol} sortDir={sortDir} /></th>
          <th>Global Status</th>
          <th {...colProps("version")}>Version <SortIcon col="version" sortCol={sortCol} sortDir={sortDir} /></th>
          <th>Deprecated</th>
          <th>IBM Account</th>
          <th>IKS Cluster</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, i) => (
          <tr key={row.id ?? i} className={!row.ok ? "row-ko" : ""}>
            <td className="cell-mono">{row.client}</td>
            <td className="cell-mono">{row.env}</td>
            <td className="cell-mono cell-tenant">{row.tenant_name}</td>
            <td><TextBadge value={row.status} okValue="Healthy" /></td>
            <td><TextBadge value={row.sync_argo} okValue="Synced" /></td>
            <td><TextBadge value={row.global_status} okValue="Synced" /></td>
            <td className="cell-mono">{row.version}</td>
            <td className="cell-mono">{row.deprecated ? "Yes" : "No"}</td>
            <td className="cell-mono cell-account">{row.ibm_account}</td>
            <td className="cell-mono cell-cluster">{row.iks_cluster}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Airflow rows ──────────────────────────────────────────────────────────────

function TableRows({ rows, sortCol, sortDir }) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (typeof av === "string")  return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return sorted.map((row) => (
    <tr key={row.id} className={!row.ok ? "row-ko" : ""}>
      <td className="cell-mono">{row.env}</td>
      <td className="cell-label">{row.label}</td>
      <td className="cell-mono">{row.instance}</td>
      <td className="cell-mono">{row.namespace}</td>
      <td><StatusBadge ok={row.ok} /></td>
      <td className="cell-mono">{row.status_code}</td>
      {AIRFLOW_COMPONENTS.map((key) => (
        <td key={key}><ComponentBadge component={row.components?.[key]} /></td>
      ))}
    </tr>
  ));
}

function AccordionSection({ clientName, rows, sortCol, sortDir, colProps }) {
  const [open, setOpen] = useState(true);
  const total = rows.length;
  const ko    = rows.filter((r) => !r.ok).length;
  const ok    = total - ko;

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setOpen((v) => !v)}>
        <span className="accordion-chevron">{open ? "▾" : "▸"}</span>
        <span className="accordion-client">{clientName}</span>
        <span className="accordion-stats">
          <span className="acc-stat acc-ok">✓ {ok} OK</span>
          {ko > 0 && <span className="acc-stat acc-ko">✗ {ko} KO</span>}
          <span className="acc-stat acc-total">{total} checks</span>
        </span>
      </div>

      {open && (
        <div className="accordion-body">
          <table>
            <thead>
              <tr>
                <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Label</th>
                <th {...colProps("instance")}>Instance <SortIcon col="instance" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Namespace</th>
                <th {...colProps("ok")}>Status <SortIcon col="ok" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("status_code")}>HTTP <SortIcon col="status_code" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Scheduler</th>
                <th>Metadb</th>
                <th>DAG Processor</th>
                <th>Triggerer</th>
              </tr>
            </thead>
            <tbody>
              <TableRows rows={rows} sortCol={sortCol} sortDir={sortDir} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FlatTable({ rows, sortCol, sortDir, handleSort }) {
  const colProps = (col) => ({
    onClick: SORT_COLS_AIRFLOW.includes(col) || col === "client" ? () => handleSort(col) : undefined,
    className: SORT_COLS_AIRFLOW.includes(col) || col === "client" ? "th-sortable" : "",
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (typeof av === "string")  return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return (
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
          <th>Scheduler</th>
          <th>Metadb</th>
          <th>DAG Processor</th>
          <th>Triggerer</th>
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
            {AIRFLOW_COMPONENTS.map((key) => (
              <td key={key}><ComponentBadge component={row.components?.[key]} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function StatusTable({ rows, tech }) {
  const isSpark = tech === "spark";
  const [sortCol, setSortCol] = useState(isSpark ? "tenant_name" : "client");
  const [sortDir, setSortDir] = useState("asc");
  const [viewMode, setViewMode] = useState("accordion");

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const colProps = (col) => ({
    onClick: () => handleSort(col),
    className: "th-sortable",
  });

  const groupedByClient = useMemo(() => {
    const map = {};
    for (const row of rows) {
      if (!map[row.client]) map[row.client] = [];
      map[row.client].push(row);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const colSpan = isSpark ? 9 : 11;

  if (rows.length === 0) {
    return (
      <div className="table-wrap">
        <table><tbody>
          <tr className="empty-row">
            <td colSpan={colSpan}>No results match the current filters.</td>
          </tr>
        </tbody></table>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === "accordion" ? "view-btn-active" : ""}`}
            onClick={() => setViewMode("accordion")}
          >
            ☰ By {isSpark ? "business line" : "client"}
          </button>
          <button
            className={`view-btn ${viewMode === "flat" ? "view-btn-active" : ""}`}
            onClick={() => setViewMode("flat")}
          >
            ≡ Flat
          </button>
        </div>
        <span className="table-count">{rows.length} result{rows.length > 1 ? "s" : ""}</span>
        <button className="export-btn" onClick={() => exportCSV(rows, tech)}>
          ↓ Export CSV
        </button>
      </div>

      {viewMode === "flat" ? (
        isSpark
          ? <SparkFlatTable rows={rows} sortCol={sortCol} sortDir={sortDir} handleSort={handleSort} />
          : <FlatTable rows={rows} sortCol={sortCol} sortDir={sortDir} handleSort={handleSort} />
      ) : (
        <div className="accordion">
          {groupedByClient.map(([clientName, clientRows]) => (
            isSpark
              ? <SparkAccordionSection key={clientName} clientName={clientName} rows={clientRows} sortCol={sortCol} sortDir={sortDir} colProps={colProps} />
              : <AccordionSection key={clientName} clientName={clientName} rows={clientRows} sortCol={sortCol} sortDir={sortDir} colProps={colProps} />
          ))}
        </div>
      )}
    </div>
  );
}
