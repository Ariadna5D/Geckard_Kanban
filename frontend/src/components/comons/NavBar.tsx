import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Search,
  Sparkles,
  User as UserIcon,
  LayoutDashboard,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  userAvatarFallbackClass,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/useAuthStore';
import { useBoardStore } from '@/store/useBoardStore';
import { BrandMark } from '@/components/comons/BrandMark';
import { Button } from '@/components/ui/button';
import { NotificationsBell } from '@/components/comons/NotificationsBell';

const HEADER_BOARD_SEARCH_MAX_RESULTS = 6;

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuthStore();
  const boards = useBoardStore((state) => state.boards);
  const fetchBoards = useBoardStore((state) => state.fetchBoards);
  const navigate = useNavigate();
  const [boardSearchText, setBoardSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    // Cargamos tableros una vez para habilitar busqueda rapdia en cabecera
    if (isAuthenticated && boards.length === 0) {
      void fetchBoards();
    }
  }, [isAuthenticated, boards.length, fetchBoards]);

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

  function handleOpenBoardFromSearch(boardSlug: string) {
    // Al abrir desde buscador limpiamos estado para siguiente busqueda
    setBoardSearchText('');
    setSearchOpen(false);
    navigate(`/boards/${boardSlug}`);
  }

  const normalizedSearch = boardSearchText.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (normalizedSearch === '') {
      return [];
    }
    return boards
      .filter((board) => {
        const title = board.title.toLowerCase();
        const slug = board.slug.toLowerCase();
        return title.includes(normalizedSearch) || slug.includes(normalizedSearch);
      })
      .slice(0, HEADER_BOARD_SEARCH_MAX_RESULTS);
  }, [boards, normalizedSearch]);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.trim().charAt(0).toUpperCase() || 'U';
  };

  return (
    <nav className="sticky top-0 z-50 flex min-h-17 items-center justify-between border-b border-surface-200 bg-surface-50/95 px-4 py-3 backdrop-blur-sm dark:border-surface-800 dark:bg-surface-900/95 sm:min-h-18 sm:px-5">
      <div
        onClick={handleGoToDashboard}
        className="cursor-pointer transition-opacity hover:opacity-90"
      >
        <BrandMark imgClassName="h-9 w-auto sm:h-10" />
      </div>

      <div className="mx-4 hidden min-w-0 flex-1 justify-center md:flex">
        <div className="relative w-full max-w-xl">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-surface-500 dark:text-surface-400"
            aria-hidden
          />
          <input
            type="search"
            value={boardSearchText}
            onChange={(event) => {
              setBoardSearchText(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => {
              // Retraso corto para dejar click en resultados antes de cerrar
              window.setTimeout(() => setSearchOpen(false), 120);
            }}
            placeholder="Buscar tablero"
            aria-label="Buscar tablero rápido"
            className="h-10 w-full rounded-lg border border-surface-300 bg-surface-50 pl-9 pr-3 text-sm text-surface-800 outline-none transition focus:border-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:focus:border-primary-400"
          />
          {searchOpen && normalizedSearch !== '' ? (
            <div className="absolute top-12 z-50 w-full overflow-hidden rounded-lg border border-surface-200 bg-surface-50 shadow-lg dark:border-surface-700 dark:bg-surface-900">
              {searchResults.length > 0 ? (
                <ul className="max-h-72 overflow-y-auto py-1">
                  {searchResults.map((board) => (
                    <li key={board._id}>
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          // Evita perder foco antes de procesar click en resultado
                          event.preventDefault();
                        }}
                        onClick={() => handleOpenBoardFromSearch(board.slug)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-surface-800 transition hover:bg-surface-100 dark:text-surface-100 dark:hover:bg-surface-800"
                      >
                        <span className="truncate">{board.title}</span>
                        <span className="shrink-0 text-xs text-surface-500 dark:text-surface-400">
                          {board.slug}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-sm text-surface-500 dark:text-surface-400">
                  No hay coincidencias.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="default"
          onClick={handleGoToPlans}
          className="hidden h-11 min-h-11 shrink-0 gap-2 rounded-xl px-4 font-semibold shadow-md sm:inline-flex sm:h-11 sm:min-h-11 sm:px-5"
        >
          <Sparkles className="size-5 shrink-0 sm:size-5" aria-hidden />
          <span className="max-w-40 leading-tight sm:max-w-none">
            Comprar plan
          </span>
        </Button>

        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar className="size-11 cursor-pointer border-2 border-transparent shadow-sm transition-[border-color,box-shadow] hover:border-primary-500/50 hover:ring-2 hover:ring-primary-500/25 dark:hover:border-primary-400/45 dark:hover:ring-primary-400/20">
              <AvatarImage
                src={user?.avatarUrl || ''}
                alt="Avatar"
                className="object-cover"
              />
              <AvatarFallback
                className={`${userAvatarFallbackClass} text-sm`}
              >
                {getInitials(user?.username || '')}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="mt-2 w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-base font-medium leading-none">
                  {user?.username}
                </p>
                <p className="truncate text-sm leading-none text-surface-500 dark:text-surface-400">
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