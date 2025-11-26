import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import apiClient from '../lib/api';
import Modal from '../components/Modal';
import QRScanner from '../components/QRScanner';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuthStore();
  const [visitors, setVisitors] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visitors');
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState('check-in'); // 'check-in' or 'check-out'
  const [scanMessage, setScanMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchData();
  }, [isAdmin, navigate]);

  const fetchData = async () => {
    try {
      const [visitorsRes, ledgerRes] = await Promise.all([
        apiClient.get('/api/visitors'),
        apiClient.get('/api/ledger')
      ]);
      setVisitors(visitorsRes.data);
      setLedger(ledgerRes.data);
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

  const handleCheckIn = async (token) => {
    try {
      await apiClient.post(`/api/visitors/${token}/check-in`);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Check-in failed:', error);
      alert('Failed to check in visitor');
    }
  };

  const handleCheckOut = async (token) => {
    try {
      await apiClient.post(`/api/visitors/${token}/check-out`);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Check-out failed:', error);
      alert('Failed to check out visitor');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this visitor?')) return;
    
    try {
      await apiClient.delete(`/api/visitors/${id}`);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete visitor');
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

  const filteredVisitors = visitors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.phone.includes(searchTerm)
  );

  const stats = {
    total: visitors.length,
    registered: visitors.filter(v => v.status === 'registered').length,
    checkedIn: visitors.filter(v => v.status === 'checked_in').length,
    checkedOut: visitors.filter(v => v.status === 'checked_out').length,
  };

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
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
                <p className="text-gray-600">Manage visitors and monitor system activity</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setScanMode('check-in'); setShowScanner(true); }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Check In
                </button>
                <button
                  onClick={() => { setScanMode('check-out'); setShowScanner(true); }}
                  className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:shadow-lg transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Check Out
                </button>
              </div>
            </div>
          </div>

          {/* Scan Message */}
          {scanMessage.text && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 px-4 py-3 rounded-lg font-medium ${
                scanMessage.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : scanMessage.type === 'warning'
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {scanMessage.text}
            </motion.div>
          )}

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Visitors</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Registered</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.registered}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Checked In</p>
                  <p className="text-3xl font-bold text-green-600">{stats.checkedIn}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Checked Out</p>
                  <p className="text-3xl font-bold text-gray-600">{stats.checkedOut}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👋</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-lg">
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('visitors')}
                  className={`px-6 py-4 font-semibold transition ${
                    activeTab === 'visitors'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Visitors
                </button>
                <button
                  onClick={() => setActiveTab('ledger')}
                  className={`px-6 py-4 font-semibold transition ${
                    activeTab === 'ledger'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Audit Ledger
                </button>
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'visitors' && (
                <>
                  <div className="mb-6">
                    <input
                      type="text"
                      placeholder="Search by name, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Purpose</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVisitors.map((visitor) => (
                          <tr key={visitor.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">{visitor.name}</td>
                            <td className="py-3 px-4">{visitor.email}</td>
                            <td className="py-3 px-4">{visitor.phone}</td>
                            <td className="py-3 px-4">{visitor.purpose}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  visitor.status === 'checked_in'
                                    ? 'bg-green-100 text-green-700'
                                    : visitor.status === 'checked_out'
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {visitor.status === 'checked_in' 
                                  ? 'Checked In' 
                                  : visitor.status === 'checked_out'
                                  ? 'Checked Out'
                                  : 'Registered'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                {visitor.status === 'registered' && (
                                  <button
                                    onClick={() => handleCheckIn(visitor.qrToken)}
                                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                  >
                                    Check In
                                  </button>
                                )}
                                {visitor.status === 'checked_in' && (
                                  <button
                                    onClick={() => handleCheckOut(visitor.qrToken)}
                                    className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                                  >
                                    Check Out
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(visitor.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
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
                </>
              )}

              {activeTab === 'ledger' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Visitor ID</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Hash</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((entry, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">{entry.visitorId}</td>
                          <td className="py-3 px-4 font-mono text-sm">{entry.hash.substring(0, 16)}...</td>
                          <td className="py-3 px-4">{new Date(entry.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
    </div>
  );
}
