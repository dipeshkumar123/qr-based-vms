import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children }) {
  const { isAdmin, isLoading, validateSession } = useAuthStore();

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}
