import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../comons/NavBar';

export const MainLayout = () => {
  const { pathname } = useLocation();
  const isBoardView = pathname.startsWith('/boards/');

  return (
    <div className="flex min-h-screen flex-col bg-surface-100 dark:bg-surface-950">
      <Navbar />
      <main
        className={
          isBoardView
            ? 'flex min-h-0 w-full flex-1 flex-col'
            : 'mx-auto w-full max-w-7xl flex-1'
        }
      >
        <Outlet />
      </main>
    </div>
  );
};