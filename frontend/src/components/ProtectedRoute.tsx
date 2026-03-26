import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const ProtectedRoute = () => {
  const isAuth = useAuthStore((state) => state.isAuthenticated);

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />; 
};