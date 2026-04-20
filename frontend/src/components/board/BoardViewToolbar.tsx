import { type ChangeEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpDown,
  Calendar,
  CalendarClock,
  CalendarX,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ListFilter,
  List,
  Search,
  Signal,
  Tags,
  Type,
  UserRoundX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TaskLabelColor } from '@/types/board.types';
import { TASK_PRIORITY_FILTER_OPTIONS } from '@/components/board/taskCard/taskPriorityVisual';
import { taskLabelColorClasses } from '@/constants/taskLabels';
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

/** Grupo unificado: control + descarte adosado (patrón tipo barra de filtros). */
function ToolbarFilterGroup({
  active,
  onClear,
  children,
}: {
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (!active) {
    return <>{children}</>;
  }
  return (
    <div
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-lg border shadow-sm',
        'border-primary-500/50 bg-primary-500/[0.14] ring-1 ring-primary-500/20',
        'dark:border-primary-400/45 dark:bg-primary-500/20 dark:ring-primary-400/15',
      )}
    >
      <div className="flex min-w-0 [&_button]:rounded-none [&_button]:border-0 [&_button]:shadow-none [&_button]:ring-0">
        {children}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 shrink-0 rounded-none border-l border-primary-500/40 px-2.5',
              'text-primary-900 hover:bg-primary-500/25 dark:border-primary-400/35 dark:text-primary-50 dark:hover:bg-primary-500/30',
            )}
            onClick={onClear}
            aria-label="Limpiar filtros"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Limpiar filtros</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ToolbarSortGroup({
  active,
  onClear,
  children,
}: {
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (!active) {
    return <>{children}</>;
  }
  return (
    <div
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-lg border shadow-sm',
        'border-primary-500/50 bg-primary-500/[0.14] ring-1 ring-primary-500/20',
        'dark:border-primary-400/45 dark:bg-primary-500/20 dark:ring-primary-400/15',
      )}
    >
      <div className="flex min-w-0 [&_button]:rounded-none [&_button]:border-0 [&_button]:shadow-none [&_button]:ring-0">
        {children}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 shrink-0 rounded-none border-l border-primary-500/40 px-2.5',
              'text-primary-900 hover:bg-primary-500/25 dark:border-primary-400/35 dark:text-primary-50 dark:hover:bg-primary-500/30',
            )}
            onClick={onClear}
            aria-label="Volver al orden manual del tablero"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Orden manual del tablero</TooltipContent>
      </Tooltip>
    </div>
  );
}

type BoardViewToolbarProps = {
  taskFilter: BoardTaskFilter;
  onTaskFilterChange: (next: BoardTaskFilter) => void;
  sortKey: BoardTaskSortKey;
  sortDirection: BoardSortDirection;
  onSortChange: (key: BoardTaskSortKey, dir: BoardSortDirection) => void;
  boardLabelOptions: { name: string; color: TaskLabelColor }[];
};

function tagNameSelected(filter: BoardTaskFilter, name: string): boolean {
  if (filter.kind !== 'tags') return false;
  const low = name.trim().toLowerCase();
  return filter.names.some((n) => n.trim().toLowerCase() === low);
}

const SORT_HINTS: Record<
  Exclude<BoardTaskSortKey, 'manual'>,
  { desc: string; asc: string }
> = {
  title: {
    desc: 'Descendente: de la Z a la A',
    asc: 'Ascendente: de la A a la Z',
  },
  priority: {
    desc: 'Descendente: de urgente a baja',
    asc: 'Ascendente: de baja a urgente',
  },
  dueDate: {
    desc: 'Descendente: la fecha más lejana primero',
    asc: 'Ascendente: la fecha más próxima primero',
  },
};

