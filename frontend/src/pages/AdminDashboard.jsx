import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import apiClient from '../lib/api';
import Modal from '../components/Modal';
import QRScanner from '../components/QRScanner';
import BiometricVerification from '../components/BiometricVerification';

/* ─── Toast notification component ─── */
function Toast({ message, type, onClose }) {
  const colors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error:   'bg-red-50 border-red-200 text-red-800',
  };
  const icons = {
    success: (
      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-sm ${colors[type] || colors.error}`}
    >
      {icons[type]}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

/* ─── Confirm dialog component ─── */
function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500">{message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
              <button onClick={onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition">Delete</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Stat card data ─── */
const statCards = [
  { key: 'total', label: 'Total Visitors', color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
  },
  { key: 'registered', label: 'Registered', color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  { key: 'checkedIn', label: 'Checked In', color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  { key: 'checkedOut', label: 'Checked Out', color: 'from-slate-500 to-gray-600', bg: 'bg-gray-50',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuthStore();
  const [visitors, setVisitors] = useState([]);
  const [visitorsTotal, setVisitorsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [stats, setStats] = useState({ total: 0, registered: 0, checkedIn: 0, checkedOut: 0, todayTotal: 0, todayCheckedIn: 0 });

  const [ledger, setLedger] = useState([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visitors');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState('check-in'); // 'check-in' or 'check-out'
  const [scanMessage, setScanMessage] = useState({ type: '', text: '' });
  const [verificationMessage, setVerificationMessage] = useState({ type: '', text: '' });
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' });

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/login');
    }
  }, [isAdmin, navigate]);

  // Debounce search input by 400ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedSearch, ledgerPage, ledgerLimit]);

  const fetchData = async () => {
    try {
      const [visitorsRes, ledgerRes, statsRes] = await Promise.all([
        apiClient.get('/api/visitors', { params: { page, limit, query: debouncedSearch || undefined } }),
        apiClient.get('/api/ledger', { params: { page: ledgerPage, limit: ledgerLimit } }),
        apiClient.get('/api/visitors/stats')
      ]);

      const visitorsWithBiometric = await Promise.all(
        (visitorsRes.data.items || []).map(async (visitor) => {
          if (visitor.biometricEnrolled) return visitor;
          try {
            const infoRes = await apiClient.get(`/api/biometric/info/${visitor.id}`);
            return {
              ...visitor,
              biometricEnrolled: Boolean(infoRes.data?.has_encoding),
            };
          } catch {
            return visitor;
          }
        })
      );

      setVisitors(visitorsWithBiometric);
      setVisitorsTotal(visitorsRes.data.total || 0);
      setLedger(ledgerRes.data.items || []);
      setLedgerTotal(ledgerRes.data.total || 0);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      if (error.response?.status === 401) {
        logout();
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const showToast = useCallback((type, text) => {
    setScanMessage({ type, text });
    setTimeout(() => setScanMessage({ type: '', text: '' }), 5000);
  }, []);

  const handleCheckIn = async (token) => {
    try {
      await apiClient.post(`/api/visitors/${token}/check-in`);
      showToast('success', 'Visitor checked in successfully.');
      fetchData();
    } catch (error) {
      console.error('Check-in failed:', error);
      showToast('error', error.response?.data?.message || 'Failed to check in visitor.');
    }
  };

  const handleCheckOut = async (token) => {
    try {
      await apiClient.post(`/api/visitors/${token}/check-out`);
      showToast('success', 'Visitor checked out successfully.');
      fetchData();
    } catch (error) {
      console.error('Check-out failed:', error);
      showToast('error', error.response?.data?.message || 'Failed to check out visitor.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/api/visitors/${id}`);
      showToast('success', 'Visitor deleted.');
      setConfirmDelete({ open: false, id: null, name: '' });
      fetchData();
    } catch (error) {
      console.error('Delete failed:', error);
      showToast('error', error.response?.data?.message || 'Failed to delete visitor.');
      setConfirmDelete({ open: false, id: null, name: '' });
    }
  };

  const handleScanSuccess = async (token) => {
    try {
      if (scanMode === 'check-in') {
        await apiClient.post(`/api/visitors/${token}/check-in`);
        setScanMessage({ type: 'success', text: '✅ Visitor checked in successfully!' });
      } else {
        await apiClient.post(`/api/visitors/${token}/check-out`);
        setScanMessage({ type: 'success', text: '✅ Visitor checked out successfully!' });
      }
      setShowScanner(false);
      fetchData();
      setTimeout(() => setScanMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error(`${scanMode} failed:`, error);
      const errorMessage = error.response?.data?.message || error.message || `${scanMode} failed`;
      
      if (errorMessage.includes('already checked in')) {
        setScanMessage({ type: 'warning', text: '⚠️ This visitor is already checked in!' });
      } else if (errorMessage.includes('already checked out')) {
        setScanMessage({ type: 'warning', text: '⚠️ This visitor is already checked out!' });
      } else if (errorMessage.includes('not checked in')) {
        setScanMessage({ type: 'warning', text: '⚠️ This visitor must check in first!' });
      } else if (error.response?.status === 404) {
        setScanMessage({ type: 'error', text: '❌ Invalid QR code. Visitor not found.' });
      } else {
        setScanMessage({ type: 'error', text: `❌ ${errorMessage}` });
      }
      
      setShowScanner(false);
      setTimeout(() => setScanMessage({ type: '', text: '' }), 5000);
    }
  };

  const openVerificationModal = (visitor) => {
    setSelectedVisitor(visitor);
    setVerificationMessage({ type: '', text: '' });
    setShowVerificationModal(true);
  };

  const closeVerificationModal = () => {
    setShowVerificationModal(false);
    setSelectedVisitor(null);
  };

  const handleVerificationSuccess = async (result, visitor) => {
    const confidenceText = `${(result.confidence_score * 100).toFixed(1)}% confidence`;
    if (result.is_match) {
      setVisitors((prev) =>
        prev.map((v) => (v.id === visitor.id ? { ...v, biometricVerified: true } : v))
      );
    }
    // Optionally auto-check-in when registered and match is true
    if (visitor.status === 'registered' && result.is_match) {
      try {
        await apiClient.post(`/api/visitors/${visitor.qrToken}/check-in`);
        setVerificationMessage({ type: 'success', text: `✅ Face verified (${confidenceText}) and visitor checked in.` });
        fetchData();
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Check-in failed after verification';
        setVerificationMessage({ type: 'warning', text: `Face verified (${confidenceText}) but check-in failed: ${msg}` });
      }
    } else if (result.is_match) {
      setVerificationMessage({ type: 'success', text: `✅ Face verified (${confidenceText}).` });
    } else {
      setVerificationMessage({ type: 'warning', text: `⚠️ Face did not match (${confidenceText}).` });
    }
    closeVerificationModal();
    setTimeout(() => setVerificationMessage({ type: '', text: '' }), 6000);
  };

  const handleVerificationFailure = (payload) => {
    const message = payload?.message || payload?.error || 'Verification failed. Please try again.';
    setVerificationMessage({ type: 'error', text: `❌ ${message}` });
    closeVerificationModal();
    setTimeout(() => setVerificationMessage({ type: '', text: '' }), 6000);
  };

  const filteredVisitors = visitors; // server-side filtering

  if (loading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 bg-gray-50">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">Admin Dashboard</h1>
                <p className="text-gray-600">Manage visitors and monitor system activity</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
                <button
                  onClick={() => { setScanMode('check-in'); setShowScanner(true); }}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Check In
                </button>
                <button
                  onClick={() => { setScanMode('check-out'); setShowScanner(true); }}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Check Out
                </button>
              </div>
            </div>
          </div>

          {/* Scan / Verification Toasts */}
          <AnimatePresence>
            {scanMessage.text && (
              <div className="mb-6">
                <Toast message={scanMessage.text} type={scanMessage.type} onClose={() => setScanMessage({ type: '', text: '' })} />
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {verificationMessage.text && (
              <div className="mb-6">
                <Toast message={verificationMessage.text} type={verificationMessage.type} onClose={() => setVerificationMessage({ type: '', text: '' })} />
              </div>
            )}
          </AnimatePresence>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {statCards.map((card) => (
              <motion.div
                key={card.key}
                whileHover={{ y: -2 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                    <div className={`bg-gradient-to-br ${card.color} bg-clip-text text-transparent`}>
                      {card.icon}
                    </div>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 stat-number">{stats[card.key]}</p>
              </motion.div>
            ))}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100">
              <div className="flex overflow-x-auto">
                <button
                  onClick={() => setActiveTab('visitors')}
                  className={`px-4 sm:px-6 py-4 font-semibold text-sm transition relative whitespace-nowrap ${
                    activeTab === 'visitors'
                      ? 'text-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Visitors
                  {activeTab === 'visitors' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                </button>
                <button
                  onClick={() => setActiveTab('ledger')}
                  className={`px-4 sm:px-6 py-4 font-semibold text-sm transition relative whitespace-nowrap ${
                    activeTab === 'ledger'
                      ? 'text-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Audit Ledger
                  {activeTab === 'ledger' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'visitors' && (
                <>
                  {/* Info Banner for Biometric Verification */}
                  <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="text-sm text-blue-900">
                      <strong>💡 Biometric Verification:</strong> For visitors with enrolled biometrics (✓ Enrolled), click "Verify Face" to authenticate them via facial recognition. On successful match, they will be automatically checked in.
                    </p>
                  </div>

                  <div className="mb-6">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-gray-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    {filteredVisitors.length === 0 ? (
                      <div className="text-center py-12">
                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20h12a6 6 0 00-6-6 6 6 0 00-6 6z" />
                        </svg>
                        <p className="text-gray-500 text-lg">No visitors found</p>
                        <p className="text-gray-400 text-sm">Registered visitors will appear here</p>
                      </div>
                    ) : (
                      <>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50/80">
                                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-gray-500">Name</th>
                                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-gray-500">Email</th>
                                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-gray-500">Phone</th>
                                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-gray-500">Status</th>
                                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-gray-500">Biometric</th>
                                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-gray-500">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredVisitors.map((visitor) => (
                                <tr key={visitor.id} className="border-b border-gray-50 hover:bg-blue-50/50 transition">
                                  <td className="py-3.5 px-4 font-medium text-gray-900">{visitor.name}</td>
                                  <td className="py-3.5 px-4 text-gray-500 text-sm">{visitor.email}</td>
                                  <td className="py-3.5 px-4 text-gray-500 text-sm">{visitor.phone}</td>
                                  <td className="py-3.5 px-4">
                                    <span
                                      className={`badge ${
                                        visitor.status === 'checked_in'
                                          ? 'badge-success'
                                          : visitor.status === 'checked_out'
                                          ? 'badge-neutral'
                                          : 'badge-warning'
                                      }`}
                                    >
                                      {visitor.status === 'checked_in'
                                        ? 'Checked In'
                                        : visitor.status === 'checked_out'
                                        ? 'Checked Out'
                                        : 'Registered'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    {visitor.biometricEnrolled ? (
                                      <span className="badge badge-success">Enrolled</span>
                                    ) : (
                                      <span className="badge badge-neutral">None</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex gap-1.5 flex-wrap">
                                      {(() => {
                                        const isVerified = Boolean(visitor.biometricVerified);
                                        const canVerify = Boolean(visitor.biometricEnrolled) && !isVerified;
                                        return (
                                          <button
                                            onClick={() => openVerificationModal(visitor)}
                                            disabled={!canVerify}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                              isVerified
                                                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                                : canVerify
                                                ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            }`}
                                            title={isVerified ? 'Already verified' : visitor.biometricEnrolled ? 'Verify face' : 'Not enrolled'}
                                          >
                                            {isVerified ? 'Verified' : 'Verify'}
                                          </button>
                                        );
                                      })()}
                                      {visitor.status === 'registered' && (
                                        <button
                                          onClick={() => handleCheckIn(visitor.qrToken)}
                                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-semibold transition"
                                        >
                                          Check In
                                        </button>
                                      )}
                                      {visitor.status === 'checked_in' && (
                                        <button
                                          onClick={() => handleCheckOut(visitor.qrToken)}
                                          className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-xs font-semibold transition"
                                        >
                                          Check Out
                                        </button>
                                      )}
                                      <button
                                        onClick={() => setConfirmDelete({ open: true, id: visitor.id, name: visitor.name })}
                                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs font-semibold transition"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="md:hidden space-y-3">
                          {filteredVisitors.map((visitor) => {
                            const isVerified = Boolean(visitor.biometricVerified);
                            const canVerify = Boolean(visitor.biometricEnrolled) && !isVerified;
                            return (
                              <div key={visitor.id} className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div>
                                    <p className="font-semibold text-gray-900 leading-tight">{visitor.name}</p>
                                    <p className="text-xs text-gray-500 break-all">{visitor.email}</p>
                                    <p className="text-xs text-gray-500">{visitor.phone}</p>
                                  </div>
                                  <span
                                    className={`badge ${
                                      visitor.status === 'checked_in'
                                        ? 'badge-success'
                                        : visitor.status === 'checked_out'
                                        ? 'badge-neutral'
                                        : 'badge-warning'
                                    }`}
                                  >
                                    {visitor.status === 'checked_in'
                                      ? 'Checked In'
                                      : visitor.status === 'checked_out'
                                      ? 'Checked Out'
                                      : 'Registered'}
                                  </span>
                                </div>

                                <div className="mb-3">
                                  {visitor.biometricEnrolled ? (
                                    <span className="badge badge-success">Enrolled</span>
                                  ) : (
                                    <span className="badge badge-neutral">None</span>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => openVerificationModal(visitor)}
                                    disabled={!canVerify}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                      isVerified
                                        ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                        : canVerify
                                        ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={isVerified ? 'Already verified' : visitor.biometricEnrolled ? 'Verify face' : 'Not enrolled'}
                                  >
                                    {isVerified ? 'Verified' : 'Verify'}
                                  </button>
                                  {visitor.status === 'registered' && (
                                    <button
                                      onClick={() => handleCheckIn(visitor.qrToken)}
                                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-semibold transition"
                                    >
                                      Check In
                                    </button>
                                  )}
                                  {visitor.status === 'checked_in' && (
                                    <button
                                      onClick={() => handleCheckOut(visitor.qrToken)}
                                      className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-xs font-semibold transition"
                                    >
                                      Check Out
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setConfirmDelete({ open: true, id: visitor.id, name: visitor.name })}
                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs font-semibold transition"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Pagination */}
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                    <div className="text-sm text-gray-500">
                      Showing <span className="font-semibold text-gray-700">{filteredVisitors.length === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="font-semibold text-gray-700">{Math.min(page * limit, visitorsTotal)}</span> of <span className="font-semibold text-gray-700">{visitorsTotal}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                      <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                      </button>
                      <span className="px-4 py-2 text-sm font-semibold text-gray-600">{page} / {Math.max(1, Math.ceil(visitorsTotal / limit))}</span>
                      <button disabled={page >= Math.ceil(visitorsTotal / limit)} onClick={() => setPage(p => p + 1)} className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      </button>
                      <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
                        {[10,20,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'ledger' && (
                <div>
                  {ledger.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 text-lg">No ledger entries yet</p>
                      <p className="text-gray-400 text-sm">Visitor actions will appear here</p>
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left py-4 px-4 font-semibold text-gray-700">Visitor ID</th>
                              <th className="text-left py-4 px-4 font-semibold text-gray-700">Hash</th>
                              <th className="text-left py-4 px-4 font-semibold text-gray-700">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledger.map((entry, idx) => (
                              <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50 transition">
                                <td className="py-4 px-4 font-semibold text-gray-900">{entry.visitorId}</td>
                                <td className="py-4 px-4 font-mono text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 inline-block">{entry.hash.substring(0, 16)}...</td>
                                <td className="py-4 px-4 text-gray-600 text-sm">{new Date(entry.createdAt).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="md:hidden space-y-3">
                        {ledger.map((entry, idx) => (
                          <div key={idx} className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm">
                            <p className="text-sm text-gray-500 mb-1">Visitor ID</p>
                            <p className="font-semibold text-gray-900 mb-2">{entry.visitorId}</p>
                            <p className="text-sm text-gray-500 mb-1">Hash</p>
                            <p className="font-mono text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 break-all mb-2">{entry.hash}</p>
                            <p className="text-sm text-gray-500 mb-1">Timestamp</p>
                            <p className="text-sm text-gray-700">{new Date(entry.createdAt).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                        <div className="text-sm text-gray-500">
                          Showing <span className="font-semibold text-gray-700">{(ledgerPage - 1) * ledgerLimit + 1}</span> to <span className="font-semibold text-gray-700">{Math.min(ledgerPage * ledgerLimit, ledgerTotal)}</span> of <span className="font-semibold text-gray-700">{ledgerTotal}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                          <button disabled={ledgerPage <= 1} onClick={() => setLedgerPage(p => Math.max(1, p - 1))} className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                          </button>
                          <span className="px-4 py-2 text-sm font-semibold text-gray-600">{ledgerPage} / {Math.max(1, Math.ceil(ledgerTotal / ledgerLimit))}</span>
                          <button disabled={ledgerPage > Math.max(1, Math.ceil(ledgerTotal / ledgerLimit))} onClick={() => setLedgerPage(p => p + 1)} className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                          </button>
                          <select value={ledgerLimit} onChange={(e) => { setLedgerLimit(Number(e.target.value)); setLedgerPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
                            {[25,50,100,200].map(n => <option key={n} value={n}>{n}/page</option>)}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* QR Scanner Modal */}
      <Modal 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)}
        title={scanMode === 'check-in' ? 'Check-in Visitor' : 'Check-out Visitor'}
      >
        <QRScanner 
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      </Modal>

      {/* Biometric Verification Modal */}
      <Modal
        isOpen={showVerificationModal && !!selectedVisitor}
        onClose={closeVerificationModal}
        title={selectedVisitor ? `Verify ${selectedVisitor.name}` : 'Verify Visitor'}
      >
        {selectedVisitor && (
          <BiometricVerification
            visitor={selectedVisitor}
            onVerified={(result) => handleVerificationSuccess(result, selectedVisitor)}
            onFailed={handleVerificationFailure}
            onClose={closeVerificationModal}
          />
        )}
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDelete.open}
        title="Delete Visitor"
        message={`Are you sure you want to delete "${confirmDelete.name}"? This action cannot be undone.`}
        onConfirm={() => handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete({ open: false, id: null, name: '' })}
      />
    </div>
  );
}
