import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BoardMemberSummary,
  ClosedSprintRecord,
  ClosedSprintTaskSnapshot,
} from "@/types/board.types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

const BAR_FILL_CYCLE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

const sprintStatusConfig = {
  completadas: {
    label: "Completadas",
    theme: {
      light: "oklch(0.58 0.14 165)",
      dark: "oklch(0.72 0.13 165)",
    },
  },
  pendientes: {
    label: "Pendientes",
    theme: {
      light: "oklch(0.63 0.2 25)",
      dark: "oklch(0.68 0.18 25)",
    },
  },
} satisfies ChartConfig;

const progressChartConfig = {
  cumulative: {
    label: "Completadas (acumulado)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const completedByMemberChartConfig = {
  completedTaskCount: {
    label: "Tareas completadas",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const radarLabelsChartConfig = {
  count: {
    label: "Tareas con la etiqueta",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/** Máximo de ejes en el radar para que las etiquetas sigan siendo legibles. */
const MAX_RADAR_LABELS = 14;

function dateKey(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const UNASSIGNED_MEMBER_ROW_KEY = "unassigned";

type CompletedTasksByMemberRow = {
  rowKey: string;
  memberName: string;
  completedTaskCount: number;
  profileImageUrl?: string;
};

function memberAvatarInitials(memberName: string): string {
  const trimmed = memberName.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function completedByMemberYAxisTick(
  chartRows: CompletedTasksByMemberRow[],
  tickProperties: { index: number; x?: number; y?: number },
) {
  const chartRow = chartRows[tickProperties.index];
  if (!chartRow) {
    return <g />;
  }
  const axisX = Number(tickProperties.x);
  const axisY = Number(tickProperties.y);
  return (
    <g transform={`translate(${axisX},${axisY})`}>
      <foreignObject x={-168} y={-11} width={164} height={22}>
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className="flex items-center gap-2 text-left text-[11px] font-medium text-foreground"
        >
          <Avatar size="sm" className="size-5 shrink-0">
            {chartRow.profileImageUrl ? (
              <AvatarImage src={chartRow.profileImageUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-[9px]">
              {memberAvatarInitials(chartRow.memberName)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate">{chartRow.memberName}</span>
        </div>
      </foreignObject>
    </g>
  );
}

function aggregateCompletedTasksByMember(
  snapshots: ClosedSprintTaskSnapshot[],
  memberList: BoardMemberSummary[],
): CompletedTasksByMemberRow[] {
  const memberByUserId = new Map<string, BoardMemberSummary>();
  for (let index = 0; index < memberList.length; index++) {
    const member = memberList[index];
    memberByUserId.set(member.userId, member);
  }
  const completedCountByRowKey = new Map<string, number>();
  for (let index = 0; index < snapshots.length; index++) {
    const snapshotRow = snapshots[index];
    if (!snapshotRow.wasCompleted) {
      continue;
    }
    const assigneeIds = snapshotRow.assigneeIdsAtClose ?? [];
    if (assigneeIds.length === 0) {
      completedCountByRowKey.set(
        UNASSIGNED_MEMBER_ROW_KEY,
        (completedCountByRowKey.get(UNASSIGNED_MEMBER_ROW_KEY) ?? 0) + 1,
      );
      continue;
    }
    for (
      let assigneeIndex = 0;
      assigneeIndex < assigneeIds.length;
      assigneeIndex++
    ) {
      const userId = assigneeIds[assigneeIndex];
      completedCountByRowKey.set(
        userId,
        (completedCountByRowKey.get(userId) ?? 0) + 1,
      );
    }
  }
  const resultRows: CompletedTasksByMemberRow[] = [];
  for (const [rowKey, completedTaskCount] of completedCountByRowKey) {
    if (rowKey === UNASSIGNED_MEMBER_ROW_KEY) {
      resultRows.push({
        rowKey,
        memberName: "Sin asignar",
        completedTaskCount,
      });
      continue;
    }
    const member = memberByUserId.get(rowKey);
    resultRows.push({
      rowKey,
      memberName: member?.username ?? "Usuario desconocido",
      completedTaskCount,
      profileImageUrl: member?.avatarUrl,
    });
  }
  resultRows.sort(
    (first, second) => second.completedTaskCount - first.completedTaskCount,
  );
  return resultRows.slice(0, 8);
}

function aggregateLabelCounts(snapshots: ClosedSprintTaskSnapshot[]) {
  const countByLabel = new Map<string, number>();
  for (let i = 0; i < snapshots.length; i++) {
    const labels = snapshots[i].labelsAtClose ?? [];
    const seenInTask = new Set<string>();
    for (let j = 0; j < labels.length; j++) {
      const nm = labels[j].name.trim();
      if (!nm || seenInTask.has(nm)) continue;
      seenInTask.add(nm);
      countByLabel.set(nm, (countByLabel.get(nm) ?? 0) + 1);
    }
  }
  return Array.from(countByLabel.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function ClosedSprintSummaryCharts({
  record,
  boardMembers,
}: {
  record: ClosedSprintRecord;
  boardMembers: BoardMemberSummary[];
}) {
  const areaGradientId = useId().replace(/:/g, "");
  const snapshots = record.taskSnapshots ?? [];
  const total = snapshots.length;
  const completed = snapshots.filter((row) => row.wasCompleted).length;
  const pointsDone = snapshots.reduce((acc, row) => {
    if (!row.wasCompleted || typeof row.storyPointsWhenDone !== "number")
      return acc;
    return acc + row.storyPointsWhenDone;
  }, 0);

  const donePct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pending = total - completed;

  const pieSlices = useMemo(() => {
    const rows: { key: keyof typeof sprintStatusConfig; amount: number }[] =
      [];
    if (completed > 0) {
      rows.push({ key: "completadas", amount: completed });
    }
    if (pending > 0) {
      rows.push({ key: "pendientes", amount: pending });
    }
    if (rows.length === 0 && total > 0) {
      rows.push({ key: "pendientes", amount: total });
    }
    return rows.map((row) => ({
      ...row,
      fill: `var(--color-${row.key})`,
    }));
  }, [completed, pending, total]);

  const completionSeries = useMemo(() => {
    const countsByDay = new Map<string, number>();
    for (let index = 0; index < snapshots.length; index++) {
      const row = snapshots[index];
      if (!row.wasCompleted || !row.taskUpdatedAtAtClose) {
        continue;
      }
      const key = dateKey(row.taskUpdatedAtAtClose);
      if (!key) continue;
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    }
    const orderedDays = Array.from(countsByDay.keys()).sort();
    let cumulative = 0;
    return orderedDays.map((dayKey) => {
      cumulative += countsByDay.get(dayKey) ?? 0;
      const date = new Date(`${dayKey}T08:00:00`);
      const label = Number.isNaN(date.getTime())
        ? dayKey
        : date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
      return { dayKey, label, cumulative };
    });
  }, [snapshots]);

  const completedByMemberRows = useMemo(
    () => aggregateCompletedTasksByMember(snapshots, boardMembers),
    [snapshots, boardMembers],
  );

  const labelRadarRows = useMemo(
    () => aggregateLabelCounts(snapshots),
    [snapshots],
  );

  const labelRadarDisplay = useMemo(() => {
    const sliced = labelRadarRows.slice(0, MAX_RADAR_LABELS);
    const maxCount = sliced.reduce((m, r) => Math.max(m, r.count), 0);
    return {
      rows: sliced,
      max: Math.max(maxCount, 1),
      truncated: labelRadarRows.length > MAX_RADAR_LABELS,
      totalDistinct: labelRadarRows.length,
    };
  }, [labelRadarRows]);

  const barChartPixelHeight = useMemo(() => {
    const rowCount = completedByMemberRows.length;
    const heightEstimate = 36 + Math.max(rowCount, 1) * 36;
    return Math.min(320, Math.max(160, heightEstimate));
  }, [completedByMemberRows.length]);

  if (total === 0) return null;

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <h3 className="text-sm font-semibold">Estado del sprint</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Relación entre completadas y pendientes al cierre.
        </p>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="relative shrink-0">
            <ChartContainer
              config={sprintStatusConfig}
              className="mx-auto aspect-square h-[9.5rem] w-[9.5rem]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="key" />}
                />
                <Pie
                  data={pieSlices}
                  dataKey="amount"
                  nameKey="key"
                  innerRadius={52}
                  outerRadius={72}
                  strokeWidth={2}
                  stroke="var(--background)"
                />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-semibold tabular-nums">{donePct}%</span>
            </div>
          </div>
          <div className="w-full space-y-1 text-xs sm:max-w-[12rem]">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              Completadas: {completed}
            </p>
            <p className="font-semibold text-rose-700 dark:text-rose-300">
              Pendientes: {pending}
            </p>
            <p className="text-muted-foreground">Total: {total}</p>
            <p className="text-violet-700 dark:text-violet-300">
              Puntos completados: <strong>{pointsDone}</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm lg:col-span-2">
        <h3 className="text-sm font-semibold">Línea de progreso (acumulada)</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Evolución de tareas completadas por fecha registrada al cierre.
        </p>
        {completionSeries.length <= 1 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            Sin suficientes fechas para trazar una línea temporal.
          </p>
        ) : (
          <ChartContainer
            config={progressChartConfig}
            className="mt-4 h-[14rem] w-full aspect-auto"
          >
            <AreaChart
              data={completionSeries}
              margin={{ left: 4, right: 8, top: 8, bottom: 4 }}
            >
              <defs>
                <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-cumulative)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-cumulative)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                width={36}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Area
                dataKey="cumulative"
                type="monotone"
                fill={`url(#${areaGradientId})`}
                stroke="var(--color-cumulative)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm lg:col-span-3">
        <h3 className="text-sm font-semibold">Tareas completadas por usuario</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Por persona según asignación al cierre de cada tarea completada.
        </p>
        {completedByMemberRows.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No hay datos de asignación en este sprint cerrado.
          </p>
        ) : (
          <ChartContainer
            config={completedByMemberChartConfig}
            className="mt-4 w-full aspect-auto"
            style={{ height: barChartPixelHeight }}
          >
            <BarChart
              accessibilityLayer
              data={completedByMemberRows}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="memberName"
                width={176}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                interval={0}
                tick={(tickProperties) =>
                  completedByMemberYAxisTick(
                    completedByMemberRows,
                    tickProperties,
                  )
                }
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                content={<ChartTooltipContent />}
              />
              <Bar
                dataKey="completedTaskCount"
                radius={[0, 6, 6, 0]}
                maxBarSize={22}
              >
                {completedByMemberRows.map((chartRow, barIndex) => (
                  <Cell
                    key={chartRow.rowKey}
                    fill={
                      BAR_FILL_CYCLE[barIndex % BAR_FILL_CYCLE.length]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm lg:col-span-3">
        <h3 className="text-sm font-semibold">Etiquetas en el sprint</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Cuántas tareas del sprint llevaban cada etiqueta al cerrarse (una tarea cuenta
          como mucho una vez por nombre de etiqueta).
        </p>
        {labelRadarDisplay.rows.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            No hay etiquetas en las tareas de este cierre, o el sprint se cerró antes de
            guardar etiquetas en el historial.
          </p>
        ) : (
          <>
            {labelRadarDisplay.truncated ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Mostrando las {MAX_RADAR_LABELS} etiquetas más frecuentes de{" "}
                {labelRadarDisplay.totalDistinct} distintas.
              </p>
            ) : null}
            <ChartContainer
              config={radarLabelsChartConfig}
              className="mx-auto mt-4 aspect-auto h-[min(26rem,calc(100vw-3rem))] w-full max-w-xl"
            >
              <RadarChart
                accessibilityLayer
                data={labelRadarDisplay.rows}
                margin={{ top: 16, right: 24, bottom: 16, left: 24 }}
              >
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <PolarGrid className="stroke-border/60" />
                <PolarAngleAxis
                  dataKey="name"
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => {
                    const s = String(value);
                    return s.length > 14 ? `${s.slice(0, 12)}…` : s;
                  }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, labelRadarDisplay.max]}
                  tickCount={4}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <Radar
                  name="Tareas"
                  dataKey="count"
                  stroke="var(--color-count)"
                  fill="var(--color-count)"
                  fillOpacity={0.32}
                  strokeWidth={2}
                  dot={{ r: 3, fillOpacity: 1 }}
                />
              </RadarChart>
            </ChartContainer>
          </>
        )}
      </div>
    </div>
  );
}