function SortArrowsRow({
  label,
  criterion,
  icon: RowIcon,
  sortKey,
  sortDirection,
  onSortChange,
}: {
  label: string;
  criterion: Exclude<BoardTaskSortKey, 'manual'>;
  icon: LucideIcon;
  sortKey: BoardTaskSortKey;
  sortDirection: BoardSortDirection;
  onSortChange: (key: BoardTaskSortKey, dir: BoardSortDirection) => void;
}) {
  const hints = SORT_HINTS[criterion];
  const upActive = sortKey === criterion && sortDirection === 'desc';
  const downActive = sortKey === criterion && sortDirection === 'asc';
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <RowIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0 text-sm text-foreground">{label}</span>
      </div>
      <div className="flex shrink-0 gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                'h-7 w-7 text-muted-foreground hover:text-foreground',
                upActive &&
                  'bg-primary/15 text-primary-900 hover:bg-primary/20 hover:text-primary-950 dark:bg-primary/25 dark:text-primary-100 dark:hover:bg-primary/30',
              )}
              aria-label={`${label}: ${hints.desc}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onSortChange(criterion, 'desc')}
            >
              <ChevronUp className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[14rem]">
            {hints.desc}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                'h-7 w-7 text-muted-foreground hover:text-foreground',
                downActive &&
                  'bg-primary/15 text-primary-900 hover:bg-primary/20 hover:text-primary-950 dark:bg-primary/25 dark:text-primary-100 dark:hover:bg-primary/30',
              )}
              aria-label={`${label}: ${hints.asc}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onSortChange(criterion, 'asc')}
            >
              <ChevronDown className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[14rem]">
            {hints.asc}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * Controles de vista del tablero: menú de filtros y menú de ordenación.
 * Filtro y orden son solo de sesión (estado en `BoardPage`).
 */
