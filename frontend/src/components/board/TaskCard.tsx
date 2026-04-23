import { useEffect, useState, type KeyboardEvent } from 'react';
import { Archive } from 'lucide-react';
import type { Task } from '@/types/board.types';
import { COMPLETED_PRIORITY_ACCENT_BORDER } from './taskCard/taskCardConstants';
import { TaskCardMetaChips } from './taskCard/TaskCardMetaChips';
import { TaskDetailSheet } from './taskCard/TaskDetailSheet';
import { useTaskCardViewModel } from './taskCard/useTaskCardViewModel';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  /** Solo lectura: sin arrastrar ni editar (rol viewer). */
  readOnly?: boolean;
  /** Sin arrastrar (p. ej. búsqueda activa); el detalle de la tarea sigue abriéndose al hacer clic. */
  disableDrag?: boolean;
}

export const TaskCard = ({
  task,
  isOverlay,
  readOnly = false,
  disableDrag = false,
}: TaskCardProps) => {
  const viewModel = useTaskCardViewModel(task, readOnly, disableDrag);
  const [isPointerOverCard, setIsPointerOverCard] = useState(false);
  const isCompletedColumn = Boolean(viewModel.completionColumnKind);
  const taskPriority = task.priority ?? 'medium';
  const cardLeftAccent = isCompletedColumn
    ? COMPLETED_PRIORITY_ACCENT_BORDER[taskPriority]
    : viewModel.priorityAccent;

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      viewModel.handleOpenTaskSheet();
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      if (!viewModel.canSelfAssignShortcut) return;
      event.preventDefault();
      void viewModel.handleToggleSelfAssign();
    }
  }

  useEffect(() => {
    if (!isPointerOverCard || !viewModel.canSelfAssignShortcut) return;

    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON'
      );
    }

    function onWindowKeyDown(event: globalThis.KeyboardEvent) {
      const isSpace = event.key === ' ' || event.code === 'Space';
      if (!isSpace) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      void viewModel.handleToggleSelfAssign();
    }

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [isPointerOverCard, viewModel.canSelfAssignShortcut, viewModel.handleToggleSelfAssign]);

  if (isOverlay) {
    return (
      <div
        className={`relative z-50 scale-105 cursor-grabbing rotate-2 rounded-lg border border-primary-500/35 border-l-4 bg-surface-50 p-3 text-base shadow-2xl ring-2 ring-primary-500/25 dark:border-primary-400/40 dark:bg-surface-800 dark:ring-primary-400/20 ${cardLeftAccent}`}
      >
        <TaskCardMetaChips
          task={viewModel.task}
          normalizedLabels={viewModel.normalizedLabels}
          teamVoteConsensus={viewModel.overlayVoting.teamVoteConsensus}
          teamVoteCount={viewModel.overlayVoting.teamVoteCount}
          boardMembers={viewModel.boardMembers}
          completionColumnKind={viewModel.completionColumnKind}
        />
      </div>
    );
  }

  if (viewModel.isDragging) {
    return (
      <div
        ref={viewModel.setNodeRef}
        style={viewModel.style}
        className="min-h-15 rounded-lg border-2 border-dashed border-surface-300 bg-surface-100/60 opacity-40 dark:border-surface-600 dark:bg-surface-800/40"
      />
    );
  }

  return (
    <>
      <div
        ref={viewModel.setNodeRef}
        style={viewModel.style}
        {...viewModel.attributes}
        {...(readOnly || disableDrag ? {} : viewModel.listeners)}
        tabIndex={0}
        onPointerEnter={() => setIsPointerOverCard(true)}
        onPointerLeave={() => setIsPointerOverCard(false)}
        onKeyDown={handleCardKeyDown}
        onClick={viewModel.handleOpenTaskSheet}
        className={`group relative select-none rounded-lg border border-surface-200 border-l-4 bg-surface-50 p-3 text-base shadow-sm outline-none transition-[border-color,box-shadow] hover:border-primary-500/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500/35 dark:border-surface-700 dark:bg-surface-800 dark:hover:border-primary-400/45 dark:focus-visible:ring-primary-400/35 ${cardLeftAccent} ${
          readOnly
            ? 'cursor-default'
            : disableDrag
              ? 'cursor-pointer'
              : 'cursor-grab active:cursor-grabbing'
        }`}
        aria-label={
          viewModel.canSelfAssignShortcut
            ? `${task.title}. Enter abre detalle. Espacio ${
                viewModel.isAssignedToCurrentUser
                  ? 'te desasigna'
                  : 'te asigna'
              }.`
            : `${task.title}. Enter abre detalle.`
        }
      >
        <TaskCardMetaChips
          task={viewModel.task}
          normalizedLabels={viewModel.normalizedLabels}
          teamVoteConsensus={viewModel.teamVoteConsensusLive}
          teamVoteCount={viewModel.teamVoteCount}
          boardMembers={viewModel.boardMembers}
          completionColumnKind={viewModel.completionColumnKind}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={viewModel.handleArchiveCardClick}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-2 rounded-md p-1 text-surface-500 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 dark:text-surface-400"
            aria-label="Archivar tarea"
            title="Archivar tarea"
          >
            <Archive size={16} />
          </button>
        )}
      </div>

      <TaskDetailSheet {...viewModel.sheetProps} />
    </>
  );
};
