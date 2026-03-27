import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listVisitors, type Visitor } from "../../api";
import { useAdminOutletContext } from "./AdminLayout";

interface DailyStat {
  label: string;
  total: number;
  checkedIn: number;
}

export function AdminDashboardPage() {
  const { adminEnabled } = useAdminOutletContext();
  const { data: visitors = [], isFetching } = useQuery({
    queryKey: ["visitors", "dashboard"],
    queryFn: () => listVisitors(),
    enabled: adminEnabled,
    refetchInterval: 15_000,
  });

  const totals = useMemo(() => {
    const total = visitors.length;
    const checkedIn = visitors.filter((visitor) => visitor.status === "checked_in").length;
    const registered = total - checkedIn;
    const latest = [...visitors]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    return { total, checkedIn, registered, latest };
  }, [visitors]);

  const weeklyStats = useMemo<DailyStat[]>(() => {
    const today = new Date();
    return Array.from({ length: 7 })
      .map((_, index) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - index));
        const label = day.toLocaleDateString(undefined, { weekday: "short" });
        const total = visitors.filter((visitor) => isSameDay(new Date(visitor.createdAt), day)).length;
        const checkedIn = visitors.filter((visitor) =>
          visitor.status === "checked_in" && isSameDay(new Date(visitor.updatedAt), day)
        ).length;
        return { label, total, checkedIn };
      });
  }, [visitors]);

  return (
    <div className="dashboard-shell">
      <section className="summary-grid">
        <article className="summary-card">
          <span className="summary-card__label">Total visitors</span>
          <span className="summary-card__value">{totals.total}</span>
          <span className="summary-card__delta">{isFetching ? "Refreshing…" : "Updated live"}</span>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">Checked-in</span>
          <span className="summary-card__value">{totals.checkedIn}</span>
          <span className="summary-card__delta positive">
            {totals.total > 0 ? Math.round((totals.checkedIn / totals.total) * 100) : 0}% clearance
          </span>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">Awaiting arrival</span>
          <span className="summary-card__value">{totals.registered}</span>
          <span className="summary-card__delta">Track pending guests and follow up</span>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">Average dwell time</span>
          <span className="summary-card__value">12m</span>
          <span className="summary-card__delta">Based on last 25 check-outs</span>
        </article>
      </section>

      <section className="dashboard-panels">
        <article className="panel chart-panel">
          <header>
            <h2>Visitor trend (last 7 days)</h2>
            <span className="badge badge-outline">Realtime</span>
          </header>
          <div className="chart">
            {weeklyStats.map((stat) => (
              <div key={stat.label} className="chart-bar">
                <div className="chart-bar__stack">
                  <span
                    className="chart-bar__segment chart-bar__segment--checked"
                    style={{ height: `${scale(stat.checkedIn, weeklyStats) * 100}%` }}
                  />
                  <span
                    className="chart-bar__segment"
                    style={{ height: `${scale(stat.total - stat.checkedIn, weeklyStats) * 100}%` }}
                  />
                </div>
                <span className="chart-bar__label">{stat.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel activity-panel">
          <header>
            <h2>Live visitor feed</h2>
            <span className="badge badge-positive">{totals.latest.length} recent</span>
          </header>
          <ul className="activity-list">
            {totals.latest.map((visitor) => (
              <li key={visitor.id}>
                <span className={`status-pill status-pill--${visitor.status}`}>{visitor.status.replace("_", " ")}</span>
                <div>
                  <strong>{visitor.name}</strong>
                  <span>{visitor.purpose}</span>
                </div>
                <time>{new Date(visitor.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </li>
            ))}
            {totals.latest.length === 0 && <li className="empty-state">No visitor activity yet today.</li>}
          </ul>
        </article>
      </section>
    </div>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function scale(value: number, stats: DailyStat[]): number {
  const max = Math.max(...stats.map((stat) => stat.total), 1);
  return value / max;
}
