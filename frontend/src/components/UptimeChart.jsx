import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

const OK_COLOR  = "#00915a";
const KO_COLOR  = "#e03535";
const COLORS    = ["#00915a", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function pct(ok, total) {
  if (!total) return null;
  return Math.round((ok / total) * 100);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-time">{formatTime(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}%</strong>
        </p>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-time">{formatTime(label)}</p>
      <p style={{ color: OK_COLOR }}>OK: <strong>{d?.ok ?? 0}</strong></p>
      <p style={{ color: KO_COLOR }}>KO: <strong>{d?.ko ?? 0}</strong></p>
      <p style={{ color: "#6b7489" }}>Uptime: <strong>{d?.uptime ?? 0}%</strong></p>
    </div>
  );
}

export default function UptimeChart({ history }) {
  const globalData = useMemo(() => {
    return history.map((snap) => ({
      ts:     snap.ts,
      ok:     snap.rows.filter((r) => r.ok).length,
      ko:     snap.rows.filter((r) => !r.ok).length,
      total:  snap.rows.length,
      uptime: pct(snap.rows.filter((r) => r.ok).length, snap.rows.length),
    }));
  }, [history]);

  const clients = useMemo(() => {
    const set = new Set();
    history.forEach((s) => s.rows.forEach((r) => set.add(r.client)));
    return [...set].sort();
  }, [history]);

  const perClientData = useMemo(() => {
    return history.map((snap) => {
      const point = { ts: snap.ts };
      clients.forEach((c) => {
        const cRows = snap.rows.filter((r) => r.client === c);
        point[c] = pct(cRows.filter((r) => r.ok).length, cRows.length);
      });
      return point;
    });
  }, [history, clients]);

  if (history.length < 2) {
    return (
      <div className="uptime-chart-wrap">
        <div className="chart-empty">
          Not enough data yet — history builds up over time as the app refreshes every 5 minutes.
        </div>
      </div>
    );
  }

  return (
    <div className="uptime-chart-wrap">
      <div className="chart-section">
        <h3 className="chart-title">Global uptime — last 24h</h3>
        <div className="chart-row">
          <div className="chart-half">
            <p className="chart-subtitle">Uptime % (line)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={globalData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dde1e9" />
                <XAxis dataKey="ts" tickFormatter={formatTime} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={100} stroke={OK_COLOR} strokeDasharray="4 4" />
                <Line
                  type="monotone" dataKey="uptime" name="Uptime"
                  stroke={OK_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-half">
            <p className="chart-subtitle">OK / KO count (bars)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={globalData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dde1e9" />
                <XAxis dataKey="ts" tickFormatter={formatTime} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip content={<BarTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ok" name="OK" stackId="a" fill={OK_COLOR} radius={[0,0,0,0]} />
                <Bar dataKey="ko" name="KO" stackId="a" fill={KO_COLOR} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {clients.length > 1 && (
        <div className="chart-section">
          <h3 className="chart-title">Uptime by client — last 24h</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={perClientData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dde1e9" />
              <XAxis dataKey="ts" tickFormatter={formatTime} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              {clients.map((c, i) => (
                <Line
                  key={c}
                  type="monotone"
                  dataKey={c}
                  name={c}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
