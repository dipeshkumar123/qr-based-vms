import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

export default function Navbar() {
  const { isAdmin, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobile = () => setMobileMenuOpen(false);

  const navLinks = [
    { to: '/', label: 'Home', always: true },
    { to: '/register', label: 'Register', always: true },
    { to: '/admin/dashboard', label: 'Dashboard', admin: true },
    { to: '/admin/analytics', label: 'Analytics', admin: true },
    { to: '/admin/audit-ledger', label: 'Audit Ledger', admin: true },
    { to: '/admin/notifications', label: 'Notifications', admin: true },
  ];

  const visibleLinks = navLinks.filter(l => l.always || (l.admin && isAdmin));

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100/50 fixed w-full top-0 z-50"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">II</span>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
              II-VMS
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-6">
            {visibleLinks.map(link => (
              <Link key={link.to} to={link.to} className="text-gray-500 hover:text-gray-900 text-sm font-medium transition">{link.label}</Link>
            ))}
            {isAdmin ? (
              <button 
                onClick={logout}
                className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition"
              >
                Logout
              </button>
            ) : (
              <Link 
                to="/admin/login" 
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-sm hover:shadow-md transition"
              >
                Admin Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 p-2 rounded-md hover:bg-gray-100 transition"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-200 shadow-lg overflow-hidden"
          >
            <div className="px-4 py-3 space-y-2">
              {visibleLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeMobile}
                  className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition"
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin ? (
                <button
                  onClick={() => { logout(); closeMobile(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition"
                >
                  Logout
                </button>
              ) : (
                <Link
                  to="/admin/login"
                  onClick={closeMobile}
                  className="block px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center"
                >
                  Admin Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
