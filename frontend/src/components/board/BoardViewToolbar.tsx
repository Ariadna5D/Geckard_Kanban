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

// Muestra un grupo de filtros con boton limpiar
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
      className="inline-flex items-stretch overflow-hidden rounded-lg border border-primary-500/50 bg-primary-500/15 ring-1 ring-primary-500/20 shadow-sm dark:border-primary-400/45 dark:bg-primary-500/20 dark:ring-primary-400/15"
    >
      <div className="flex min-w-0 [&_button]:rounded-none [&_button]:shadow-none [&_button]:ring-0">
        {children}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="h-11 w-11 shrink-0 rounded-none border-l border-primary-500/40 text-primary-900 hover:bg-primary-500/25 dark:border-primary-400/35 dark:text-primary-50 dark:hover:bg-primary-500/30"
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

// Muestra un grupo de orden con boton limpiar
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
      className="inline-flex items-stretch overflow-hidden rounded-lg border border-primary-500/50 bg-primary-500/15 ring-1 ring-primary-500/20 shadow-sm dark:border-primary-400/45 dark:bg-primary-500/20 dark:ring-primary-400/15"
    >
      <div className="flex min-w-0 [&_button]:rounded-none [&_button]:shadow-none [&_button]:ring-0">
        {children}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="h-11 w-11 shrink-0 rounded-none border-l border-primary-500/40 text-primary-900 hover:bg-primary-500/25 dark:border-primary-400/35 dark:text-primary-50 dark:hover:bg-primary-500/30"
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
  compactMobile?: boolean;
  mobileLayout?: 'compact' | 'list';
};

// Comprueba si una etiqueta esta activa
function tagNameSelected(filter: BoardTaskFilter, name: string): boolean {
  if (filter.kind !== 'tags') return false;
  const low = name.trim().toLowerCase();
  return filter.names.some(
    (tagName) => tagName.trim().toLowerCase() === low,
  );
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

// Muestra una fila para elegir orden
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
  let upButtonClassName = 'h-7 w-7 text-muted-foreground hover:text-foreground';
  if (upActive) {
    upButtonClassName =
      'h-7 w-7 bg-primary/15 text-primary-900 hover:bg-primary/20 hover:text-primary-950 dark:bg-primary/25 dark:text-primary-100 dark:hover:bg-primary/30';
  }
  let downButtonClassName = 'h-7 w-7 text-muted-foreground hover:text-foreground';
  if (downActive) {
    downButtonClassName =
      'h-7 w-7 bg-primary/15 text-primary-900 hover:bg-primary/20 hover:text-primary-950 dark:bg-primary/25 dark:text-primary-100 dark:hover:bg-primary/30';
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <RowIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0 text-base text-foreground">{label}</span>
      </div>
      <div className="flex shrink-0 gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={upButtonClassName}
              aria-label={`${label}: ${hints.desc}`}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => onSortChange(criterion, 'desc')}
            >
              <ChevronUp className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-56">
            {hints.desc}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={downButtonClassName}
              aria-label={`${label}: ${hints.asc}`}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => onSortChange(criterion, 'asc')}
            >
              <ChevronDown className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-56">
            {hints.asc}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// Controla filtros y orden del tablero
