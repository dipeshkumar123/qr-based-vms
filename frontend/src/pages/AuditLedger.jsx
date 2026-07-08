import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import apiClient from '../lib/api';
import VirtualizedList from '../components/VirtualizedList';

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'VISITOR_CREATED', label: 'Visitor Created' },
  { value: 'VISITOR_UPDATED', label: 'Visitor Updated' },
  { value: 'VISITOR_CHECKED_IN', label: 'Visitor Checked In' },
  { value: 'VISITOR_CHECKED_OUT', label: 'Visitor Checked Out' },
  { value: 'VISITOR_DELETED', label: 'Visitor Deleted' },
];

const OUTCOME_OPTIONS = [
  { value: '', label: 'All outcomes' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
];

const ACTOR_TYPE_OPTIONS = [
  { value: '', label: 'All actor types' },
  { value: 'admin', label: 'Admin' },
  { value: 'system', label: 'System' },
];

function formatAction(action) {
  if (!action) return 'UNKNOWN';
  return action
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function toDateTimeLocalValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocalValue(localDate) {
  if (!localDate) return '';
  return new Date(localDate).toISOString();
}

function summarizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return 'No details available';

  if (!entry.action || entry.action === 'UNKNOWN') {
    return 'Legacy entry (recorded before structured audit metadata).';
  }

  const updatedFields = Array.isArray(entry.metadata?.updatedFields)
    ? entry.metadata.updatedFields
    : [];
  if (updatedFields.length > 0) {
    return `Updated: ${updatedFields.join(', ')}`;
  }

  const beforeStatus = entry.changeSet?.before?.status;
  const afterStatus = entry.changeSet?.after?.status;
  if (beforeStatus && afterStatus && beforeStatus !== afterStatus) {
    return `Status: ${beforeStatus} -> ${afterStatus}`;
  }

  if (entry.requestId) {
    return `Request: ${entry.requestId}`;
  }

  return 'No additional change summary.';
}

export default function AuditLedger() {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuthStore();
  const [ledger, setLedger] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const hasVerifiedRef = useRef(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showIntegrityDetails, setShowIntegrityDetails] = useState(false);
  const [filters, setFilters] = useState({
    action: '',
    actorType: '',
    actorId: '',
    outcome: '',
    visitorId: '',
    from: '',
    to: '',
  });

  const downloadAuditTemplate = async () => {
    try {
      const response = await apiClient.get('/api/admin/export-template/audit_report', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audit-report-template.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download audit template:', error);
    }
  };

  const fetchLedger = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) setLoading(true);
    else setRefreshing(true);

    try {
      const params = {
        page,
        limit,
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.actorType ? { actorType: filters.actorType } : {}),
        ...(filters.actorId.trim() ? { actorId: filters.actorId.trim() } : {}),
        ...(filters.outcome ? { outcome: filters.outcome } : {}),
        ...(filters.visitorId ? { visitorId: Number(filters.visitorId) } : {}),
        ...(filters.from ? { from: fromDateTimeLocalValue(filters.from) } : {}),
        ...(filters.to ? { to: fromDateTimeLocalValue(filters.to) } : {}),
      };
      const response = await apiClient.get('/api/ledger', {
        params,
      });
      setLedger(response.data.items || []);
      setTotal(response.data.total || 0);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to fetch ledger:', error);
      if (error.response?.status === 401) {
        logout();
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, limit, logout, navigate, page]);

  const verifyLedger = useCallback(async () => {
    try {
      setVerifying(true);
      const response = await apiClient.get('/api/ledger/verify');
      setVerificationResult(response.data);
    } catch (error) {
      console.error('Failed to verify ledger:', error);
      setVerificationResult({
        ok: false,
        issues: [{ visitorId: -1, index: -1, message: error.message }],
      });
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchLedger();
    if (!hasVerifiedRef.current) {
      hasVerifiedRef.current = true;
      verifyLedger();
    }
  }, [fetchLedger, isAdmin, navigate, verifyLedger]);

  useEffect(() => {
    setPage(1);
  }, [filters.action, filters.actorType, filters.actorId, filters.outcome, filters.visitorId, filters.from, filters.to]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Immutable Audit Ledger</h1>
              <p className="text-gray-500 mt-1 text-sm">SHA-256 hash-chain verification & tamper detection</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadAuditTemplate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl border border-emerald-700 hover:bg-emerald-700 hover:shadow-sm font-semibold text-sm transition"
              >
                Audit Template
              </button>
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-sm font-medium text-sm transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="mb-6">
          {verificationResult && (
            <div
              className={`rounded-2xl shadow-sm p-6 border ${
                verificationResult.ok
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    verificationResult.ok ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {verificationResult.ok ? (
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1">
                      {verificationResult.ok ? 'Ledger Integrity Verified' : 'Tampering Detected'}
                    </h2>
                    <p className={`text-sm ${verificationResult.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                      {verificationResult.ok
                        ? 'All hash chains are valid. No tampering detected.'
                        : `${verificationResult.issues?.length || 0} integrity issues found`}
                    </p>

                    {!verificationResult.ok && verificationResult.issues?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {verificationResult.issues.map((issue, idx) => (
                          <div key={idx} className="text-sm text-red-800 bg-red-100 p-2.5 rounded-lg">
                            <strong>Visitor #{issue.visitorId}</strong> (Entry #{issue.index}): {issue.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={verifyLedger}
                  disabled={verifying}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex-shrink-0 ${
                    verifying
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  }`}
                >
                  {verifying ? 'Verifying...' : 'Re-verify'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <h2 className="text-xl font-bold">Audit Log Entries</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              >
                {showAdvancedFilters ? 'Hide Advanced Filters' : 'Advanced Filters'}
              </button>
              <button
                onClick={() => setShowIntegrityDetails((prev) => !prev)}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              >
                {showIntegrityDetails ? 'Hide Hash Details' : 'Show Hash Details'}
              </button>
            </div>
          </div>

              <div className="mb-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <select
                  value={filters.action}
                  onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={filters.outcome}
                  onChange={(e) => setFilters((prev) => ({ ...prev, outcome: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                >
                  {OUTCOME_OPTIONS.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={filters.outcome}
                  onChange={(e) => setFilters((prev) => ({ ...prev, outcome: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                >
                  {OUTCOME_OPTIONS.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={filters.visitorId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, visitorId: e.target.value }))}
                  placeholder="Visitor ID"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                />
                <input
                  type="datetime-local"
                  value={filters.from}
                  onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                  max={toDateTimeLocalValue(new Date().toISOString())}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                  aria-label="From date"
                />
                <input
                  type="datetime-local"
                  value={filters.to}
                  onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                  max={toDateTimeLocalValue(new Date().toISOString())}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                  aria-label="To date"
                />
                <button
                  onClick={() => setFilters({ action: '', actorType: '', actorId: '', outcome: '', visitorId: '', from: '', to: '' })}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              </div>

              {showAdvancedFilters && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <select
                    value={filters.actorType}
                    onChange={(e) => setFilters((prev) => ({ ...prev, actorType: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                  >
                    {ACTOR_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={filters.actorId}
                    onChange={(e) => setFilters((prev) => ({ ...prev, actorId: e.target.value }))}
                    placeholder="Actor ID"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                  />
                  <input
                    type="datetime-local"
                    value={filters.from}
                    onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                    max={toDateTimeLocalValue(new Date().toISOString())}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                    aria-label="From date"
                  />
                  <input
                    type="datetime-local"
                    value={filters.to}
                    onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                    max={toDateTimeLocalValue(new Date().toISOString())}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50"
                    aria-label="To date"
                  />
                </div>
              )}

              <div className="mb-4 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                Default view focuses on who did what and what changed. Hash-chain details are optional via Show Hash Details.
              </div>

              {refreshing && (
                <div className="mb-4 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  Refreshing ledger in background. Showing last known entries.
                </div>
              )}

              {loading && !hasLoadedRef.current ? (
                <div className="py-4 animate-pulse">
                  <div className="h-10 w-full bg-gray-100 rounded-lg mb-3"></div>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-14 w-full bg-gray-100 rounded-lg mb-2"></div>
                  ))}
                </div>
              ) : ledger.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">No audit log entries yet</p>
                  <p className="text-gray-400 text-sm mt-1">Visitor actions will be recorded here</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/80">
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Action</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Actor</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Target</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Outcome</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Visitor ID</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Summary</th>
                          {showIntegrityDetails && (
                            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Hash Chain</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((entry, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-50 hover:bg-blue-50/50 transition"
                          >
                            <td className="px-4 py-3 text-gray-700 text-sm">
                              {new Date(entry.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-gray-900 font-semibold text-xs">
                              {entry.action === 'UNKNOWN' ? 'Legacy Entry' : formatAction(entry.action)}
                            </td>
                            <td className="px-4 py-3 text-gray-700 text-xs">
                              <div>{entry.actorType || 'system'}{entry.actorId ? ` (${entry.actorId})` : ''}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-700 text-xs">
                              <div>{entry.targetType || 'visitor'}{entry.targetId ? ` #${entry.targetId}` : ''}</div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full font-semibold ${entry.outcome === 'failure' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {entry.outcome || 'success'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-900 font-semibold text-sm">
                              #{entry.visitorId}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 max-w-[280px]">
                              {summarizeEntry(entry)}
                            </td>
                            {showIntegrityDetails && (
                              <td className="px-4 py-3">
                                <div className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-lg break-all mb-1">{entry.hash}</div>
                                <div className="font-mono text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded-lg break-all">prev: {entry.prevHash || '-'}</div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden">
                    <VirtualizedList
                      items={ledger}
                      itemHeight={250}
                      height={Math.min(700, Math.max(250, ledger.length * 250))}
                      className="space-y-3"
                      renderItem={(entry, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm">
                          <p className="text-sm text-gray-500 mb-1">Action</p>
                          <p className="font-semibold text-gray-900 mb-2">{entry.action === 'UNKNOWN' ? 'Legacy Entry' : formatAction(entry.action)}</p>
                          <p className="text-sm text-gray-500 mb-1">Visitor</p>
                          <p className="text-sm text-gray-700 mb-2">#{entry.visitorId}</p>
                          <p className="text-sm text-gray-500 mb-1">Actor / Outcome</p>
                          <p className="text-sm text-gray-700 mb-2">{entry.actorType || 'system'} {entry.actorId ? `(${entry.actorId})` : ''} · {entry.outcome || 'success'}</p>
                          <p className="text-sm text-gray-500 mb-1">Summary</p>
                          <p className="text-xs text-gray-700 mb-2">{summarizeEntry(entry)}</p>
                          {showIntegrityDetails && (
                            <>
                              <p className="text-sm text-gray-500 mb-1">Hash</p>
                              <p className="font-mono text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 break-all mb-2">{entry.hash}</p>
                              <p className="text-sm text-gray-500 mb-1">Previous Hash</p>
                              <p className="font-mono text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 break-all mb-2">{entry.prevHash || '-'}</p>
                            </>
                          )}
                          <p className="text-sm text-gray-500 mb-1">Timestamp</p>
                          <p className="text-sm text-gray-700">{new Date(entry.createdAt).toLocaleString()}</p>
                        </div>
                      )}
                    />
                  </div>

                  {/* Pagination */}
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500">
                      Showing <span className="font-semibold text-gray-700">{(page - 1) * limit + 1}</span> to <span className="font-semibold text-gray-700">{Math.min(page * limit, total)}</span> of <span className="font-semibold text-gray-700">{total}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                      </button>
                      <span className="px-4 py-2 text-sm font-semibold text-gray-600">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      </button>
                      <select
                        value={limit}
                        onChange={(e) => {
                          setLimit(Number(e.target.value));
                          setPage(1);
                        }}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                      >
                        {[25, 50, 100, 200].map((n) => (
                          <option key={n} value={n}>{n}/page</option>
                        ))}
                      </select>
                    </div>
                  </div>

              {/* Legend */}
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-sm text-blue-700">
                  This view prioritizes audit readability. Structured entries show who did what and what changed.
                  Legacy rows can appear as "Legacy Entry" because they were captured before structured metadata was introduced.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
