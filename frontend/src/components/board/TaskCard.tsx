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
  readOnly?: boolean;
  disableDrag?: boolean;
}

// Muestra una tarjeta de tarea
export const TaskCard = ({
  task,
  isOverlay,
  readOnly = false,
  disableDrag = false,
}: TaskCardProps) => {
  // El view model concentra estado local y peticiones al backend
  const data = useTaskCardViewModel(task, readOnly, disableDrag);
  const [isPointerOverCard, setIsPointerOverCard] = useState(false);
  const isCompletedColumn = Boolean(data.completionColumnKind);
  const taskPriority = task.priority ?? 'medium';
  let cardLeftAccent = data.priorityAccent;
  if (isCompletedColumn) {
    cardLeftAccent = COMPLETED_PRIORITY_ACCENT_BORDER[taskPriority];
  }

  let dragCursorClassName = 'cursor-grab active:cursor-grabbing';
  if (readOnly) {
    dragCursorClassName = 'cursor-default';
  }
  if (!readOnly && disableDrag) {
    dragCursorClassName = 'cursor-pointer';
  }

  let cardAriaLabel = `${task.title}. Enter abre detalle.`;
  if (data.canSelfAssignShortcut) {
    let assignmentHint = 'te asigna';
    if (data.isAssignedToCurrentUser) {
      assignmentHint = 'te desasigna';
    }
    cardAriaLabel = `${task.title}. Enter abre detalle. Espacio ${assignmentHint}.`;
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      // Enter abre panel de detalle con datos de la tarea
      event.preventDefault();
      event.stopPropagation();
      data.handleOpenTaskSheet();
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      if (!data.canSelfAssignShortcut) return;
      // Espacio alterna autoasignacion rapdia de usuario actual
      event.preventDefault();
      event.stopPropagation();
      void data.handleToggleSelfAssign();
    }
  }

  useEffect(() => {
    if (!isPointerOverCard || !data.canSelfAssignShortcut) return;

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
      // Atajo global cuando el puntero esta sobre la tarjeta
      event.preventDefault();
      void data.handleToggleSelfAssign();
    }

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [isPointerOverCard, data.canSelfAssignShortcut, data.handleToggleSelfAssign]);

  if (isOverlay) {
    return (
      <div
        className={`relative z-50 scale-105 cursor-grabbing rotate-2 rounded-lg border border-primary-500/35 border-l-4 bg-surface-50 p-3 text-base shadow-2xl ring-2 ring-primary-500/25 dark:border-primary-400/40 dark:bg-surface-800 dark:ring-primary-400/20 ${cardLeftAccent}`}
      >
        <TaskCardMetaChips
          task={data.task}
          normalizedLabels={data.normalizedLabels}
          teamVoteConsensus={data.overlayVoting.teamVoteConsensus}
          teamVoteCount={data.overlayVoting.teamVoteCount}
          boardMembers={data.boardMembers}
          completionColumnKind={data.completionColumnKind}
        />
      </div>
    );
  }

  if (data.isDragging) {
    return (
      <div
        ref={data.setNodeRef}
        style={data.style}
        className="min-h-15 rounded-lg border-2 border-dashed border-surface-300 bg-surface-100/60 opacity-40 dark:border-surface-600 dark:bg-surface-800/40"
      />
    );
  }

  return (
    <>
      <div
        ref={data.setNodeRef}
        style={data.style}
        {...data.attributes}
        {...(readOnly || disableDrag ? {} : data.listeners)}
        tabIndex={0}
        onPointerEnter={() => setIsPointerOverCard(true)}
        onPointerLeave={() => setIsPointerOverCard(false)}
        onKeyDown={handleCardKeyDown}
        onClick={data.handleOpenTaskSheet}
        className={`group relative select-none rounded-lg border border-surface-200 border-l-4 bg-surface-50 p-3 text-base shadow-sm outline-none transition-[border-color,box-shadow] hover:border-primary-500/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500/35 dark:border-surface-700 dark:bg-surface-800 dark:hover:border-primary-400/45 dark:focus-visible:ring-primary-400/35 ${cardLeftAccent} ${dragCursorClassName}`}
        aria-label={cardAriaLabel}
      >
        <TaskCardMetaChips
          task={data.task}
          normalizedLabels={data.normalizedLabels}
          teamVoteConsensus={data.teamVoteConsensusLive}
          teamVoteCount={data.teamVoteCount}
          boardMembers={data.boardMembers}
          completionColumnKind={data.completionColumnKind}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={data.handleArchiveCardClick}
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute top-3 right-2 rounded-md p-1 text-surface-500 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 dark:text-surface-400"
            aria-label="Archivar tarea"
            title="Archivar tarea"
          >
            <Archive size={16} />
          </button>
        )}
      </div>

      <TaskDetailSheet {...data.sheetProps} />
    </>
  );
};
