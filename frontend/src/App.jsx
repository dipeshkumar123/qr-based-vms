import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import LandingPage from './pages/LandingPage';
import VisitorRegistration from './pages/VisitorRegistration';
import AdminLogin from './pages/AdminLogin';
import ProtectedRoute from './components/ProtectedRoute';
import NotFoundPage from './pages/NotFoundPage';

// Lazy load heavy admin pages to reduce initial bundle size
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AuditLedger = lazy(() => import('./pages/AuditLedger'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">
            <Suspense fallback={<LoadingSpinner fullScreen />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/register" element={<VisitorRegistration />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/audit-ledger" element={<ProtectedRoute><AuditLedger /></ProtectedRoute>} />
                <Route path="/admin/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
                <Route path="/admin/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
