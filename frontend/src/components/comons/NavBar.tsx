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
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-surface-200 bg-surface-50/95 p-4 backdrop-blur-sm dark:border-surface-800 dark:bg-surface-900/95">
      
      <div 
        onClick={() => navigate('/dashboard')}
        className="cursor-pointer text-xl font-bold transition-opacity hover:opacity-90"
      >
        <span className="text-surface-900 dark:text-surface-50">Axi</span>
        <span className="text-primary-600 dark:text-primary-400">Up</span>
      </div>

      {/* MENÚ DESPLEGABLE DEL USUARIO */}
      <DropdownMenu>
        
        <DropdownMenuTrigger className="outline-none">
          <Avatar className="size-10 cursor-pointer border-2 border-transparent shadow-sm transition-[border-color,box-shadow] hover:border-primary-500/50 hover:ring-2 hover:ring-primary-500/25 dark:hover:border-primary-400/45 dark:hover:ring-primary-400/20">
            <AvatarImage src={user?.avatarUrl || ''} alt="Avatar" className="object-cover" />
            <AvatarFallback className="bg-surface-600 text-sm font-semibold text-white dark:bg-surface-700">
              {getInitials(user?.username || '')}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 mt-2">
          
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.username}</p>
              <p className="truncate text-xs leading-none text-surface-500 dark:text-surface-400">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {/* Opciones del menú */}
          <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer py-2">
            <LayoutDashboard className="mr-2 size-4 text-surface-500 dark:text-surface-400" />
            <span>Dashboard</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer py-2">
            <UserIcon className="mr-2 size-4 text-surface-500 dark:text-surface-400" />
            <span>Mi Perfil</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer py-2 text-danger focus:bg-danger/10 focus:text-danger">
            <LogOut className="mr-2 size-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>

    </nav>
  );
};