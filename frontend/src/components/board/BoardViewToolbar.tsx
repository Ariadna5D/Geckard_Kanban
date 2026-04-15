import { type ChangeEvent } from 'react';
import { ArrowUpDown, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import type { TaskPriority } from '@/types/board.types';
import type {
  BoardSortDirection,
  BoardTaskFilter,
  BoardTaskSortKey,
} from '@/utils/boardTaskView';
import {
  isBoardFilterActive,
  isBoardSortActive,
  shouldLockTaskDrag,
} from '@/utils/boardTaskView';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

type BoardViewToolbarProps = {
  taskFilter: BoardTaskFilter;
  onTaskFilterChange: (next: BoardTaskFilter) => void;
  sortKey: BoardTaskSortKey;
  onSortChange: (key: BoardTaskSortKey, dir: BoardSortDirection) => void;
};

/**
 * Controles de vista del tablero: menú de filtros y menú de ordenación.
 * La lógica de qué hace cada opción vive en `utils/boardTaskView.ts`.
 */
export function BoardViewToolbar({
  taskFilter,
  onTaskFilterChange,
  sortKey,
  onSortChange,
}: BoardViewToolbarProps) {
  const filterActive = isBoardFilterActive(taskFilter);
  const sortActive = isBoardSortActive(sortKey);
  const dragLocked = shouldLockTaskDrag(taskFilter, sortKey);

  function handleTitleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onTaskFilterChange({ kind: 'title', query: event.target.value });
  }

  return (
    <div className="flex max-w-full flex-col gap-1 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* --- Menú filtro --- */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
              aria-label="Filtrar tareas del tablero"
              title="Filtrar"
            >
              <ListFilter className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Filtro</span>
              {filterActive && (
                <span className="size-1.5 rounded-full bg-primary-500" aria-hidden />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onTaskFilterChange({ kind: 'all' })}>
              Todas las tareas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Prioridad</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PRIORITY_OPTIONS.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => onTaskFilterChange({ kind: 'priority', value })}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              onClick={() => onTaskFilterChange({ kind: 'unassigned' })}
            >
              Sin asignar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onTaskFilterChange({ kind: 'due_within_days', days: 7 })}
            >
              Vencen en 7 días
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onTaskFilterChange({ kind: 'overdue' })}
            >
              Ya vencidas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onTaskFilterChange({ kind: 'title', query: '' })}
            >
              Buscar por título…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {taskFilter.kind === 'title' && (
          <Input
            type="search"
            value={taskFilter.query}
            onChange={handleTitleInputChange}
            placeholder="Texto en el título…"
            aria-label="Texto a buscar en el título de las tareas"
            className="h-8 w-40 border-surface-200 bg-surface-50 text-sm sm:w-48 dark:border-surface-700 dark:bg-surface-900"
          />
        )}

        {/* --- Menú ordenación --- */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
              aria-label="Ordenar tareas en las columnas"
              title="Ordenar"
            >
              <ArrowUpDown className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Ordenar</span>
              {sortActive && (
                <span className="size-1.5 rounded-full bg-primary-500" aria-hidden />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => onSortChange('manual', 'asc')}>
              Orden del tablero (manual)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSortChange('title', 'asc')}>
              Título: A → Z
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('title', 'desc')}>
              Título: Z → A
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSortChange('priority', 'asc')}>
              Prioridad: baja → urgente
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('priority', 'desc')}>
              Prioridad: urgente → baja
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSortChange('dueDate', 'asc')}>
              Fecha límite: la más próxima primero
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('dueDate', 'desc')}>
              Fecha límite: la más lejana primero
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {dragLocked && (
        <p className="text-[11px] leading-tight text-surface-500 dark:text-surface-400 sm:max-w-[200px]">
          Arrastrar tareas desactivado: hay filtro activo u orden distinto al del tablero.
        </p>
      )}
    </div>
  );
}
