import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, LayoutDashboard } from 'lucide-react';

// Importamos el Avatar que ya teníamos
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// Importamos todas las piezas del menú desplegable que acabas de descargar
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from '@/store/useAuthStore';

export const Navbar = () => {
  // Sacamos los datos del usuario y la función para desloguear
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Función para cerrar sesión y echar al usuario al login
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Reutilizamos tu función de iniciales elegantes
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const matches = name.match(/[A-Z]/g);
    if (matches && matches.length >= 2) return `${matches[0]}${matches[1]}`;
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-50">
      
      <div 
        onClick={() => navigate('/dashboard')}
        className="font-bold text-xl cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span className="text-slate-800">Axi</span>
        <span className="text-accent-600">Up</span>
      </div>

      {/* MENÚ DESPLEGABLE DEL USUARIO */}
      <DropdownMenu>
        
        <DropdownMenuTrigger className="outline-none">
          <Avatar className="w-10 h-10 border-2 border-transparent hover:border-primary-300 transition-colors cursor-pointer shadow-sm">
            <AvatarImage src={user?.avatarUrl || ''} alt="Avatar" className="object-cover" />
            <AvatarFallback className="text-sm font-semibold bg-slate-800 text-white">
              {getInitials(user?.username || '')}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 mt-2">
          
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.username}</p>
              <p className="text-xs leading-none text-slate-500 truncate">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {/* Opciones del menú */}
          <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer py-2">
            <LayoutDashboard className="mr-2 h-4 w-4 text-slate-500" />
            <span>Dashboard</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer py-2">
            <UserIcon className="mr-2 h-4 w-4 text-slate-500" />
            <span>Mi Perfil</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer py-2 text-red-600 focus:text-red-600 focus:bg-red-50">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>

    </nav>
  );
};