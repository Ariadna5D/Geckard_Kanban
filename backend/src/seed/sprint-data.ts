import { Types } from 'mongoose';

type SprintDefinition = {
  name: string;
  startedAt: Date;
  plannedEndAt: Date;
  closedAt: Date;
  snapshots: number;
  completedRatio: number;
  avgPoints: number;
  timelineDays: 7 | 10;
};

function demoDate(year: number, month: number, day: number): Date {
  // Fecha fija en utc
  return new Date(Date.UTC(year, month - 1, day, 11, 0, 0, 0));
}

function buildSprintDefinitions(): SprintDefinition[] {
  // Define sprints cerrados de ejemplo
  return [
    {
      name: 'Sprint 01 - Despliegue',
      startedAt: demoDate(2026, 2, 20),
      plannedEndAt: demoDate(2026, 2, 27),
      closedAt: demoDate(2026, 2, 28),
      snapshots: 16,
      completedRatio: 0.56,
      avgPoints: 2,
      timelineDays: 7,
    },
    {
      name: 'Sprint 02 - Diseno',
      startedAt: demoDate(2026, 2, 28),
      plannedEndAt: demoDate(2026, 3, 7),
      closedAt: demoDate(2026, 3, 8),
      snapshots: 20,
      completedRatio: 0.65,
      avgPoints: 3,
      timelineDays: 10,
    },
    {
      name: 'Sprint 03 - Gestion de usuarios',
      startedAt: demoDate(2026, 3, 8),
      plannedEndAt: demoDate(2026, 3, 15),
      closedAt: demoDate(2026, 3, 16),
      snapshots: 18,
      completedRatio: 0.61,
      avgPoints: 3,
      timelineDays: 7,
    },
    {
      name: 'Sprint 04 - Gestion de tablero',
      startedAt: demoDate(2026, 3, 16),
      plannedEndAt: demoDate(2026, 3, 23),
      closedAt: demoDate(2026, 3, 24),
      snapshots: 22,
      completedRatio: 0.73,
      avgPoints: 4,
      timelineDays: 10,
    },
    {
      name: 'Sprint 05 - Gestion de permisos',
      startedAt: demoDate(2026, 3, 24),
      plannedEndAt: demoDate(2026, 3, 31),
      closedAt: demoDate(2026, 4, 1),
      snapshots: 19,
      completedRatio: 0.58,
      avgPoints: 3,
      timelineDays: 7,
    },
    {
      name: 'Sprint 06 - Desarrollo Scrum',
      startedAt: demoDate(2026, 4, 1),
      plannedEndAt: demoDate(2026, 4, 10),
      closedAt: demoDate(2026, 4, 11),
      snapshots: 24,
      completedRatio: 0.69,
      avgPoints: 5,
      timelineDays: 10,
    },
    {
      name: 'Sprint 07 - Pulido',
      startedAt: demoDate(2026, 4, 11),
      plannedEndAt: demoDate(2026, 4, 30),
      closedAt: demoDate(2026, 4, 30),
      snapshots: 20,
      completedRatio: 0.79,
      avgPoints: 3,
      timelineDays: 10,
    },
  ];
}

function extraLabelPoolForSprint(
  sprintTheme: string,
): { name: string; color: string }[] {
  // Ajusta etiquetas segun tema
  if (sprintTheme.includes('despliegue')) {
    return [
      { name: 'documentacion', color: 'gray' },
      { name: 'despliegue', color: 'orange' },
      { name: 'backend', color: 'green' },
      { name: 'testeo', color: 'yellow' },
    ];
  }
  if (sprintTheme.includes('diseno')) {
    return [
      { name: 'frontend', color: 'blue' },
      { name: 'documentacion', color: 'gray' },
      { name: 'investigacion', color: 'purple' },
      { name: 'testeo', color: 'yellow' },
    ];
  }
  if (sprintTheme.includes('usuarios')) {
    return [
      { name: 'backend', color: 'green' },
      { name: 'testeo', color: 'yellow' },
      { name: 'bug', color: 'red' },
      { name: 'documentacion', color: 'gray' },
    ];
  }
  if (sprintTheme.includes('tablero')) {
    return [
      { name: 'frontend', color: 'blue' },
      { name: 'backend', color: 'green' },
      { name: 'bug', color: 'red' },
      { name: 'investigacion', color: 'purple' },
    ];
  }
  if (sprintTheme.includes('permisos')) {
    return [
      { name: 'backend', color: 'green' },
      { name: 'testeo', color: 'yellow' },
      { name: 'documentacion', color: 'gray' },
      { name: 'bug', color: 'red' },
    ];
  }
  if (sprintTheme.includes('scrum')) {
    return [
      { name: 'documentacion', color: 'gray' },
      { name: 'investigacion', color: 'purple' },
      { name: 'frontend', color: 'blue' },
      { name: 'backend', color: 'green' },
    ];
  }
  return [
    { name: 'documentacion', color: 'gray' },
    { name: 'bug', color: 'red' },
    { name: 'testeo', color: 'yellow' },
    { name: 'frontend', color: 'blue' },
  ];
}

