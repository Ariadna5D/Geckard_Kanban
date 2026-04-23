import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum BoardRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

/** Used to know if a task was "done" when a sprint closed (for story points in the snapshot). */
export type BoardColumnKind = 'workflow' | 'done' | 'archived';

// 1. SUB-DOCUMENT: Board Member
@Schema({ _id: false })
export class BoardMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: BoardRole, default: BoardRole.VIEWER })
  role: BoardRole;
}
export const BoardMemberSchema = SchemaFactory.createForClass(BoardMember);

// 2. SUB-DOCUMENT: Board Column
@Schema()
export class BoardColumn {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  /**
   * Fractional index for horizontal drag and drop between columns.
   * First valid key from fractional-indexing (generateKeyBetween(null, null) → "a0").
   */
  @Prop({ type: String, default: 'a0' })
  order: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Task' }] })
  tasks: Types.ObjectId[];

  /**
   * `done` and `archived` columns count as completed work for sprint close snapshots.
   */
  @Prop({
    type: String,
    enum: ['workflow', 'done', 'archived'],
    default: 'workflow',
  })
  columnKind: BoardColumnKind;

  /** Si existe, la columna no se muestra en el tablero (archivada como las tareas). */
  @Prop({ type: Date, required: false })
  archivedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  archivedBy?: Types.ObjectId;
}
export const BoardColumnSchema = SchemaFactory.createForClass(BoardColumn);

/** Single active sprint row (board keeps at most one). */
@Schema()
export class BoardSprint {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  /** Planned finish (the real end is stored on the closed record when you close the sprint). */
  @Prop({ type: Date, required: false })
  plannedEndAt?: Date;

  /** Short description of what this sprint should achieve (optional). */
  @Prop({ type: String, required: false, trim: true, maxlength: 2000 })
  objective?: string;
}

export const BoardSprintSchema = SchemaFactory.createForClass(BoardSprint);

const SPRINT_SNAPSHOT_LABEL_COLORS = [
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'blue',
  'sky',
  'gray',
] as const;

/** Etiqueta congelada al cerrar el sprint (misma forma que en Task). */
@Schema({ _id: false })
export class SprintClosedTaskLabel {
  @Prop({ required: true, trim: true, maxlength: 24 })
  name: string;

  @Prop({
    type: String,
    enum: SPRINT_SNAPSHOT_LABEL_COLORS,
    default: 'blue',
  })
  color: (typeof SPRINT_SNAPSHOT_LABEL_COLORS)[number];
}
export const SprintClosedTaskLabelSchema = SchemaFactory.createForClass(
  SprintClosedTaskLabel,
);

/** One task row stored inside a closed sprint (frozen, not tied to live edits later). */
@Schema({ _id: false })
export class SprintClosedTaskSnapshot {
  @Prop({ type: Types.ObjectId, required: true })
  taskId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: Types.ObjectId, required: true })
  columnId: Types.ObjectId;

  /** Column title at close time (helps old reports if columns are renamed later). */
  @Prop({ type: String, required: true })
  columnTitleAtClose: string;

  @Prop({ type: Boolean, required: true })
  wasCompleted: boolean;

  /** Only set when the task was in a done/archived column at close and had points. */
  @Prop({ type: Number, required: false })
  storyPointsWhenDone?: number;

  /**
   * Task `updatedAt` at sprint close (proxy for activity; not exact completion time).
   * Used for charts on closed sprint reports.
   */
  @Prop({ type: Date, required: false })
  taskUpdatedAtAtClose?: Date;

  /** Assignees at close time (for per-user completed-task charts). */
  @Prop({ type: [Types.ObjectId], default: [] })
  assigneeIdsAtClose: Types.ObjectId[];

  /** Etiquetas de la tarea al cerrar el sprint (gráficos en historial). */
  @Prop({ type: [SprintClosedTaskLabelSchema], default: [] })
  labelsAtClose: SprintClosedTaskLabel[];
}
export const SprintClosedTaskSnapshotSchema = SchemaFactory.createForClass(
  SprintClosedTaskSnapshot,
);

/** History entry after closing a sprint (includes the frozen task list). */
@Schema({ _id: false })
export class BoardClosedSprintRecord {
  @Prop({ type: Types.ObjectId, required: true })
  sprintId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  sprintName: string;

  @Prop({ type: Date, required: true })
  closedAt: Date;

  @Prop({ type: Date, required: false })
  startedAt?: Date;

  @Prop({ type: Date, required: false })
  plannedEndAt?: Date;

  /** Copied from the active sprint at close time (if it was set). */
  @Prop({ type: String, required: false, trim: true, maxlength: 2000 })
  objective?: string;

  @Prop({ type: [SprintClosedTaskSnapshotSchema], default: [] })
  taskSnapshots: SprintClosedTaskSnapshot[];
}
export const BoardClosedSprintRecordSchema = SchemaFactory.createForClass(
  BoardClosedSprintRecord,
);

// 3. MAIN DOCUMENT: Board
export type BoardDocument = HydratedDocument<Board>;

@Schema({ timestamps: true })
export class Board {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId;

  @Prop({ type: [BoardMemberSchema], default: [] })
  members: BoardMember[];

  @Prop({ type: [BoardColumnSchema], default: [] })
  columns: BoardColumn[];

  /** Board admins turn this on in settings; editors can then run sprints. */
  @Prop({ type: Boolean, default: false })
  sprintsEnabled: boolean;

  /** Empty or one embedded sprint document. */
  @Prop({ type: [BoardSprintSchema], default: [] })
  sprints: BoardSprint[];

  /** Same id as the single row inside `sprints` when a sprint is running. */
  @Prop({ type: Types.ObjectId, required: false })
  activeSprintId?: Types.ObjectId;

  @Prop({ type: [BoardClosedSprintRecordSchema], default: [] })
  closedSprintRecords: BoardClosedSprintRecord[];
}

export const BoardSchema = SchemaFactory.createForClass(Board);
