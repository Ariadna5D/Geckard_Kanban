import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Sparkles,
  User as UserIcon,
  LayoutDashboard,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/useAuthStore';
import { BrandMark } from '@/components/comons/BrandMark';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  function handleGoToDashboard() {
    navigate('/dashboard');
  }

  function handleGoToProfile() {
    navigate('/profile');
  }

  function handleGoToPlans() {
    navigate('/billing/plans');
  }

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const matches = name.match(/[A-Z]/g);
    if (matches && matches.length >= 2) return `${matches[0]}${matches[1]}`;
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-50 flex min-h-[4.25rem] items-center justify-between border-b border-surface-200 bg-surface-50/95 px-4 py-3 backdrop-blur-sm dark:border-surface-800 dark:bg-surface-900/95 sm:min-h-[4.5rem] sm:px-5">
      <div
        onClick={handleGoToDashboard}
        className="cursor-pointer transition-opacity hover:opacity-90"
      >
        <BrandMark imgClassName="h-9 w-auto sm:h-10" />
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="default"
          onClick={handleGoToPlans}
          className="hidden h-11 min-h-11 shrink-0 gap-2 rounded-xl px-4 text-sm font-semibold shadow-md sm:inline-flex sm:h-12 sm:min-h-12 sm:px-5"
        >
          <Sparkles className="size-5 shrink-0 sm:size-[1.35rem]" aria-hidden />
          <span className="max-w-[9.5rem] leading-tight sm:max-w-none">
            Comprar plan
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar className="size-10 cursor-pointer border-2 border-transparent shadow-sm transition-[border-color,box-shadow] hover:border-primary-500/50 hover:ring-2 hover:ring-primary-500/25 dark:hover:border-primary-400/45 dark:hover:ring-primary-400/20">
              <AvatarImage
                src={user?.avatarUrl || ''}
                alt="Avatar"
                className="object-cover"
              />
              <AvatarFallback className="bg-surface-600 text-sm font-semibold text-white dark:bg-surface-700">
                {getInitials(user?.username || '')}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="mt-2 w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.username}
                </p>
                <p className="truncate text-xs leading-none text-surface-500 dark:text-surface-400">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleGoToDashboard}
              className="cursor-pointer py-2"
            >
              <LayoutDashboard className="mr-2 size-4 text-surface-500 dark:text-surface-400" />
              <span>Dashboard</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleGoToProfile}
              className="cursor-pointer py-2"
            >
              <UserIcon className="mr-2 size-4 text-surface-500 dark:text-surface-400" />
              <span>Mi Perfil</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleGoToPlans}
              className="cursor-pointer py-2"
            >
              <Sparkles className="mr-2 size-4 text-primary-600 dark:text-primary-400" />
              <span>Planes</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer py-2 text-danger focus:bg-danger/10 focus:text-danger"
            >
              <LogOut className="mr-2 size-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};