export function buildClosedSprintRecords(options: {
  columnIdByTitle: Record<string, Types.ObjectId>;
  assigneeRotation: Types.ObjectId[];
}): Record<string, unknown>[] {
  const { columnIdByTitle, assigneeRotation } = options;
  const baseLabels = [
    { name: 'frontend', color: 'blue' },
    { name: 'backend', color: 'green' },
    { name: 'despliegue', color: 'orange' },
    { name: 'bug', color: 'red' },
    { name: 'documentacion', color: 'gray' },
    { name: 'investigacion', color: 'purple' },
    { name: 'testeo', color: 'yellow' },
  ];
  const pointsPattern = [1, 2, 3, 5, 8, 13] as const;
  const sprints = buildSprintDefinitions();

  return sprints.map((sprint, sprintIndex) => {
    const sprintId = new Types.ObjectId();
    const completedCount = Math.floor(sprint.snapshots * sprint.completedRatio);
    const sprintTheme = sprint.name.toLowerCase();
    const extraPool = extraLabelPoolForSprint(sprintTheme);

    const taskSnapshots = Array.from({ length: sprint.snapshots }).map(
      (_, taskIndex) => {
        // Marca completadas segun ratio del sprint
        const wasCompleted = taskIndex < completedCount;
        const normalized = taskIndex + sprintIndex;
        const assignee = assigneeRotation[taskIndex % assigneeRotation.length];
        const points =
          pointsPattern[(taskIndex + sprint.avgPoints) % pointsPattern.length];

        const taskDate = new Date(sprint.startedAt);
        taskDate.setUTCDate(
          taskDate.getUTCDate() + (normalized % sprint.timelineDays),
        );
        taskDate.setUTCHours(9 + (taskIndex % 8), 20, 0, 0);

        const selectedLabels: { name: string; color: string }[] = [
          baseLabels[normalized % baseLabels.length],
        ];
        if (normalized % 2 === 0) {
          selectedLabels.push(extraPool[normalized % extraPool.length]);
        }
        if (normalized % 5 === 0) {
          selectedLabels.push(extraPool[(normalized + 1) % extraPool.length]);
        }
        const labelsAtClose = selectedLabels.filter(
          (label, index, arr) =>
            arr.findIndex((candidate) => candidate.name === label.name) ===
            index,
        );

        // Si no esta completada, queda en columna intermedia
        const incompleteColumns = [
          { key: 'check', title: 'check' },
          { key: 'doing', title: 'doing' },
          { key: 'to do', title: 'to do' },
          { key: 'sprint', title: 'sprint' },
          { key: 'backlog', title: 'backlog' },
        ] as const;
        const fallback =
          incompleteColumns[normalized % incompleteColumns.length];

        return {
          taskId: new Types.ObjectId(),
          title: `${sprint.name} · Item ${taskIndex + 1}`,
          columnId: wasCompleted
            ? columnIdByTitle.done
            : columnIdByTitle[fallback.key],
          columnTitleAtClose: wasCompleted ? 'done' : fallback.title,
          wasCompleted,
          storyPointsWhenDone: wasCompleted ? points : undefined,
          taskUpdatedAtAtClose: taskDate,
          assigneeIdsAtClose: [assignee],
          labelsAtClose,
        };
      },
    );

    return {
      sprintId,
      sprintName: sprint.name,
      closedAt: sprint.closedAt,
      startedAt: sprint.startedAt,
      plannedEndAt: sprint.plannedEndAt,
      taskSnapshots,
    };
  });
}
