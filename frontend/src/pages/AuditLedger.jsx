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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Immutable Audit Ledger</h1>
              <p className="text-gray-600 mt-2">SHA-256 Hash Verification & Tamper Detection</p>
            </div>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Dashboard
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
              className={`rounded-lg shadow-lg p-6 border-l-4 ${
                verificationResult.ok
                  ? 'bg-green-50 border-green-500'
                  : 'bg-red-50 border-red-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-2">
                    {verificationResult.ok ? '✅ Ledger Integrity Verified' : '🚨 Tampering Detected'}
                  </h2>
                  <p className={verificationResult.ok ? 'text-green-800' : 'text-red-800'}>
                    {verificationResult.ok
                      ? 'All hash chains are valid. No tampering detected.'
                      : `${verificationResult.issues?.length || 0} integrity issues found`}
                  </p>

                  {!verificationResult.ok && verificationResult.issues?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h3 className="font-semibold text-red-900">Security Alerts:</h3>
                      {verificationResult.issues.map((issue, idx) => (
                        <div key={idx} className="text-sm text-red-800 bg-red-100 p-2 rounded">
                          <strong>Visitor ID {issue.visitorId}</strong> (Entry #{issue.index}): {issue.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={verifyLedger}
                  disabled={verifying}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    verifying
                      ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {verifying ? 'Verifying...' : 'Verify Again'}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Ledger Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <h2 className="text-2xl font-bold mb-6">Audit Log Entries</h2>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block">
                    <svg className="w-12 h-12 animate-spin text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V2m0 20v-4m10.39-2.61H22m-20 0H2m14.78-5.39l2.83-2.83M6.39 19.39l2.83-2.83m0-11.18L6.39 2.56m11.18 11.18l2.83 2.83" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mt-4">Loading audit ledger...</p>
                </div>
              ) : ledger.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 text-lg">No audit log entries yet</p>
                  <p className="text-gray-400 text-sm">Visitor actions will be recorded here</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Visitor ID</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Hash (SHA-256)</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((entry, idx) => (
                          <motion.tr
                            key={idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'} 
                          >
                            <td className="px-4 py-3 text-gray-900 font-semibold">
                              #{entry.visitorId}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                              <code className="bg-gray-100 px-2 py-1 rounded break-all">
                                {entry.hash}
                              </code>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-sm">
                              {new Date(entry.createdAt).toLocaleString()}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                      Showing <span className="font-semibold">{(page - 1) * limit + 1}</span> to <span className="font-semibold">{Math.min(page * limit, total)}</span> of <span className="font-semibold">{total}</span> entries
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                      >
                        ← Previous
                      </button>
                      <span className="px-4 py-2 bg-gray-100 rounded font-semibold text-gray-700">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                      >
                        Next →
                      </button>
                    </div>
                  </div>

              {/* Legend */}
              <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>How it works:</strong> Each visitor action (registration, check-in, check-out) creates an immutable ledger entry with a SHA-256 hash. 
                  The hash includes the previous hash, creating a tamper-evident chain. Any modification to past entries would break the chain and be immediately detected.
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
