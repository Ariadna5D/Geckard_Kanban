import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;
export const STORY_POINT_SCALE = [1, 2, 3, 5, 8, 13] as const;
export type StoryPointValue = (typeof STORY_POINT_SCALE)[number];

// Definimos las prioridades típicas de Scrum/Linear
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export type TaskLabelColor =
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'purple'
  | 'blue'
  | 'sky'
  | 'gray';

export class TaskLabel {
  @Prop({ type: String, required: true, trim: true, maxlength: 24 })
  name: string;

  @Prop({
    type: String,
    required: true,
    enum: ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'gray'],
    default: 'blue',
  })
  color: TaskLabelColor;
}

export type StoryPointVotingStatus = 'idle' | 'voting' | 'revealed' | 'locked';

export class TaskStoryPointVote {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, enum: STORY_POINT_SCALE })
  value: StoryPointValue;

  @Prop({ type: Date, default: Date.now })
  votedAt: Date;
}

/** Enlace adjunto en el detalle de la tarea (URL + título opcional). */
@Schema({ _id: false })
export class TaskLink {
  @Prop({ type: String, required: true, trim: true, maxlength: 2048 })
  url: string;

  @Prop({ type: String, trim: true, maxlength: 200 })
  title?: string;
}
export const TaskLinkSchema = SchemaFactory.createForClass(TaskLink);

/** Ítem de checklist en el detalle de la tarea. */
@Schema({ _id: false })
export class TaskChecklistItem {
  @Prop({ type: String, required: true, trim: true, maxlength: 500 })
  text: string;

  @Prop({ type: Boolean, default: false })
  checked: boolean;
}
export const TaskChecklistItemSchema =
  SchemaFactory.createForClass(TaskChecklistItem);

@Schema({ timestamps: true })
export class Task {
  // --- CAMPOS CORE ---

  // Título de la tarea (obligatorio)
  @Prop({ required: true, trim: true })
  title: string;
  // Descripción opcional para detallar la tarea
  @Prop({ trim: true, default: '' })
  description: string;

  // Referencia al Board padre (para consultas rápidas sin hacer join con Column)
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true, index: true })
  boardId: Types.ObjectId;

  // Saber en qué columna exacta está renderizada
  @Prop({
    type: Types.ObjectId,
    ref: 'Board.columns',
    required: true,
    index: true,
  })
  columnId: Types.ObjectId;

  /** Optional link to the board active sprint (only meaningful when the board enables sprints). */
  @Prop({ type: Types.ObjectId, required: false, index: true })
  sprintId?: Types.ObjectId;

  /** Hidden from board views, but still restorable. */
  @Prop({ type: Date, required: false, index: true })
  archivedAt?: Date;

  /** Who archived the task (for audit and archive panel context). */
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  archivedBy?: Types.ObjectId;

  /**
   * Si se archivó junto con una columna; al restaurar la columna se restauran estas tareas.
   */
  @Prop({ type: Types.ObjectId, required: false, index: true })
  archivedWithColumnId?: Types.ObjectId;

  // Orden dentro de la columna para mantener el orden de las tareas (se actualiza al mover tareas)
  @Prop({ type: String, required: true })
  order: string;

  // --- CAMPOS SCRUM  ---

  @Prop({ type: String, enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  // Puntos de historia (normalmente Fibonacci: 1, 2, 3, 5, 8, 13...)
  @Prop({ type: Number, required: false, enum: STORY_POINT_SCALE })
  storyPoints?: number;

  // Fecha de vencimiento opcional
  @Prop({ type: Date, required: false })
  dueDate?: Date;

  // Etiquetas cortas para contexto visual rápido en la tarjeta
  @Prop({ type: [TaskLabel], default: [] })
  labels: TaskLabel[];

  // Array de usuarios asignados (para que salgan sus avatares en la tarjeta)
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  assigneeIds: Types.ObjectId[];

  @Prop({ type: [TaskLinkSchema], default: [] })
  links: TaskLink[];

  @Prop({ type: [TaskChecklistItemSchema], default: [] })
  checklist: TaskChecklistItem[];

  // --- VOTACIÓN DE STORY POINTS (Planning Poker sin websockets) ---
  @Prop({
    type: String,
    enum: ['idle', 'voting', 'revealed', 'locked'],
    default: 'idle',
  })
  storyPointVotingStatus: StoryPointVotingStatus;

  @Prop({ type: [TaskStoryPointVote], default: [] })
  storyPointVotes: TaskStoryPointVote[];

  @Prop({ type: Date, required: false })
  storyPointRevealedAt?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