export function BoardViewToolbar({
  taskFilter,
  onTaskFilterChange,
  sortKey,
  sortDirection,
  onSortChange,
  boardLabelOptions,
  compactMobile = true,
  mobileLayout = 'compact',
}: BoardViewToolbarProps) {
  const filterActive = isBoardFilterActive(taskFilter);
  const sortActive = isBoardSortActive(sortKey);
  // Si hay orden distinto de manual, se bloquea drag de tareas
  const dragLocked = shouldLockTaskDrag(sortKey);
  const showCompactMobile = compactMobile === true;
  const useMobileListLayout =
    showCompactMobile === true && mobileLayout === 'list';
  const showToolbarText = !showCompactMobile || useMobileListLayout;

  function handleTitleInputChange(event: ChangeEvent<HTMLInputElement>) {
    // Filtro por texto en titulo sin tocar backend
    onTaskFilterChange({ kind: 'title', query: event.target.value });
  }

  function clearTitleFilter() {
    onTaskFilterChange({ kind: 'all' });
  }

  function handleTagChecked(name: string, checked: boolean) {
    const trimmed = name.trim();
    if (trimmed === '') return;
    if (checked) {
      // Agrega etiqueta al filtro compuesto si no estaba incluida
      if (taskFilter.kind === 'tags') {
        const exists = taskFilter.names.some(
          (tagName) =>
            tagName.trim().toLowerCase() === trimmed.toLowerCase(),
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
    // Quita etiqueta y vuelve a all si no queda ninguna seleccionada
    if (taskFilter.kind === 'tags') {
      const next = taskFilter.names.filter(
        (tagName) =>
          tagName.trim().toLowerCase() !== trimmed.toLowerCase(),
      );
      if (next.length > 0) {
        onTaskFilterChange({ kind: 'tags', names: next });
      } else {
        onTaskFilterChange({ kind: 'all' });
      }
    }
  }

  const filterButtonVariant = 'outline';
  const sortButtonVariant = 'outline';
  const titleFilterQuery = taskFilter.kind === 'title' ? taskFilter.query : '';

  let desktopFilterButtonClassName =
    'h-11 gap-1.5 border-surface-500 bg-surface-50 px-3 text-lg font-semibold text-surface-800 ring-1 ring-surface-300/90 sm:px-3.5 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70';
  if (showCompactMobile) {
    if (useMobileListLayout) {
      desktopFilterButtonClassName =
        'h-11 w-full justify-start gap-2 rounded-lg border px-3 text-lg font-semibold text-surface-800 dark:text-surface-100';
    } else {
      desktopFilterButtonClassName = 'h-9 w-9 rounded-lg border px-0';
    }
    if (filterActive) {
      desktopFilterButtonClassName =
        `${desktopFilterButtonClassName} border-surface-500 bg-surface-50 text-surface-900 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70`;
    } else {
      desktopFilterButtonClassName =
        `${desktopFilterButtonClassName} border-surface-500 bg-surface-50 text-surface-700 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300 dark:ring-surface-700/70`;
    }
  }
  if (filterActive && !showCompactMobile) {
    desktopFilterButtonClassName =
      `${desktopFilterButtonClassName} border-surface-500 bg-surface-50 text-surface-900 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70`;
  }

  let desktopSortButtonClassName =
    'relative h-11 gap-1.5 border-surface-500 bg-surface-50 px-3 text-lg font-semibold text-surface-800 ring-1 ring-surface-300/90 sm:px-3.5 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70';
  if (showCompactMobile) {
    if (useMobileListLayout) {
      desktopSortButtonClassName =
        'relative h-11 w-full justify-start gap-2 rounded-lg border px-3 text-lg font-semibold text-surface-800 dark:text-surface-100';
    } else {
      desktopSortButtonClassName = 'relative h-9 w-9 rounded-lg border px-0';
    }
    if (sortActive) {
      desktopSortButtonClassName =
        `${desktopSortButtonClassName} border-surface-500 bg-surface-50 text-surface-900 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70`;
    } else {
      desktopSortButtonClassName =
        `${desktopSortButtonClassName} border-surface-500 bg-surface-50 text-surface-700 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300 dark:ring-surface-700/70`;
    }
  }
  if (sortActive && !showCompactMobile) {
    desktopSortButtonClassName =
      `${desktopSortButtonClassName} border-surface-500 bg-surface-50 text-surface-900 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70`;
  }

  const filterMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={filterButtonVariant}
          size="lg"
          className={desktopFilterButtonClassName}
          aria-label="Filtrar tareas del tablero"
          aria-pressed={filterActive}
        >
          <ListFilter className="size-[1.125rem] shrink-0 sm:size-5" aria-hidden />
          {showToolbarText && <span>Filtro</span>}
          {useMobileListLayout && (
            <ChevronDown className="ml-auto size-4 shrink-0 opacity-70" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-90 w-56">
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
            {boardLabelOptions.length === 0 ? (
              <DropdownMenuItem disabled className="text-base">
                No hay etiquetas en este tablero
              </DropdownMenuItem>
            ) : (
              boardLabelOptions.map((labelOption) => (
                <DropdownMenuCheckboxItem
                  key={labelOption.name.toLowerCase()}
                  checked={tagNameSelected(taskFilter, labelOption.name)}
                  onCheckedChange={(checkedValue) =>
                    handleTagChecked(labelOption.name, checkedValue === true)
                  }
                  onSelect={(event) => event.preventDefault()}
                  className="pl-2"
                >
                  <span
                    className={`mr-2 inline-flex size-3 shrink-0 rounded-sm border ${taskLabelColorClasses(labelOption.color)}`}
                    aria-hidden
                  />
                  <span className="truncate">{labelOption.name}</span>
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
        <DropdownMenuLabel className="text-base font-normal text-muted-foreground">
          Buscar por título
        </DropdownMenuLabel>
        <div
          className="px-1 pb-1"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={titleFilterQuery}
              onChange={handleTitleInputChange}
              placeholder="Texto…"
              aria-label="Texto a buscar en el título de las tareas"
              className="h-8 border-surface-200 bg-surface-50 pl-8 pr-8 text-base dark:border-surface-700 dark:bg-surface-900"
            />
            {taskFilter.kind === 'title' && taskFilter.query.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-0.5 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={clearTitleFilter}
                aria-label="Cerrar búsqueda por título"
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sortMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={sortButtonVariant}
          size="lg"
          className={desktopSortButtonClassName}
          aria-label="Ordenar tareas en las columnas"
          aria-pressed={sortActive}
        >
          <ArrowUpDown className="size-[1.125rem] shrink-0 sm:size-5" aria-hidden />
          {showToolbarText && <span>Ordenar</span>}
          {useMobileListLayout && (
            <ChevronDown className="ml-auto size-4 shrink-0 opacity-70" aria-hidden />
          )}
          {dragLocked && (
            <span
              className="absolute top-1 right-1 inline-block size-1.5 rounded-full bg-amber-500"
              aria-hidden
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-90 w-64 p-1.5">
        <DropdownMenuItem onClick={() => onSortChange('manual', 'asc')}>
          <GripVertical
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          Orden personalizado
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {dragLocked && (
          <p className="border-b border-amber-500/25 bg-amber-500/10 px-2 py-2 text-xs leading-snug text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            Arrastrar desactivado: el orden no es el personalizado del tablero.
          </p>
        )}
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

  const desktopToolbar = (
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
              className="h-11 w-44 border-surface-200 bg-surface-50 pl-8 pr-9 text-lg sm:w-52 dark:border-surface-700 dark:bg-surface-900"
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

    </div>
  );

  if (!showCompactMobile) {
    return desktopToolbar;
  }

  let mobileToolbarClassName = 'flex items-center gap-2';
  if (useMobileListLayout) {
    mobileToolbarClassName = 'space-y-2';
  }

  const mobileToolbar = (
    <div className={mobileToolbarClassName}>
      {filterMenu}
      {sortMenu}
    </div>
  );

  return (
    <>
      <div className="sm:hidden">{mobileToolbar}</div>

      <div className="hidden sm:block">{desktopToolbar}</div>
    </>
  );
}
