import { useQuery } from "@tanstack/react-query";
import { listVisitors, Visitor } from "../api";

interface VisitorTableProps {
  onSelect: (visitor: Visitor) => void;
}

export function VisitorTable({ onSelect }: VisitorTableProps) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["visitors"],
    queryFn: () => listVisitors(),
    refetchInterval: 10_000,
  });

  return (
    <div className="card">
      <header className="table-header">
        <h2>Recent Visitors</h2>
        <button type="button" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </header>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((visitor) => (
            <tr key={visitor.id} onClick={() => onSelect(visitor)} className="clickable-row">
              <td>{visitor.name}</td>
              <td>{visitor.purpose}</td>
              <td>
                <span className={`status status-${visitor.status}`}>
                  {visitor.status.replace("_", " ")}
                </span>
              </td>
              <td>{new Date(visitor.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {(data ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="empty">
                No visitors registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
