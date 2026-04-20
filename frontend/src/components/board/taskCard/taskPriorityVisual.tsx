import type { LucideIcon } from 'lucide-react';
import { ArrowBigDown, ArrowBigUp, Flame, Minus } from 'lucide-react';
import type { Task } from '@/types/board.types';

const TASK_PRIORITY_ICON: Record<Task['priority'], LucideIcon> = {
  urgent: Flame,
  high: ArrowBigUp,
  medium: Minus,
  low: ArrowBigDown,
};

/** Icono de prioridad (mismo criterio que en el menú Filtro del tablero). */
export function TaskPriorityIcon({
  priority,
  className = 'size-4 shrink-0 opacity-90',
}: {
  priority: Task['priority'];
  className?: string;
}) {
  const Icon = TASK_PRIORITY_ICON[priority] ?? Minus;
  return <Icon className={className} aria-hidden />;
}

/** Opciones para menús de filtro (orden: urgente → baja). */
export const TASK_PRIORITY_FILTER_OPTIONS: {
  value: Task['priority'];
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'urgent', label: 'Urgente', icon: Flame },
  { value: 'high', label: 'Alta', icon: ArrowBigUp },
  { value: 'medium', label: 'Media', icon: Minus },
  { value: 'low', label: 'Baja', icon: ArrowBigDown },
];
