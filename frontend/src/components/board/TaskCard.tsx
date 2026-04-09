import { Trash2 } from 'lucide-react';
import type { Task } from '@/types/board.types';
import { TaskCardMetaChips } from './taskCard/TaskCardMetaChips';
import { TaskDetailSheet } from './taskCard/TaskDetailSheet';
import { useTaskCardViewModel } from './taskCard/useTaskCardViewModel';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  /** Solo lectura: sin arrastrar ni editar (rol viewer). */
  readOnly?: boolean;
  /** Desactiva DnD (p. ej. vista filtrada por sprint: el orden debe calcularse con todas las tareas). */
  disableDrag?: boolean;
}

export const TaskCard = ({
  task,
  isOverlay,
  readOnly = false,
  disableDrag = false,
}: TaskCardProps) => {
  const vm = useTaskCardViewModel(task, readOnly, { disableDrag });

  if (isOverlay) {
    return (
      <div
        className={`relative z-50 scale-105 cursor-grabbing rotate-2 rounded-lg border border-primary-500/35 border-l-4 bg-surface-50 p-3 text-sm shadow-2xl ring-2 ring-primary-500/25 dark:border-primary-400/40 dark:bg-surface-800 dark:ring-primary-400/20 ${vm.priorityAccent}`}
      >
        <TaskCardMetaChips
          task={vm.task}
          normalizedLabels={vm.normalizedLabels}
          teamVoteConsensus={vm.overlayVoting.teamVoteConsensus}
          teamVoteCount={vm.overlayVoting.teamVoteCount}
          boardMembers={vm.boardMembers}
        />
      </div>
    );
  }

  if (vm.isDragging) {
    return (
      <div
        ref={vm.setNodeRef}
        style={vm.style}
        className="min-h-15 rounded-lg border-2 border-dashed border-surface-300 bg-surface-100/60 opacity-40 dark:border-surface-600 dark:bg-surface-800/40"
      />
    );
  }

  return (
    <>
      <div
        ref={vm.setNodeRef}
        style={vm.style}
        {...vm.attributes}
        {...(readOnly ? {} : vm.listeners)}
        onClick={vm.handleOpenTaskSheet}
        className={`group relative select-none rounded-lg border border-surface-200 border-l-4 bg-surface-50 p-3 text-sm shadow-sm transition-[border-color,box-shadow] hover:border-primary-500/50 hover:shadow-md dark:border-surface-700 dark:bg-surface-800 dark:hover:border-primary-400/45 ${vm.priorityAccent} ${
          readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <TaskCardMetaChips
          task={vm.task}
          normalizedLabels={vm.normalizedLabels}
          teamVoteConsensus={vm.teamVoteConsensusLive}
          teamVoteCount={vm.teamVoteCount}
          boardMembers={vm.boardMembers}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={vm.handleDeleteCardClick}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-2 rounded-md p-1 text-surface-500 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 dark:text-surface-400"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <TaskDetailSheet {...vm.sheetProps} />
    </>
  );
};
