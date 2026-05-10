import type { ChangeEvent } from 'react';
import { CalendarDays } from 'lucide-react';
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
import { StoryPointsIcon } from '../StoryPointsIcon';
import { TaskDetailSection } from '../TaskDetailSection';
import { TaskDetailInfoTip } from './TaskDetailInfoTip';

// Muestra la seccion de planificacion
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
  onStoryPointVoteClear,
}: {
  readOnly: boolean;
  editPriority: Task['priority'];
  onSelectPriority: (priorityValue: Task['priority']) => void;
  editDueDate: string;
  onEditDueDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  panelConsensus: number | null;
  panelVoteCount: number;
  storyPointState: StoryPointVotingState | null;
  votingBusy: boolean;
  onStoryPointVoteSelect: (storyPointValue: number) => void;
  onStoryPointVoteClear: () => void;
}) {
  let voteValue: number | string = '—';
  if (panelConsensus !== null) {
    voteValue = panelConsensus;
  }

  let voteDisabled = false;
  if (votingBusy || readOnly) {
    voteDisabled = true;
  }

  return (
    <TaskDetailSection title="Planificación" icon={CalendarDays}>
      <div className="divide-y divide-surface-200/90 dark:divide-surface-700/80">
        <div className="space-y-2 pb-4">
          <label className="text-base font-semibold text-surface-800 dark:text-surface-200">
            Prioridad
          </label>
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Prioridad de la tarea"
          >
            {PRIORITY_OPTIONS.map((item) => {
              const data = PRIORITY_ROW_STYLE[item.value];
              const selected = editPriority === item.value;
              let selectedClassName = 'opacity-90 hover:opacity-100';
              if (selected) {
                selectedClassName = PRIORITY_SELECTION_RING[item.value];
              }

              let readOnlyClassName = '';
              if (readOnly) {
                readOnlyClassName = 'cursor-not-allowed opacity-60';
              }

              let buttonClassName =
                'flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-base font-medium whitespace-nowrap transition outline-none';
              buttonClassName +=
                ' focus-visible:ring-2 focus-visible:ring-primary-500/45 focus-visible:ring-offset-2';
              buttonClassName +=
                ' focus-visible:ring-offset-surface-50 dark:focus-visible:ring-offset-surface-950';
              buttonClassName += ` ${data.bg}`;
              buttonClassName += ` ${data.text}`;
              buttonClassName += ` ${PRIORITY_PILL_BORDER[item.value]}`;
              buttonClassName += ` ${selectedClassName}`;
              buttonClassName += ` ${readOnlyClassName}`;

              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={readOnly}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelectPriority(item.value)}
                  className={buttonClassName}
                >
                  <TaskPriorityIcon
                    priority={item.value}
                    className="size-5 shrink-0 opacity-90"
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 py-4">
          <label className="text-base font-semibold text-surface-800 dark:text-surface-200">
            Fecha límite
          </label>
          <Input
            type="date"
            value={editDueDate}
            onChange={onEditDueDateChange}
            readOnly={readOnly}
            className="h-11 max-w-xs bg-surface-50 text-base shadow-sm focus-visible:ring-ring dark:bg-surface-900"
          />
        </div>

        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-1.5">
            <p className="text-base font-semibold text-surface-800 dark:text-surface-200">
              Story points
            </p>
            <TaskDetailInfoTip
              label="Cómo funcionan los story points"
              side="right"
              text="Cada persona con acceso puede votar un valor de la escala. Se muestra la media ajustada a Fibonacci y cuántas personas han votado."
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-base text-surface-800 dark:text-surface-200">
            <StoryPointsIcon className="text-violet-600 dark:text-violet-400" />
            <span className="font-semibold tabular-nums">{voteValue}</span>
            <span className="text-sm font-normal text-surface-500 dark:text-surface-400">
              · {voteCountPhrase(panelVoteCount)}
            </span>
          </div>
          <FibonacciButtonRow
            selected={storyPointState?.myVote ?? null}
            disabled={voteDisabled}
            onSelect={onStoryPointVoteSelect}
            onClear={onStoryPointVoteClear}
            selectedFilledClass="border-violet-700 bg-violet-600 text-white shadow-md ring-2 ring-violet-500/40 hover:bg-violet-700 dark:border-violet-300 dark:bg-violet-500 dark:ring-violet-300/30 dark:hover:bg-violet-400"
            unselectedClass="border-surface-300 bg-surface-50 text-surface-700 hover:border-violet-400/70 hover:bg-violet-50 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:border-violet-500/55 dark:hover:bg-violet-500/10"
          />
        </div>
      </div>
    </TaskDetailSection>
  );
}
