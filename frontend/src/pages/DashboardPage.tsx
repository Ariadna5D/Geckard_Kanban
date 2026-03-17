import { useAuthStore } from '../store/useAuthStore';
import { LogOut, LayoutDashboard, Trophy } from 'lucide-react';

export const DashboardPage = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar sencillo */}
      <nav className="flex justify-between items-center p-4 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="text-blue-600" />
          <span className="font-bold text-xl text-slate-800">TFG Kanban</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full">
            <Trophy size={18} className="text-yellow-600" />
            <span className="text-sm font-bold text-yellow-700">
              {user?.experiencePoints} XP
            </span>
          </div>
          
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-slate-600 hover:text-red-600 transition"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </nav>

      <main className="p-8">
        <h2 className="text-3xl font-bold text-slate-800">¡Hola de nuevo, {user?.email}!</h2>
        <p className="text-slate-500 mt-2">Bienvenido a tu sistema de gestión gamificado.</p>
        
        <div className="mt-10 p-20 border-2 border-dashed border-slate-200 rounded-3xl text-center">
          <p className="text-slate-400">Aquí irán tus tableros de Trello muy pronto...</p>
        </div>
      </main>
    </div>
  );
};