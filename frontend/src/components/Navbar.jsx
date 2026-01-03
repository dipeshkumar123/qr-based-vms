import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

export default function Navbar() {
  const { isAdmin, logout } = useAuthStore();

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-white/90 backdrop-blur-md shadow-md fixed w-full top-0 z-50"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">II</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              II-VMS
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-blue-600 transition">Home</Link>
            <Link to="/register" className="text-gray-700 hover:text-blue-600 transition">Register</Link>
            {isAdmin ? (
              <>
                <Link to="/admin/dashboard" className="text-gray-700 hover:text-blue-600 transition">Dashboard</Link>
                <Link to="/admin/analytics" className="text-gray-700 hover:text-blue-600 transition">Analytics</Link>
                <Link to="/admin/audit-ledger" className="text-gray-700 hover:text-blue-600 transition">Audit Ledger</Link>
                <Link to="/admin/notifications" className="text-gray-700 hover:text-blue-600 transition">Notifications</Link>
                <button 
                  onClick={logout}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link 
                to="/admin/login" 
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg transition"
              >
                Admin Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button className="text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
