import type { LucideIcon } from 'lucide-react';
import { ArrowBigDown, ArrowBigUp, Flame, Minus } from 'lucide-react';
import type { Task } from '@/types/board.types';

const TASK_PRIORITY_ICON: Record<Task['priority'], LucideIcon> = {
  urgent: Flame,
  high: ArrowBigUp,
  medium: Minus,
  low: ArrowBigDown,
};

// Muestra el icono segun la prioridad
export function TaskPriorityIcon({
  priority,
  className = 'size-4 shrink-0 opacity-90',
}: {
  priority: Task['priority'];
  className?: string;
}) {
  // Elegimos icono segun prioridad, con fallback por seguridad
  const data = TASK_PRIORITY_ICON[priority] ?? Minus;
  const Icon = data;
  return <Icon className={className} aria-hidden />;
}

// Opciones para chips de filtro por prioridad en toolbar
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
