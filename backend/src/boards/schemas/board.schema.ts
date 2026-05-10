import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum BoardRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export type BoardColumnKind = 'workflow' | 'done' | 'archived';
export type SprintSnapshotLabelColor =
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'purple'
  | 'blue'
  | 'sky'
  | 'gray';

@Schema({ _id: false })
export class BoardMember {
  // Usuario del tablero
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  // Rol del usuario
  @Prop({ type: String, enum: BoardRole, default: BoardRole.VIEWER })
  role: BoardRole;
}
export const BoardMemberSchema = SchemaFactory.createForClass(BoardMember);

@Schema()
export class BoardColumn {
  // Id interno de la columna
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  // Orden para mover la columna
  @Prop({ type: String, default: 'a0' })
  order: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Task' }] })
  tasks: Types.ObjectId[];

  @Prop({
    type: String,
    enum: ['workflow', 'done', 'archived'],
    default: 'workflow',
  })
  columnKind: BoardColumnKind;

  @Prop({ type: Date, required: false })
  archivedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  archivedBy?: Types.ObjectId;
}
export const BoardColumnSchema = SchemaFactory.createForClass(BoardColumn);

@Schema()
export class BoardSprint {
  // Id del sprint
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  @Prop({ type: Date, required: false })
  plannedEndAt?: Date;

  @Prop({ type: String, required: false, trim: true, maxlength: 2000 })
  objective?: string;
}

export const BoardSprintSchema = SchemaFactory.createForClass(BoardSprint);

const SPRINT_SNAPSHOT_LABEL_COLORS: SprintSnapshotLabelColor[] = [
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'blue',
  'sky',
  'gray',
];

@Schema({ _id: false })
export class SprintClosedTaskLabel {
  @Prop({ required: true, trim: true, maxlength: 24 })
  name: string;

  @Prop({
    type: String,
    enum: SPRINT_SNAPSHOT_LABEL_COLORS,
    default: 'blue',
  })
  color: SprintSnapshotLabelColor;
}
export const SprintClosedTaskLabelSchema = SchemaFactory.createForClass(
  SprintClosedTaskLabel,
);

@Schema({ _id: false })
export class SprintClosedTaskSnapshot {
  // Foto de la tarea al cerrar sprint
  @Prop({ type: Types.ObjectId, required: true })
  taskId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: Types.ObjectId, required: true })
  columnId: Types.ObjectId;

  @Prop({ type: String, required: true })
  columnTitleAtClose: string;

  @Prop({ type: Boolean, required: true })
  wasCompleted: boolean;

  @Prop({ type: Number, required: false })
  storyPointsWhenDone?: number;

  @Prop({ type: Date, required: false })
  taskUpdatedAtAtClose?: Date;

  @Prop({ type: [Types.ObjectId], default: [] })
  assigneeIdsAtClose: Types.ObjectId[];

  @Prop({ type: [SprintClosedTaskLabelSchema], default: [] })
  labelsAtClose: SprintClosedTaskLabel[];
}
export const SprintClosedTaskSnapshotSchema = SchemaFactory.createForClass(
  SprintClosedTaskSnapshot,
);

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

  @Prop({ type: String, required: false, trim: true, maxlength: 2000 })
  objective?: string;

  @Prop({ type: [SprintClosedTaskSnapshotSchema], default: [] })
  taskSnapshots: SprintClosedTaskSnapshot[];
}
export const BoardClosedSprintRecordSchema = SchemaFactory.createForClass(
  BoardClosedSprintRecord,
);

export type BoardDocument = HydratedDocument<Board>;

@Schema({ timestamps: true })
export class Board {
  // Documento principal del tablero
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

  // Columnas del tablero
  @Prop({ type: [BoardColumnSchema], default: [] })
  columns: BoardColumn[];

  @Prop({ type: Boolean, default: false })
  sprintsEnabled: boolean;

  @Prop({ type: [BoardSprintSchema], default: [] })
  sprints: BoardSprint[];

  // Id del sprint activo
  @Prop({ type: Types.ObjectId, required: false })
  activeSprintId?: Types.ObjectId;

  @Prop({ type: [BoardClosedSprintRecordSchema], default: [] })
  closedSprintRecords: BoardClosedSprintRecord[];
}

export const BoardSchema = SchemaFactory.createForClass(Board);