export function BoardViewToolbar({
  taskFilter,
  onTaskFilterChange,
  sortKey,
  sortDirection,
  onSortChange,
  boardLabelOptions,
}: BoardViewToolbarProps) {
  const filterActive = isBoardFilterActive(taskFilter);
  const sortActive = isBoardSortActive(sortKey);
  const dragLocked = shouldLockTaskDrag(taskFilter, sortKey);

  function handleTitleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onTaskFilterChange({ kind: 'title', query: event.target.value });
  }

  function handleTagChecked(name: string, checked: boolean) {
    const trimmed = name.trim();
    if (trimmed === '') return;
    if (checked) {
      if (taskFilter.kind === 'tags') {
        const exists = taskFilter.names.some(
          (n) => n.trim().toLowerCase() === trimmed.toLowerCase(),
        );
        if (!exists) {
          onTaskFilterChange({
            kind: 'tags',
            names: [...taskFilter.names, trimmed],
          });
        }
      } else {
        onTaskFilterChange({ kind: 'tags', names: [trimmed] });
      }
      return;
    }
    if (taskFilter.kind === 'tags') {
      const next = taskFilter.names.filter(
        (n) => n.trim().toLowerCase() !== trimmed.toLowerCase(),
      );
      onTaskFilterChange(
        next.length > 0 ? { kind: 'tags', names: next } : { kind: 'all' },
      );
    }
  }

  const filterMenu = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={filterActive ? 'ghost' : 'outline'}
                size="sm"
                className={cn(
                  'h-8 gap-1.5 border-surface-200 bg-surface-50 px-2.5 sm:px-3 dark:border-surface-700 dark:bg-surface-900',
                  filterActive &&
                    'bg-transparent hover:bg-primary-500/15 dark:hover:bg-primary-500/25',
                )}
                aria-label="Filtrar tareas del tablero"
                aria-pressed={filterActive}
              >
                <ListFilter className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Filtro</span>
              </Button>
            </DropdownMenuTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[16rem]">
          {filterActive
            ? 'Cambia el criterio desde el menú. El botón X anexo quita todos los filtros.'
            : 'Prioridad, etiquetas, fechas, asignación o texto en el título.'}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onTaskFilterChange({ kind: 'all' })}>
          <List className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Todas las tareas
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Signal
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            Prioridad
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {TASK_PRIORITY_FILTER_OPTIONS.map(({ value, label, icon: PIcon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => onTaskFilterChange({ kind: 'priority', value })}
              >
                <PIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Tags
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            Etiquetas
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 w-56 overflow-y-auto">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Con cualquiera de las elegidas (OR)
            </DropdownMenuLabel>
            {boardLabelOptions.length === 0 ? (
              <DropdownMenuItem disabled className="text-xs">
                No hay etiquetas en este tablero
              </DropdownMenuItem>
            ) : (
              boardLabelOptions.map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt.name.toLowerCase()}
                  checked={tagNameSelected(taskFilter, opt.name)}
                  onCheckedChange={(c) => handleTagChecked(opt.name, c === true)}
                  onSelect={(e) => e.preventDefault()}
                  className="pl-2"
                >
                  <span
                    className={cn(
                      'mr-2 inline-flex size-3 shrink-0 rounded-sm border',
                      taskLabelColorClasses(opt.color),
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{opt.name}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          onClick={() => onTaskFilterChange({ kind: 'unassigned' })}
        >
          <UserRoundX
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          Sin asignar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            onTaskFilterChange({ kind: 'due_within_days', days: 7 })
          }
        >
          <CalendarClock
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          Vencen en 7 días
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onTaskFilterChange({ kind: 'overdue' })}
        >
          <CalendarX
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          Ya vencidas
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onTaskFilterChange({ kind: 'title', query: '' })}
        >
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          Buscar por título…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sortMenu = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={sortActive ? 'ghost' : 'outline'}
                size="sm"
                className={cn(
                  'h-8 gap-1.5 border-surface-200 bg-surface-50 px-2.5 sm:px-3 dark:border-surface-700 dark:bg-surface-900',
                  sortActive &&
                    'bg-transparent hover:bg-primary-500/15 dark:hover:bg-primary-500/25',
                )}
                aria-label="Ordenar tareas en las columnas"
                aria-pressed={sortActive}
              >
                <ArrowUpDown className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Ordenar</span>
              </Button>
            </DropdownMenuTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[16rem]">
          {sortActive
            ? 'Elige otro criterio en el menú. El botón X anexo vuelve al orden manual del tablero.'
            : 'Orden manual por defecto; puedes ordenar por título, prioridad o fecha límite.'}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuItem onClick={() => onSortChange('manual', 'asc')}>
          <GripVertical
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          Orden del tablero (manual)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-start gap-2 text-[11px] font-normal leading-snug text-muted-foreground">
          <ArrowUpDown
            className="mt-0.5 size-3.5 shrink-0 opacity-80"
            aria-hidden
          />
          <span>
            Arriba: descendente · Abajo: ascendente
          </span>
        </DropdownMenuLabel>
        <SortArrowsRow
          label="Título"
          criterion="title"
          icon={Type}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
        />
        <SortArrowsRow
          label="Prioridad"
          criterion="priority"
          icon={Signal}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
        />
        <SortArrowsRow
          label="Fecha límite"
          criterion="dueDate"
          icon={Calendar}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex max-w-full flex-col gap-1 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarFilterGroup
          active={filterActive}
          onClear={() => onTaskFilterChange({ kind: 'all' })}
        >
          {filterMenu}
        </ToolbarFilterGroup>

        {taskFilter.kind === 'title' && (
          <div className="relative flex min-w-0">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={taskFilter.query}
              onChange={handleTitleInputChange}
              placeholder="Texto en el título…"
              aria-label="Texto a buscar en el título de las tareas"
              className="h-8 w-40 border-surface-200 bg-surface-50 pl-8 pr-9 text-sm sm:w-48 dark:border-surface-700 dark:bg-surface-900"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-0.5 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => onTaskFilterChange({ kind: 'all' })}
                  aria-label="Cerrar búsqueda por título"
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Cerrar búsqueda</TooltipContent>
            </Tooltip>
          </div>
        )}

        <ToolbarSortGroup
          active={sortActive}
          onClear={() => onSortChange('manual', 'asc')}
        >
          {sortMenu}
        </ToolbarSortGroup>
      </div>

      {dragLocked && (
        <p className="text-[11px] leading-tight text-surface-500 dark:text-surface-400 sm:max-w-[200px]">
          Arrastrar tareas desactivado: hay filtro activo u orden distinto al del tablero.
        </p>
      )}
    </div>
  );
}
