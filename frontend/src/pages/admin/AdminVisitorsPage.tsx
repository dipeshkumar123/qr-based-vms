import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { checkInVisitor, deleteVisitor, listVisitors, type Visitor } from "../../api";
import { QrPreview } from "../../components/QrPreview";
import { LedgerPanel } from "../../components/LedgerPanel";
import { useAdminOutletContext } from "./AdminLayout";

const PAGE_SIZE = 6;

type StatusFilter = "all" | "registered" | "checked_in";

export function AdminVisitorsPage() {
  const { adminEnabled } = useAdminOutletContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const { data: visitors = [], isFetching, refetch } = useQuery({
    queryKey: ["visitors", "management"],
    queryFn: () => listVisitors(),
    enabled: adminEnabled,
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

  const filteredVisitors = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase();
    return visitors
      .filter((visitor) => {
        if (statusFilter !== "all" && visitor.status !== statusFilter) {
          return false;
        }
        if (!lower) {
          return true;
        }
        return [visitor.name, visitor.email, visitor.phone, visitor.purpose]
          .some((value) => value.toLowerCase().includes(lower));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [statusFilter, visitors, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredVisitors.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const paginatedVisitors = filteredVisitors.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  return (
    <div className="visitors-page">
      <section className="data-card">
        <header className="data-card__header">
          <div>
            <h2>Visitor directory</h2>
            <p>Monitor live arrivals, approve access, and maintain the digital visitor ledger.</p>
          </div>
          <div className="data-card__actions">
            <button type="button" className="btn btn-ghost" onClick={() => refetch()} disabled={isFetching || !adminEnabled}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="registered">Registered</option>
              <option value="checked_in">Checked-in</option>
            </select>
            <input
              type="search"
              placeholder="Search name, email, phone, purpose"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </header>

        <div className="data-table">
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
              {adminEnabled && paginatedVisitors.map((visitor) => (
                <tr key={visitor.id} className={selectedVisitor?.id === visitor.id ? "is-selected" : undefined}>
                  <td onClick={() => setSelectedVisitor(visitor)}>
                    <strong>{visitor.name}</strong>
                    <span>{visitor.email}</span>
                  </td>
                  <td onClick={() => setSelectedVisitor(visitor)}>
                    <span>{visitor.purpose}</span>
                    <small>{visitor.phone}</small>
                  </td>
                  <td>
                    <span className={`status-pill status-pill--${visitor.status}`}>
                      {visitor.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>{new Date(visitor.createdAt).toLocaleString()}</td>
                  <td className="table-actions">
                    {visitor.status === "registered" ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          setProcessingId(visitor.id);
                          try {
                            await checkInMutation.mutateAsync(visitor.qrToken);
                          } finally {
                            setProcessingId(null);
                          }
                        }}
                        disabled={processingId === visitor.id}
                      >
                        {processingId === visitor.id ? "Processing…" : "Check in"}
                      </button>
                    ) : (
                      <span className="badge badge-outline">Checked-in</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm danger"
                      onClick={async () => {
                        if (!confirm(`Delete visitor ${visitor.name}?`)) {
                          return;
                        }
                        setProcessingId(visitor.id);
                        try {
                          await deleteMutation.mutateAsync(visitor.id);
                          setSelectedVisitor((current) => (current?.id === visitor.id ? null : current));
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
              {adminEnabled && paginatedVisitors.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No visitors match the current filters.
                  </td>
                </tr>
              )}
              {!adminEnabled && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Authenticate with the admin key to manage visitor records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="table-footer">
          <span>
            Showing {paginatedVisitors.length} of {filteredVisitors.length} visitors
          </span>
          <div className="pagination-controls">
            <button type="button" onClick={() => setPage(Math.max(1, pageClamped - 1))} disabled={pageClamped === 1}>
              Prev
            </button>
            <span>
              {pageClamped} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, pageClamped + 1))}
              disabled={pageClamped === totalPages}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      <aside className="visitors-sidebar">
        <QrPreview
          visitor={selectedVisitor}
          emptyMessage="Select a visitor to preview their QR badge and visit details."
        />
        <LedgerPanel enabled={adminEnabled} />
      </aside>
    </div>
  );
}
