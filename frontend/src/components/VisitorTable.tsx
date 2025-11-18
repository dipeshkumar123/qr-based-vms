import { useMutation, useQuery } from "@tanstack/react-query";
import { listVisitors, Visitor, checkInVisitor, deleteVisitor } from "../api";
import { useMemo, useState } from "react";

interface VisitorTableProps {
  onSelect: (visitor: Visitor | null) => void;
}

const csvCellNeedsEscaping = /[",\n]/;

function buildCsv(visitors: Visitor[]): string {
  const header = ["Name", "Email", "Phone", "Purpose", "Status", "QR Token", "Created At", "Updated At"];
  const rows = visitors.map((visitor) => [
    visitor.name,
    visitor.email,
    visitor.phone,
    visitor.purpose,
    visitor.status,
    visitor.qrToken,
    new Date(visitor.createdAt).toISOString(),
    new Date(visitor.updatedAt).toISOString(),
  ]);
  const allRows = [header, ...rows];
  return allRows
    .map((columns) =>
      columns
        .map((value) => {
          const stringValue = value.toString().replace(/"/g, '""');
          if (csvCellNeedsEscaping.test(stringValue)) {
            return `"${stringValue}` + `"`;
          }
          return stringValue;
        })
        .join(",")
    )
    .join("\n");
}

function triggerCsvDownload(visitors: Visitor[]): void {
  const csv = buildCsv(visitors);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ii-vms-visitors-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function VisitorTable({ onSelect }: VisitorTableProps) {
  const [processingId, setProcessingId] = useState<number | null>(null);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["visitors"],
    queryFn: () => listVisitors(),
    refetchInterval: 10_000,
  });

  const checkInMutation = useMutation({
    mutationFn: (token: string) => checkInVisitor(token),
    onSuccess: () => refetch(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteVisitor(id),
    onSuccess: () => refetch(),
  });

  const visitors = useMemo(() => data ?? [], [data]);

  return (
    <div className="card">
      <header className="table-header">
        <h2>Recent Visitors</h2>
        <div className="button-group">
          <button type="button" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => triggerCsvDownload(visitors)}
            disabled={visitors.length === 0}
          >
            Export CSV
          </button>
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visitors.map((visitor) => (
            <tr key={visitor.id} className="clickable-row">
              <td onClick={() => onSelect(visitor)}>{visitor.name}</td>
              <td onClick={() => onSelect(visitor)}>{visitor.purpose}</td>
              <td>
                <span className={`status status-${visitor.status}`}>
                  {visitor.status.replace("_", " ")}
                </span>
              </td>
              <td>{new Date(visitor.createdAt).toLocaleString()}</td>
              <td>
                {visitor.status === "registered" ? (
                  <button
                    onClick={async () => {
                      setProcessingId(visitor.id);
                      try {
                        await checkInMutation.mutateAsync(visitor.qrToken);
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setProcessingId(null);
                      }
                    }}
                    disabled={processingId === visitor.id}
                  >
                    {processingId === visitor.id ? "Processing..." : "Check In"}
                  </button>
                ) : (
                  <em>Checked in</em>
                )}
                <button
                  className="danger"
                  onClick={async () => {
                    if (!confirm(`Delete visitor ${visitor.name}?`)) return;
                    setProcessingId(visitor.id);
                    try {
                      await deleteMutation.mutateAsync(visitor.id);
                      onSelect(null);
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setProcessingId(null);
                    }
                  }}
                  disabled={processingId === visitor.id}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {visitors.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                No visitors registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
