import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Wraps routes that require auth. If `role` is provided, also enforces role match.
export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (role && user?.role !== role) {
    // Redirect to their own dashboard if the role doesn't match.
    const dest = user?.role === 'farmer' ? '/farmer' : '/buyer';
    return <Navigate to={dest} replace />;
  }
  return children;
}
