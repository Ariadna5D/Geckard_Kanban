import type { ChangeEvent } from 'react';
import { CalendarDays, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StoryPointVotingState, Task } from '@/types/board.types';
import { voteCountPhrase } from '../taskCardHelpers';
import { PRIORITY_OPTIONS } from '../taskCardConstants';
import { FibonacciButtonRow } from '../FibonacciButtonRow';
import { TaskDetailSection } from '../TaskDetailSection';

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
          <div className="flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={editPriority === opt.value ? 'default' : 'outline'}
                disabled={readOnly}
                onClick={onSelectPriority.bind(null, opt.value)}
                className={
                  editPriority === opt.value
                    ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400'
                    : ''
                }
              >
                {opt.label}
              </Button>
            ))}
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
          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
            Story points
          </p>
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
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {storyPointState === null && <>Cargando…</>}
            {storyPointState != null && storyPointState.totalVotes === 0 && (
              <>Sin votos todavía.</>
            )}
            {storyPointState?.myVote != null &&
              ` Tu voto: ${storyPointState.myVote}.`}
          </p>
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
