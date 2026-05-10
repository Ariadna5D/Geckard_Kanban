import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../comons/NavBar';

export const MainLayout = () => {
  const { pathname } = useLocation();
  const isBoardView = pathname.startsWith('/boards/');
  let mainClassName = 'mx-auto w-full max-w-7xl flex-1';
  if (isBoardView) {
    // En vista tablero usamos ancho completo para drag and drop comodo
    mainClassName = 'flex min-h-0 w-full flex-1 flex-col';
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-100 dark:bg-surface-950">
      <Navbar />
      <main className={mainClassName}>
        <Outlet />
      </main>
    </div>
  );
};