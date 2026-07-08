import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
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

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100/50 fixed w-full top-0 z-50">
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
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `text-sm font-medium transition ${isActive ? 'text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {link.label}
              </NavLink>
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
          <div className="md:hidden flex items-center gap-2">
            <NavLink
              to="/register"
              className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold active:scale-[0.98] transition"
            >
              Register
            </NavLink>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
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
          <div className="md:hidden bg-white border-t border-gray-200 shadow-xl overflow-hidden">
            <div className="px-4 py-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {visibleLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={closeMobile}
                  className={({ isActive }) => `block px-4 py-3 rounded-xl text-sm font-semibold transition active:scale-[0.99] ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  {link.label}
                </NavLink>
              ))}
              {isAdmin ? (
                <button
                  onClick={() => { logout(); closeMobile(); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Logout
                </button>
              ) : (
                <Link
                  to="/admin/login"
                  onClick={closeMobile}
                  className="block px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center text-sm font-semibold"
                >
                  Admin Login
                </Link>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </nav>
  );
}
