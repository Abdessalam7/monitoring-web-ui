import StatusBadge from "./StatusBadge.jsx";

const AIRFLOW_COMPONENTS = ["scheduler", "metadatabase", "dag_processor", "triggerer"];

function ComponentBadge({ component }) {
  if (!component) return <span className="cell-mono">—</span>;
  const ok = component.status === "healthy";
  return <StatusBadge ok={ok} label={ok ? "healthy" : "unhealthy"} />;
}

export default function StatusTable({ rows, tech }) {
  const hasComponents = tech === "airflow";

  if (rows.length === 0) {
    return (
      <div className="table-wrap">
        <table>
          <tbody>
            <tr className="empty-row">
              <td colSpan={hasComponents ? 12 : 8}>No results match the current filters.</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Env</th>
            <th>Label</th>
            <th>Instance</th>
            <th>Namespace</th>
            <th>Status</th>
            <th>HTTP</th>
            <th>Latency</th>
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
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="cell-mono">{row.client}</td>
              <td className="cell-mono">{row.env}</td>
              <td className="cell-label">{row.label}</td>
              <td className="cell-mono">{row.instance}</td>
              <td className="cell-mono">{row.namespace}</td>
              <td><StatusBadge ok={row.ok} /></td>
              <td className="cell-mono">{row.status_code}</td>
              <td className="cell-latency">{row.latency_ms} ms</td>
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
