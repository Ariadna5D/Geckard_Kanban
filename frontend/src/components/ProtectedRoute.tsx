import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const ProtectedRoute = () => {
  const isAuth = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  if (!hasHydrated) {
    // Esperamos a que zustand recupere sesion antes de decidir redireccion
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100 dark:bg-surface-950">
        <div className="size-8 animate-spin rounded-full border-2 border-surface-200 border-t-primary-600 dark:border-surface-800 dark:border-t-primary-500" />
      </div>
    );
  }

  if (!isAuth) {
    // Si no hay sesion activa, volvemos al login
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};