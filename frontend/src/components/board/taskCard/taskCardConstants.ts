import type { Task } from '@/types/board.types';

// Valores de votacion que usa el panel
export const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13] as const;

// Cantidad maxima de avatares visibles dentro de la tarjeta
export const MAX_ASSIGNEE_AVATARS_ON_CARD = 3;

// Opciones de prioridad que ve el usuario en filtros y formularios
export const PRIORITY_OPTIONS: { value: Task['priority']; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export const PRIORITY_ACCENT_BORDER: Record<Task['priority'], string> = {
  low: 'border-l-cyan-500 dark:border-l-cyan-400',
  medium: 'border-l-sky-500 dark:border-l-sky-400',
  high: 'border-l-orange-500 dark:border-l-orange-400',
  urgent: 'border-l-red-500 dark:border-l-red-400',
};

// Version tenue para tarjetas ya completadas
export const COMPLETED_PRIORITY_ACCENT_BORDER: Record<Task['priority'], string> = {
  low: 'border-l-cyan-500/55 dark:border-l-cyan-400/50',
  medium: 'border-l-sky-500/55 dark:border-l-sky-400/50',
  high: 'border-l-orange-500/55 dark:border-l-orange-400/50',
  urgent: 'border-l-red-500/55 dark:border-l-red-400/50',
};

// Estilo de fondo y texto segun prioridad para filas y badges
export const PRIORITY_ROW_STYLE: Record<
  Task['priority'],
  { bg: string; text: string }
> = {
  low: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-400/20',
    text: 'text-cyan-900 dark:text-cyan-200',
  },
  medium: {
    bg: 'bg-sky-500/10 dark:bg-sky-400/20',
    text: 'text-sky-900 dark:text-sky-200',
  },
  high: {
    bg: 'bg-orange-500/10 dark:bg-orange-400/20',
    text: 'text-orange-950 dark:text-orange-200',
  },
  urgent: {
    bg: 'bg-red-500/10 dark:bg-red-400/20',
    text: 'text-red-900 dark:text-red-200',
  },
};

export const PRIORITY_PILL_BORDER: Record<Task['priority'], string> = {
  low: 'border-cyan-400/40 dark:border-cyan-500/35',
  medium: 'border-sky-400/40 dark:border-sky-500/35',
  high: 'border-orange-400/45 dark:border-orange-500/40',
  urgent: 'border-red-400/45 dark:border-red-500/40',
};

// Borde marcado cuando la prioridad esta seleccionada en el panel
export const PRIORITY_SELECTION_RING: Record<Task['priority'], string> = {
  low: 'ring-2 ring-cyan-500/70 dark:ring-cyan-400/70',
  medium: 'ring-2 ring-sky-500/70 dark:ring-sky-400/70',
  high: 'ring-2 ring-orange-500/75 dark:ring-orange-400/70',
  urgent: 'ring-2 ring-red-500/75 dark:ring-red-400/70',
};
