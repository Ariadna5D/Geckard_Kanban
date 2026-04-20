import React, { useEffect, useMemo } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";

import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { BoardPage } from "./pages/BoardPage"; // IMPORTANTE: Importar la página
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./store/useAuthStore";
import { ProfilePage } from "./pages/ProfilePage";
import { MainLayout } from './components/layouts/MainLayout';
import { BillingPlansPage } from './pages/BillingPlansPage';
import { BillingSuccessPage } from './pages/BillingSuccessPage';
import { BillingCancelPage } from './pages/BillingCancelPage';

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);
  if (!_hasHydrated) return null;
  return !isAuthenticated ? (children as React.ReactElement) : <Navigate to="/dashboard" replace />;
};

function RootRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);
  if (!_hasHydrated) return null;
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

export const App = () => {
  const { _hasHydrated, fetchUser, token } = useAuthStore();

  useEffect(() => {
    if (_hasHydrated && token) {
      fetchUser();
    }
  }, [_hasHydrated, token, fetchUser]); 

  const router = useMemo(() => createBrowserRouter([
    {
      path: "/login",
      element: <PublicRoute><LoginPage /></PublicRoute>,
    },
    {
      path: "/register",
      element: <PublicRoute><RegisterPage /></PublicRoute>,
    },
    {
      element: <ProtectedRoute />, 
      children: [
        {
          element: <MainLayout />, 
          children: [
            { path: "/dashboard", element: <DashboardPage /> },
            { path: "/profile", element: <ProfilePage /> },
            { path: "/boards/:slug", element: <BoardPage /> }, 
            { path: "/billing/plans", element: <BillingPlansPage /> },
            { path: "/billing/success", element: <BillingSuccessPage /> },
            { path: "/billing/cancel", element: <BillingCancelPage /> },
          ],
        }
      ],
    },
    {
      path: "*",
      element: <RootRedirect />,
    },
  ]), []);

  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100 dark:bg-surface-950">
        <div className="size-12 animate-spin rounded-full border-2 border-surface-200 border-t-primary-600 dark:border-surface-800 dark:border-t-primary-500" />
      </div>
    );
  }

  return <RouterProvider router={router} />;
};

export default App;