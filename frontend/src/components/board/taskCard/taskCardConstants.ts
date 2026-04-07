import type { Task } from '@/types/board.types';

export const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13] as const;

/** Cuántos avatares de asignados se ven en la tarjeta antes del +N. */
export const MAX_ASSIGNEE_AVATARS_ON_CARD = 3;

export const PRIORITY_OPTIONS: { value: Task['priority']; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export const PRIORITY_ACCENT_BORDER: Record<Task['priority'], string> = {
  low: 'border-l-emerald-500 dark:border-l-emerald-400',
  medium: 'border-l-sky-500 dark:border-l-sky-400',
  high: 'border-l-orange-500 dark:border-l-orange-400',
  urgent: 'border-l-red-500 dark:border-l-red-400',
};

export const PRIORITY_ROW_STYLE: Record<
  Task['priority'],
  { bg: string; text: string }
> = {
  low: {
    bg: 'bg-emerald-500/[0.12] dark:bg-emerald-400/[0.14]',
    text: 'text-emerald-900 dark:text-emerald-200',
  },
  medium: {
    bg: 'bg-sky-500/[0.12] dark:bg-sky-400/[0.14]',
    text: 'text-sky-900 dark:text-sky-200',
  },
  high: {
    bg: 'bg-orange-500/[0.12] dark:bg-orange-400/[0.14]',
    text: 'text-orange-950 dark:text-orange-200',
  },
  urgent: {
    bg: 'bg-red-500/[0.12] dark:bg-red-400/[0.14]',
    text: 'text-red-900 dark:text-red-200',
  },
};
