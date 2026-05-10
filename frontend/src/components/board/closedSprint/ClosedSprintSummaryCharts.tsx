import {
  useId,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { BarChart3, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  TASK_LABEL_COLORS,
  taskLabelChartBarFill,
} from "@/constants/taskLabels";
import type {
  ClosedSprintRecord,
  ClosedSprintTaskSnapshot,
  TaskLabelColor,
} from "@/types/board.types";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

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

// Define colores del ritmo
const composedChartConfig = {
  daily: {
    label: "Tareas del día",
    theme: {
      light: "oklch(0.62 0.14 245)",
      dark: "oklch(0.7 0.12 245)",
    },
  },
  cumulative: {
    label: "Tareas acumuladas",
    theme: {
      light: "oklch(0.45 0.14 245)",
      dark: "oklch(0.78 0.1 245)",
    },
  },
} satisfies ChartConfig;

const columnStackConfig = {
  hechas: {
    label: "Hechas",
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

const labelBarChartConfig = {
  count: {
    label: "Tareas",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

// Define colores de story points
const spPointsComposedConfig = {
  pointsDaily: {
    label: "Puntos diarios",
    theme: {
      light: "oklch(0.72 0.09 290)",
      dark: "oklch(0.52 0.12 290)",
    },
  },
  pointsCumulative: {
    label: "Puntos acumulados",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

// Limita etiquetas visibles
const MAX_LABEL_BARS = 12;

// Limita columnas visibles
const MAX_COLUMN_ROWS = 10;

const STORY_POINTS_WHY_TIP =
  "Estimar con puntos ayuda a comparar sprints, planificar capacidad y hablar de esfuerzo con criterios comunes. No hace falta acertar al número: lo útil es que el equipo comparta una escala y la vaya afinando.";

const CHART_PLACEHOLDER_HEIGHT = {
  composed: "min-h-60 sm:min-h-72",
  columnChart: "min-h-64 sm:min-h-80",
  labelChart: "min-h-44 sm:min-h-56",
} as const;

// Define el ancho para modo compacto
const COMPACT_CHARTS_MAX_WIDTH = 639;

// Escucha cambios de ancho
function subscribeCompactCharts(onStoreChange: () => void) {
  const mediaQueryList = window.matchMedia(
    `(max-width: ${COMPACT_CHARTS_MAX_WIDTH}px)`,
  );
  mediaQueryList.addEventListener("change", onStoreChange);
  return () => mediaQueryList.removeEventListener("change", onStoreChange);
}

// Dice si toca modo compacto
function getCompactChartsSnapshot() {
  return window.matchMedia(`(max-width: ${COMPACT_CHARTS_MAX_WIDTH}px)`).matches;
}

// Devuelve el estado en servidor
function getCompactChartsServerSnapshot() {
  return false;
}

// Muestra un aviso cuando falta grafico
function ChartPlaceholder({
  title,
  description,
  tip,
  size,
  icon: Icon = BarChart3,
}: {
  title: string;
  description: ReactNode;
  tip?: ReactNode;
  size: keyof typeof CHART_PLACEHOLDER_HEIGHT;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={`mt-6 flex w-full flex-col justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-6 sm:px-8 sm:py-9 dark:bg-muted/10 ${CHART_PLACEHOLDER_HEIGHT[size]}`}
      role="status"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-lg flex-col items-center px-0.5 text-center">
        <Icon
          className="text-muted-foreground mb-3 size-9 shrink-0 opacity-35 sm:mb-4 sm:size-10"
          aria-hidden
        />
        <p className="text-foreground text-xs font-semibold tracking-tight sm:text-sm">
          {title}
        </p>
        <div className="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-sm">
          {description}
        </div>
        {tip ? (
          <div className="border-amber-500/25 bg-amber-500/10 text-foreground mt-5 w-full min-w-0 max-w-md rounded-lg border px-3 py-2.5 text-left sm:mt-6 sm:px-3.5 sm:py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-950 dark:text-amber-100">
              <Lightbulb
                className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              Consejo
            </p>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed break-words">
              {tip}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Define el estilo de ejes
const CHART_AXIS_TICK = {
  fontSize: 12,
  fill: "var(--muted-foreground)",
} as const;

// Convierte una fecha en clave
function dateKey(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const yearValue = parsed.getFullYear();
  const monthValue = String(parsed.getMonth() + 1).padStart(2, "0");
  const dayValue = String(parsed.getDate()).padStart(2, "0");
  return `${yearValue}-${monthValue}-${dayValue}`;
}

// Muestra un encabezado de grafico
function ChartSectionHeader({
  title,
  description,
  kicker,
}: {
  title: string;
  description: string;
  kicker?: string;
}) {
  return (
    <div className="min-w-0 w-full text-left">
      {kicker ? (
        <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
          {kicker}
        </p>
      ) : null}
      <h3 className="w-full text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base sm:leading-5">
        {title}
      </h3>
      <p className="text-muted-foreground mt-1.5 w-full max-w-none text-pretty text-xs leading-snug break-words sm:text-sm sm:leading-relaxed">
        {description}
      </p>
    </div>
  );
}

type LabelBarRow = {
  name: string;
  count: number;
  color: TaskLabelColor;
};

const allowedLabelColors = new Set<TaskLabelColor>(TASK_LABEL_COLORS);

// Cuenta etiquetas del cierre
function aggregateLabelStats(
  snapshots: ClosedSprintTaskSnapshot[],
): LabelBarRow[] {
  const countByLabel = new Map<string, number>();
  const colorVotesByLabel = new Map<string, Map<TaskLabelColor, number>>();

  for (let snapshotIndex = 0; snapshotIndex < snapshots.length; snapshotIndex++) {
    const labels = snapshots[snapshotIndex].labelsAtClose ?? [];
    const seenInTask = new Set<string>();
    for (let labelIndex = 0; labelIndex < labels.length; labelIndex++) {
      const label = labels[labelIndex];
      const labelName = label.name.trim();
      if (!labelName || seenInTask.has(labelName)) continue;
      seenInTask.add(labelName);
      countByLabel.set(labelName, (countByLabel.get(labelName) ?? 0) + 1);
      const labelColor: TaskLabelColor =
        label.color && allowedLabelColors.has(label.color) ? label.color : "blue";
      const voteMap =
        colorVotesByLabel.get(labelName) ?? new Map<TaskLabelColor, number>();
      voteMap.set(labelColor, (voteMap.get(labelColor) ?? 0) + 1);
      colorVotesByLabel.set(labelName, voteMap);
    }
  }

  function consensusColor(labelName: string): TaskLabelColor {
    const votes = colorVotesByLabel.get(labelName);
    if (!votes || votes.size === 0) {
      return "blue";
    }
    let best: TaskLabelColor = "blue";
    let bestCount = -1;
    for (const [colorKey, voteCount] of votes) {
      if (voteCount > bestCount) {
        bestCount = voteCount;
        best = colorKey;
      }
    }
    return best;
  }

  return Array.from(countByLabel.entries())
    .map(([name, count]) => ({
      name,
      count,
      color: consensusColor(name),
    }))
    .sort((a, b) => b.count - a.count);
}

type ColumnStackRow = {
  columnId: string;
  name: string;
  hechas: number;
  pendientes: number;
};

// Resume columnas del cierre
function aggregateColumnStacks(
  snapshots: ClosedSprintTaskSnapshot[],
): ColumnStackRow[] {
  const rowsByColumnId = new Map<
    string,
    { title: string; hechas: number; pendientes: number }
  >();
  for (let snapshotIndex = 0; snapshotIndex < snapshots.length; snapshotIndex++) {
    const snapshot = snapshots[snapshotIndex];
    const columnId = snapshot.columnId;
    const title = snapshot.columnTitleAtClose?.trim() || "Sin nombre";
    if (!rowsByColumnId.has(columnId)) {
      rowsByColumnId.set(columnId, { title, hechas: 0, pendientes: 0 });
    }
    const row = rowsByColumnId.get(columnId)!;
    if (snapshot.wasCompleted) {
      row.hechas += 1;
    } else {
      row.pendientes += 1;
    }
  }
  return Array.from(rowsByColumnId.entries())
    .map(([columnId, summary]) => ({
      columnId,
      name: summary.title,
      hechas: summary.hechas,
      pendientes: summary.pendientes,
      total: summary.hechas + summary.pendientes,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_COLUMN_ROWS)
    .map(({ columnId, name, hechas, pendientes }) => ({
      columnId,
      name,
      hechas,
      pendientes,
    }));
}

// Busca el valor maximo
function computeMaxBy<T>(rows: T[], getValue: (row: T) => number): number {
  return rows.reduce((currentMax, row) => Math.max(currentMax, getValue(row)), 0)
}

// Muestra el resumen del sprint cerrado
export function ClosedSprintSummaryCharts({
  record,
  basicOnly = false,
}: {
  record: ClosedSprintRecord;
  basicOnly?: boolean;
}) {
  const areaGradientId = useId().replace(/:/g, "");
  const spPointsBarGradientId = useId().replace(/:/g, "");
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

  // Datos del anillo de entrega para tareas hechas y pendientes
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
    // Serie diaria de tareas hechas y acumulado por fecha
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
      const daily = countsByDay.get(dayKey) ?? 0;
      cumulative += daily;
      const date = new Date(`${dayKey}T08:00:00`);
      const label = Number.isNaN(date.getTime())
        ? dayKey
        : date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
      return { dayKey, label, daily, cumulative };
    });
  }, [snapshots]);

  const spCompletionSeries = useMemo(() => {
    // Serie diaria de story points completados y acumulado
    const pointsByDay = new Map<string, number>();
    for (let index = 0; index < snapshots.length; index++) {
      const row = snapshots[index];
      if (!row.wasCompleted || !row.taskUpdatedAtAtClose) {
        continue;
      }
      if (typeof row.storyPointsWhenDone !== "number") {
        continue;
      }
      const key = dateKey(row.taskUpdatedAtAtClose);
      if (!key) continue;
      pointsByDay.set(
        key,
        (pointsByDay.get(key) ?? 0) + row.storyPointsWhenDone,
      );
    }
    const orderedDays = Array.from(pointsByDay.keys()).sort();
    let cumulative = 0;
    return orderedDays.map((dayKey) => {
      const pointsDaily = pointsByDay.get(dayKey) ?? 0;
      cumulative += pointsDaily;
      const date = new Date(`${dayKey}T08:00:00`);
      const label = Number.isNaN(date.getTime())
        ? dayKey
        : date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
      return { dayKey, label, pointsDaily, pointsCumulative: cumulative };
    });
  }, [snapshots]);

  const columnStackRows = useMemo(
    () => aggregateColumnStacks(snapshots),
    [snapshots],
  );

  const labelBarRows = useMemo(() => aggregateLabelStats(snapshots), [snapshots]);

  const labelBarDisplay = useMemo(() => {
    const sliced = labelBarRows.slice(0, MAX_LABEL_BARS);
    return {
      rows: sliced,
      truncated: labelBarRows.length > MAX_LABEL_BARS,
      totalDistinct: labelBarRows.length,
    };
  }, [labelBarRows]);

  const labelBarChartPixelHeight = useMemo(() => {
    const rowCount = labelBarDisplay.rows.length;
    const heightEstimate = 44 + Math.max(rowCount, 1) * 36;
    return Math.min(340, Math.max(160, heightEstimate));
  }, [labelBarDisplay.rows.length]);

  const columnBarChartPixelHeight = useMemo(() => {
    const rowCount = columnStackRows.length;
    const heightEstimate = 40 + Math.max(rowCount, 1) * 40;
    return Math.min(380, Math.max(140, heightEstimate));
  }, [columnStackRows.length]);

  const columnDistinctCount = useMemo(() => {
    const distinctColumnIds = new Set<string>();
    for (let snapshotIndex = 0; snapshotIndex < snapshots.length; snapshotIndex++) {
      distinctColumnIds.add(snapshots[snapshotIndex].columnId);
    }
    return distinctColumnIds.size;
  }, [snapshots]);

  const maxDaily = useMemo(
    () => computeMaxBy(completionSeries, (row) => row.daily),
    [completionSeries],
  );

  const maxCumulative = useMemo(
    () => computeMaxBy(completionSeries, (row) => row.cumulative),
    [completionSeries],
  );

  const maxSpPointsDaily = useMemo(
    () => computeMaxBy(spCompletionSeries, (row) => row.pointsDaily),
    [spCompletionSeries],
  );

  const maxSpPointsCumulative = useMemo(
    () => computeMaxBy(spCompletionSeries, (row) => row.pointsCumulative),
    [spCompletionSeries],
  );

  const isCompactCharts = useSyncExternalStore(
    subscribeCompactCharts,
    getCompactChartsSnapshot,
    getCompactChartsServerSnapshot,
  );

  // En movil reducimos anchos y margenes para legibilidad
  const composedMargins = isCompactCharts
    ? { left: 0, right: 4, top: 2, bottom: 34 }
    : { left: 0, right: 12, top: 8, bottom: 12 };

  const composedAxisTick = isCompactCharts
    ? { fontSize: 10, fill: "var(--muted-foreground)" }
    : CHART_AXIS_TICK;

  const yTasksDailyW = isCompactCharts ? 28 : 36;
  const yTasksCumW = isCompactCharts ? 34 : 40;
  const ySpDailyW = isCompactCharts ? 30 : 40;
  const ySpCumW = isCompactCharts ? 36 : 44;
  const yColumnLabelW = isCompactCharts ? 100 : 132;
  const yTagLabelW = isCompactCharts ? 108 : 148;

  if (total === 0) return null;

  const cardClass =
    "min-w-0 rounded-xl border border-border/80 bg-card p-4 text-card-foreground shadow-sm ring-1 ring-black/5 sm:p-6 dark:ring-white/5";

  const columnsTruncated = columnDistinctCount > MAX_COLUMN_ROWS;

  return (
    <section
      className="mb-10 min-w-0 overflow-x-clip pb-0"
      aria-labelledby="closed-sprint-summary-heading"
    >
      <div className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-6 sm:pb-7">
        <h2
          id="closed-sprint-summary-heading"
          className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
        >
          Resumen del sprint
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-sm">
          Aquí ves el cierre completo del sprint. Incluye el resultado final, el
          ritmo diario en tareas y puntos, la distribución por columnas y el uso
          de etiquetas.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:gap-6">
        <div className={cardClass}>
          <ChartSectionHeader
            kicker="Resultado"
            title="Entrega al cerrar"
            description="Una tarea cuenta como hecha si estaba en una columna de tipo Hecho al cierre. El resto queda como pendiente. El anillo muestra el porcentaje completado y los puntos solo suman tareas hechas."
          />
          <div className="mt-6 flex w-full min-w-0 flex-col items-stretch gap-6 sm:gap-8 lg:flex-row lg:items-center lg:gap-10 xl:gap-12">
            <div className="relative flex shrink-0 justify-center lg:justify-start">
              <ChartContainer
                config={sprintStatusConfig}
                className="mx-auto aspect-square h-40 w-40 sm:h-52 sm:w-52"
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
                    innerRadius="58%"
                    outerRadius="82%"
                    strokeWidth={2}
                    stroke="var(--background)"
                  />
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="text-xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                  {donePct}%
                </span>
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Completado
                </span>
              </div>
            </div>
            <div
              className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4 lg:max-w-none"
              aria-label="Resumen numérico del sprint"
            >
              <div className="min-w-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2 py-2.5 text-center sm:px-3 sm:py-3 dark:border-emerald-500/30 dark:bg-emerald-500/15">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase sm:text-xs">
                  Hechas
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-700 sm:mt-1 sm:text-3xl dark:text-emerald-300">
                  {completed}
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-rose-500/25 bg-rose-500/10 px-2 py-2.5 text-center sm:px-3 sm:py-3 dark:border-rose-500/30 dark:bg-rose-500/15">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase sm:text-xs">
                  Pendientes
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-rose-700 sm:mt-1 sm:text-3xl dark:text-rose-300">
                  {pending}
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-border bg-muted/35 px-2 py-2.5 text-center sm:px-3 sm:py-3 dark:bg-muted/20">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase sm:text-xs">
                  Total
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground sm:mt-1 sm:text-3xl">
                  {total}
                </p>
              </div>
              <div
                className="min-w-0 rounded-xl border border-violet-500/25 bg-violet-500/10 px-2 py-2.5 text-center sm:px-3 sm:py-3 dark:border-violet-500/30 dark:bg-violet-500/15"
                title="Suma de story points en tareas completadas"
              >
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase sm:text-xs">
                  Puntos hechos
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-violet-700 sm:mt-1 sm:text-3xl dark:text-violet-300">
                  {pointsDone}
                </p>
              </div>
            </div>
          </div>
        </div>

        {basicOnly ? null : (
          <>
        <div className={cardClass}>
          <ChartSectionHeader
            kicker="Ritmo"
            title="Ritmo diario + tendencia"
            description="Las barras muestran cuántas tareas se cerraron cada día y la línea muestra el acumulado. Es una vista rápida para entender si el ritmo fue constante o se concentró al final."
          />
          {completionSeries.length <= 1 ? (
            <ChartPlaceholder
              size="composed"
              title="Aún no hay curva de tendencia"
              description={
                completed === 0
                  ? "No hay tareas completadas en este cierre, así que no hay fechas de cierre en Hecho que agrupar por día."
                  : "Hace falta al menos dos días distintos con tareas pasadas a Hecho (según la fecha de última actualización guardada al cierre) para dibujar barras diarias y la línea acumulada."
              }
              tip="Cuando el trabajo cerrado se reparte en varios días, este gráfico ayuda a ver si el ritmo fue estable o hubo picos al final."
            />
          ) : (
            <ChartContainer
              config={composedChartConfig}
              className="mt-6 h-60 w-full max-w-full min-w-0 touch-pan-x touch-pan-y sm:h-72"
            >
              <ComposedChart
                data={completionSeries}
                margin={composedMargins}
              >
                <defs>
                  <linearGradient
                    id={areaGradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--color-daily)"
                      stopOpacity={0.95}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-daily)"
                      stopOpacity={0.35}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={isCompactCharts ? 6 : 10}
                  tick={composedAxisTick}
                  interval="preserveStartEnd"
                  angle={isCompactCharts ? -32 : 0}
                  textAnchor={isCompactCharts ? "end" : "middle"}
                  height={isCompactCharts ? 54 : undefined}
                />
                <YAxis
                  yAxisId="daily"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                  width={yTasksDailyW}
                  tick={composedAxisTick}
                  domain={[0, Math.max(maxDaily, 1)]}
                />
                <YAxis
                  yAxisId="cum"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                  width={yTasksCumW}
                  tick={composedAxisTick}
                  domain={[0, Math.max(maxCumulative, 1)]}
                />
                <ChartTooltip
                  cursor={{
                    stroke: "var(--border)",
                    strokeDasharray: "4 4",
                  }}
                  content={<ChartTooltipContent />}
                />
                <ChartLegend
                  verticalAlign="top"
                  content={
                    <ChartLegendContent
                      className={
                        isCompactCharts
                          ? "pt-0 pb-2 flex-wrap justify-center gap-x-3 gap-y-1"
                          : "pt-0 pb-2 justify-start"
                      }
                    />
                  }
                />
                <Bar
                  yAxisId="daily"
                  dataKey="daily"
                  name="daily"
                  fill={`url(#${areaGradientId})`}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={isCompactCharts ? 34 : 48}
                />
                <Line
                  yAxisId="cum"
                  type="monotone"
                  dataKey="cumulative"
                  name="cumulative"
                  stroke="var(--color-cumulative)"
                  strokeWidth={isCompactCharts ? 2 : 2.5}
                  dot={{
                    r: isCompactCharts ? 2.5 : 3,
                    fill: "var(--color-cumulative)",
                    strokeWidth: 0,
                  }}
                  activeDot={{ r: isCompactCharts ? 4 : 5 }}
                />
              </ComposedChart>
            </ChartContainer>
          )}
        </div>

        <div className={cardClass}>
          <ChartSectionHeader
            kicker="Estimación"
            title="Story points en el tiempo"
            description="Este gráfico enseña los puntos entregados por día y su acumulado. Solo cuenta tareas completadas con story points numérico y ayuda a comparar la capacidad de entrega entre sprints."
          />
          {pointsDone === 0 ? (
            <ChartPlaceholder
              size="composed"
              title={
                completed === 0
                  ? "Sin puntos que mostrar en el tiempo"
                  : "Story points no usados en las tareas hechas"
              }
              description={
                completed === 0
                  ? "No hay tareas en estado Hecho en este cierre, así que no hay story points que situar por día."
                  : "Ninguna tarea completada tenía story points numérico guardado al cierre. El gráfico de tareas arriba sigue mostrando el ritmo en número de tarjetas."
              }
              tip={STORY_POINTS_WHY_TIP}
            />
          ) : spCompletionSeries.length === 0 ? (
            <ChartPlaceholder
              size="composed"
              title="Puntos sin fechas en el cierre"
              description="Hay story points en tareas hechas, pero no hay fecha de última actualización al cierre por día para colocarlas en la línea de tiempo. Sin esas fechas no podemos dibujar barras ni acumulado por día."
              tip="Si en el futuro cada hecha guarda bien su fecha de actividad al cerrar, aquí verás el mismo patrón que en el gráfico de tareas, pero en puntos."
            />
          ) : spCompletionSeries.length <= 1 ? (
            <ChartPlaceholder
              size="composed"
              title="Pocos días con entrega de puntos"
              description="Hace falta al menos dos días distintos en los que se completara trabajo con story points para combinar barras (puntos ese día) y línea (acumulado)."
              tip="Si todo el valor en puntos cayó en un solo día, el número total sigue viéndose en la tarjeta «Puntos hechos» del resumen superior."
            />
          ) : (
            <ChartContainer
              config={spPointsComposedConfig}
              className="mt-6 h-60 w-full max-w-full min-w-0 touch-pan-x touch-pan-y sm:h-72"
            >
              <ComposedChart
                data={spCompletionSeries}
                margin={composedMargins}
              >
                <defs>
                  <linearGradient
                    id={spPointsBarGradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--color-pointsDaily)"
                      stopOpacity={0.95}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-pointsDaily)"
                      stopOpacity={0.35}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={isCompactCharts ? 6 : 10}
                  tick={composedAxisTick}
                  interval="preserveStartEnd"
                  angle={isCompactCharts ? -32 : 0}
                  textAnchor={isCompactCharts ? "end" : "middle"}
                  height={isCompactCharts ? 54 : undefined}
                />
                <YAxis
                  yAxisId="spDaily"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                  width={ySpDailyW}
                  tick={composedAxisTick}
                  domain={[0, Math.max(maxSpPointsDaily, 1)]}
                />
                <YAxis
                  yAxisId="spCum"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                  width={ySpCumW}
                  tick={composedAxisTick}
                  domain={[0, Math.max(maxSpPointsCumulative, 1)]}
                />
                <ChartTooltip
                  cursor={{
                    stroke: "var(--border)",
                    strokeDasharray: "4 4",
                  }}
                  content={<ChartTooltipContent />}
                />
                <ChartLegend
                  verticalAlign="top"
                  content={
                    <ChartLegendContent
                      className={
                        isCompactCharts
                          ? "pt-0 pb-2 flex-wrap justify-center gap-x-3 gap-y-1"
                          : "pt-0 pb-2 justify-start"
                      }
                    />
                  }
                />
                <Bar
                  yAxisId="spDaily"
                  dataKey="pointsDaily"
                  name="pointsDaily"
                  fill={`url(#${spPointsBarGradientId})`}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={isCompactCharts ? 34 : 48}
                />
                <Line
                  yAxisId="spCum"
                  type="monotone"
                  dataKey="pointsCumulative"
                  name="pointsCumulative"
                  stroke="var(--color-pointsCumulative)"
                  strokeWidth={isCompactCharts ? 2 : 2.5}
                  dot={{
                    r: isCompactCharts ? 2.5 : 3,
                    fill: "var(--color-pointsCumulative)",
                    strokeWidth: 0,
                  }}
                  activeDot={{ r: isCompactCharts ? 4 : 5 }}
                />
              </ComposedChart>
            </ChartContainer>
          )}
        </div>

        <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
          <div className={cardClass}>
            <ChartSectionHeader
              kicker="Flujo"
              title="Dónde quedó el trabajo"
              description="Muestra cómo quedó repartido el trabajo por columnas al cierre. Verde indica tareas hechas y rojo tareas pendientes. Sirve para detectar acumulación de trabajo en fases concretas."
            />
            {columnStackRows.length === 0 ? (
              <ChartPlaceholder
                size="columnChart"
                title="Sin columnas en el cierre"
                description="No hay filas de tareas con columna asociada en este informe; es un caso poco habitual."
              />
            ) : (
              <>
                {columnsTruncated ? (
                  <p className="text-muted-foreground mt-3 text-xs leading-5 sm:text-xs sm:leading-snug">
                    Mostrando las {MAX_COLUMN_ROWS} columnas con más tareas de{" "}
                    {columnDistinctCount} distintas.
                  </p>
                ) : null}
                <ChartContainer
                  config={columnStackConfig}
                  className="mt-5 w-full max-w-full min-w-0 touch-pan-x touch-pan-y"
                  style={{ height: columnBarChartPixelHeight }}
                >
                  <BarChart
                    accessibilityLayer
                    data={columnStackRows}
                    layout="vertical"
                    margin={{
                      left: 2,
                      right: isCompactCharts ? 10 : 16,
                      top: 6,
                      bottom: 6,
                    }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={composedAxisTick}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={yColumnLabelW}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval={0}
                      tick={composedAxisTick}
                      tickFormatter={(value) => {
                        const labelText = String(value);
                        const maxLen = isCompactCharts ? 14 : 20;
                        const sliceLen = isCompactCharts ? 12 : 18;
                        return labelText.length > maxLen
                          ? `${labelText.slice(0, sliceLen)}…`
                          : labelText;
                      }}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                      content={<ChartTooltipContent />}
                    />
                    <ChartLegend
                      verticalAlign="bottom"
                      content={
                        <ChartLegendContent
                          className={
                            isCompactCharts
                              ? "flex-wrap justify-center gap-x-3 gap-y-1 pb-1"
                              : ""
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="hechas"
                      stackId="col"
                      fill="var(--color-hechas)"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="pendientes"
                      stackId="col"
                      fill="var(--color-pendientes)"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ChartContainer>
              </>
            )}
          </div>

          <div className={cardClass}>
            <ChartSectionHeader
              kicker="Clasificación"
              title="Etiquetas en las tareas"
              description={`Cuenta cuántas tareas del cierre usaron cada etiqueta. Cada tarea suma una sola vez por etiqueta. Si hay muchas etiquetas, se muestran las ${MAX_LABEL_BARS} más usadas.`}
            />
            {labelBarDisplay.rows.length === 0 ? (
              <ChartPlaceholder
                size="labelChart"
                title="Sin etiquetas en este cierre"
                description="Ninguna tarea del sprint cerrado llevaba etiquetas guardadas al momento del cierre."
                tip="Usar etiquetas (bug, frontend, cliente…) agrupa trabajo por tema y hace más claros los informes y filtros en tableros tipo Trello o Jira."
              />
            ) : (
              <>
                {labelBarDisplay.truncated ? (
                  <p className="text-muted-foreground mt-3 text-xs leading-5 sm:text-xs sm:leading-snug">
                    Mostrando las {MAX_LABEL_BARS} etiquetas más frecuentes de{" "}
                    {labelBarDisplay.totalDistinct} distintas.
                  </p>
                ) : null}
                <ChartContainer
                  config={labelBarChartConfig}
                  className="mt-5 w-full max-w-full min-w-0 touch-pan-x touch-pan-y"
                  style={{ height: labelBarChartPixelHeight }}
                >
                  <BarChart
                    accessibilityLayer
                    data={labelBarDisplay.rows}
                    layout="vertical"
                    margin={{
                      left: 2,
                      right: isCompactCharts ? 10 : 18,
                      top: 6,
                      bottom: 6,
                    }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={composedAxisTick}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={yTagLabelW}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval={0}
                      tick={composedAxisTick}
                      tickFormatter={(value) => {
                        const labelText = String(value);
                        const maxLen = isCompactCharts ? 14 : 22;
                        const sliceLen = isCompactCharts ? 12 : 20;
                        return labelText.length > maxLen
                          ? `${labelText.slice(0, sliceLen)}…`
                          : labelText;
                      }}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                      content={<ChartTooltipContent />}
                    />
                    <Bar
                      dataKey="count"
                      name={labelBarChartConfig.count.label}
                      radius={[0, 5, 5, 0]}
                      maxBarSize={22}
                    >
                      {labelBarDisplay.rows.map((row) => (
                        <Cell
                          key={row.name}
                          fill={taskLabelChartBarFill(row.color)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </>
            )}
          </div>
        </div>
          </>
        )}
      </div>
    </section>
  );
}
