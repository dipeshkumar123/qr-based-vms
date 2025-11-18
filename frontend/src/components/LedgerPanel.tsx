import { useQuery } from "@tanstack/react-query";
import { getLedger } from "../api";

interface LedgerEntry {
  hash: string;
  visitorId: number;
  createdAt: string;
}

export function LedgerPanel() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["ledger"],
    queryFn: () => getLedger(),
    refetchInterval: 30_000,
  });

  return (
    <div className="card">
      <header className="table-header">
        <h2>Immutable Ledger</h2>
        <button type="button" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </header>
      <p className="card-subtitle">
        Each visitor create/check-in event is hashed with SHA-256. Use this feed for tamper checks.
      </p>
      <table>
        <thead>
          <tr>
            <th>Visitor ID</th>
            <th>Hash</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((entry: LedgerEntry) => (
            <tr key={`${entry.visitorId}-${entry.createdAt}`}>
              <td>{entry.visitorId}</td>
              <td className="hash-cell">{entry.hash}</td>
              <td>{new Date(entry.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {(data ?? []).length === 0 && (
            <tr>
              <td colSpan={3} className="empty">
                No ledger entries recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
