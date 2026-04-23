import type { ChangeEvent } from 'react';
import { CalendarDays, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { StoryPointVotingState, Task } from '@/types/board.types';
import { voteCountPhrase } from '../taskCardHelpers';
import {
  PRIORITY_OPTIONS,
  PRIORITY_PILL_BORDER,
  PRIORITY_ROW_STYLE,
  PRIORITY_SELECTION_RING,
} from '../taskCardConstants';
import { TaskPriorityIcon } from '../taskPriorityVisual';
import { FibonacciButtonRow } from '../FibonacciButtonRow';
import { TaskDetailSection } from '../TaskDetailSection';
import { TaskDetailInfoTip } from './TaskDetailInfoTip';

export function TaskDetailPlanningSection({
  readOnly,
  editPriority,
  onSelectPriority,
  editDueDate,
  onEditDueDateChange,
  panelConsensus,
  panelVoteCount,
  storyPointState,
  votingBusy,
  onStoryPointVoteSelect,
}: {
  readOnly: boolean;
  editPriority: Task['priority'];
  onSelectPriority: (p: Task['priority']) => void;
  editDueDate: string;
  onEditDueDateChange: (e: ChangeEvent<HTMLInputElement>) => void;
  panelConsensus: number | null;
  panelVoteCount: number;
  storyPointState: StoryPointVotingState | null;
  votingBusy: boolean;
  onStoryPointVoteSelect: (n: number) => void;
}) {
  return (
    <TaskDetailSection title="Planificación" icon={CalendarDays}>
      <div className="divide-y divide-surface-200/90 dark:divide-surface-700/80">
        <div className="space-y-2 pb-4">
          <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
            Prioridad
          </label>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="radiogroup"
            aria-label="Prioridad de la tarea"
          >
            {PRIORITY_OPTIONS.map((opt) => {
              const row = PRIORITY_ROW_STYLE[opt.value];
              const selected = editPriority === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readOnly}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelectPriority(opt.value)}
                  className={cn(
                    'flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-[box-shadow,opacity,border-color]',
                    'outline-none focus-visible:ring-2 focus-visible:ring-primary-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-50 dark:focus-visible:ring-offset-surface-950',
                    row.bg,
                    row.text,
                    PRIORITY_PILL_BORDER[opt.value],
                    selected && PRIORITY_SELECTION_RING[opt.value],
                    !selected && 'opacity-[0.88] hover:opacity-100',
                    readOnly && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <TaskPriorityIcon
                    priority={opt.value}
                    className="size-4 shrink-0 opacity-90"
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 py-4">
          <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
            Fecha límite
          </label>
          <Input
            type="date"
            value={editDueDate}
            onChange={onEditDueDateChange}
            readOnly={readOnly}
            className="h-10 max-w-xs bg-surface-50 text-sm shadow-sm focus-visible:ring-ring dark:bg-surface-900"
          />
        </div>

        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
              Story points
            </p>
            <TaskDetailInfoTip
              label="Cómo funcionan los story points"
              side="right"
              text="Cada persona con acceso puede votar un valor de la escala. Se muestra el consenso (media ajustada a Fibonacci) y cuántas personas han votado."
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-surface-800 dark:text-surface-200">
            <Vote
              className="size-4 shrink-0 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
            <span className="font-semibold tabular-nums">
              {panelConsensus != null ? panelConsensus : '—'}
            </span>
            <span className="text-xs font-normal text-surface-500 dark:text-surface-400">
              · {voteCountPhrase(panelVoteCount)}
            </span>
          </div>
          <FibonacciButtonRow
            selected={storyPointState?.myVote ?? null}
            showNone={false}
            disabled={votingBusy || readOnly}
            onSelect={onStoryPointVoteSelect}
            selectedFilledClass="bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
          />
        </div>
      </div>
    </TaskDetailSection>
  );
}
