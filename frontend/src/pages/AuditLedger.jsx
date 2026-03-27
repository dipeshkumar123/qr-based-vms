import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import apiClient from '../lib/api';

export default function AuditLedger() {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuthStore();
  const [ledger, setLedger] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchLedger();
    verifyLedger();
  }, [isAdmin, navigate]);

  useEffect(() => {
    fetchLedger();
  }, [page, limit]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/ledger', {
        params: { page, limit }
      });
      setLedger(response.data.items || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch ledger:', error);
      if (error.response?.status === 401) {
        logout();
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyLedger = async () => {
    try {
      setVerifying(true);
      const response = await apiClient.get('/api/ledger/verify');
      setVerificationResult(response.data);
    } catch (error) {
      console.error('Failed to verify ledger:', error);
      setVerificationResult({
        ok: false,
        issues: [{ visitorId: -1, index: -1, message: error.message }]
      });
    } finally {
      setVerifying(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Immutable Audit Ledger</h1>
              <p className="text-gray-500 mt-1 text-sm">SHA-256 hash-chain verification & tamper detection</p>
            </div>
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
        </motion.div>

        {/* Verification Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
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
        </motion.div>

        {/* Ledger Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h2 className="text-xl font-bold mb-6">Audit Log Entries</h2>

              {loading ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500 text-sm">Loading audit ledger...</p>
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/80">
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Visitor ID</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Hash (SHA-256)</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-gray-500">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((entry, idx) => (
                          <motion.tr
                            key={idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.03 }}
                            className="border-b border-gray-50 hover:bg-blue-50/50 transition"
                          >
                            <td className="px-4 py-3 text-gray-900 font-semibold text-sm">
                              #{entry.visitorId}
                            </td>
                            <td className="px-4 py-3">
                              <code className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded-lg break-all">
                                {entry.hash}
                              </code>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-sm">
                              {new Date(entry.createdAt).toLocaleString()}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500">
                      Showing <span className="font-semibold text-gray-700">{(page - 1) * limit + 1}</span> to <span className="font-semibold text-gray-700">{Math.min(page * limit, total)}</span> of <span className="font-semibold text-gray-700">{total}</span>
                    </div>
                    <div className="flex gap-2">
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
                    </div>
                  </div>

              {/* Legend */}
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-sm text-blue-700">
                  Each visitor action creates an immutable ledger entry with a SHA-256 hash. 
                  The hash includes the previous hash, creating a tamper-evident chain.
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
