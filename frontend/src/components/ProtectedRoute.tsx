import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const ProtectedRoute = () => {
  const isAuth = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100 dark:bg-surface-950">
        <div className="size-8 animate-spin rounded-full border-2 border-surface-200 border-t-primary-600 dark:border-surface-800 dark:border-t-primary-500" />
      </div>
    );
  }

  // Ahora sí, si ya leyó la memoria y no estás logueado, a la calle
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />; 
};