import { Flag } from 'lucide-react';
import { TaskDetailSection } from '../TaskDetailSection';
import { TaskDetailInfoTip } from './TaskDetailInfoTip';

type TaskDetailSprintSectionProps = {
  readOnly: boolean;
  activeSprintName: string;
  inActiveSprint: boolean;
  onInActiveSprintChange: (nextValue: boolean) => void;
};

// Muestra si la tarea entra en sprint
export function TaskDetailSprintSection({
  readOnly,
  activeSprintName,
  inActiveSprint,
  onInActiveSprintChange,
}: TaskDetailSprintSectionProps) {
  let sprintText = `Sprint activo en el tablero: «${activeSprintName}». Si marcas la casilla, esta tarea cuenta en ese sprint (vista filtrada del tablero y cierre del sprint).`;
  if (readOnly) {
    sprintText = `Sprint activo en el tablero: «${activeSprintName}»`;
  }

  return (
    <TaskDetailSection
      title="Sprint"
      icon={Flag}
      titleAccessory={
        <TaskDetailInfoTip
          label="Qué es el sprint activo"
          side="right"
          text={sprintText}
        />
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Activo:{' '}
          <strong className="text-surface-900 dark:text-surface-50">
            {activeSprintName}
          </strong>
        </p>
        <label className="flex cursor-pointer items-start gap-2 text-base text-surface-800 dark:text-surface-100">
          <input
            type="checkbox"
            className="mt-0.5 size-[1.125rem] rounded border-surface-400"
            disabled={readOnly}
            checked={inActiveSprint}
            onChange={(event) => onInActiveSprintChange(event.target.checked)}
          />
          <span>Incluir esta tarea en el sprint activo</span>
        </label>
      </div>
    </TaskDetailSection>
  );
}
