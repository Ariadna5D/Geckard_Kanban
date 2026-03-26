import { Outlet } from 'react-router-dom';
import { Navbar } from '../comons/NavBar';

export const MainLayout = () => {
  return (
    <div className="min-h-screen bg-slate-150 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};