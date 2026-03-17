import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/useAuthStore';

export const App = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const router = createBrowserRouter([
    {
      path: '/login',
      element: !isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />,
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: '/dashboard',
          element: <DashboardPage />,
        },
      ],
    },
    {
      path: '*',
      element: <Navigate to={isAuthenticated ? "/dashboard" : "/login"} />,
    },
  ]);

  return <RouterProvider router={router} />;
};