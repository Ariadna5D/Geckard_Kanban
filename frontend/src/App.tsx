import React, { useMemo } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";

import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./store/useAuthStore";


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
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);

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
        { path: "/dashboard", element: <DashboardPage /> }
      ],
    },
    {
      path: "*",
      element: <RootRedirect />,
    },
  ]), [_hasHydrated]); 

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
};

export default App;