import { Outlet } from 'react-router-dom';
import { Navbar } from '../comons/NavBar';

export const MainLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-surface-100 dark:bg-surface-950">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};