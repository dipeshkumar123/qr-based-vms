import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children }) {
  const { isAdmin } = useAuthStore();
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}
