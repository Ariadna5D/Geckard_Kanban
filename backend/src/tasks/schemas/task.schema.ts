import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;
export const STORY_POINT_SCALE = [1, 2, 3, 5, 8, 13] as const;
export type StoryPointValue = (typeof STORY_POINT_SCALE)[number];

// Prioridades permitidas
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

// Estructura de etiqueta
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

// Voto individual de story points
export class TaskStoryPointVote {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, enum: STORY_POINT_SCALE })
  value: StoryPointValue;

  @Prop({ type: Date, default: Date.now })
  votedAt: Date;
}

// Enlace de la tarea
@Schema({ _id: false })
export class TaskLink {
  @Prop({ type: String, required: true, trim: true, maxlength: 2048 })
  url: string;

  @Prop({ type: String, trim: true, maxlength: 200 })
  title?: string;
}
export const TaskLinkSchema = SchemaFactory.createForClass(TaskLink);

// Item de checklist
@Schema({ _id: false })
export class TaskChecklistItem {
  @Prop({ type: String, required: true, trim: true, maxlength: 500 })
  text: string;

  @Prop({ type: Boolean, default: false })
  checked: boolean;
}
export const TaskChecklistItemSchema =
  SchemaFactory.createForClass(TaskChecklistItem);

// Documento principal de tarea
@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  // Referencia de tablero
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true, index: true })
  boardId: Types.ObjectId;

  // Referencia de columna
  @Prop({
    type: Types.ObjectId,
    ref: 'Board.columns',
    required: true,
    index: true,
  })
  columnId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false, index: true })
  sprintId?: Types.ObjectId;

  @Prop({ type: Date, required: false, index: true })
  archivedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  archivedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false, index: true })
  archivedWithColumnId?: Types.ObjectId;

  // Orden de la tarea en columna
  @Prop({ type: String, required: true })
  order: string;

  @Prop({ type: String, enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Prop({ type: Number, required: false, enum: STORY_POINT_SCALE })
  storyPoints?: number;

  @Prop({ type: Date, required: false })
  dueDate?: Date;

  @Prop({ type: [TaskLabel], default: [] })
  labels: TaskLabel[];

  // Lista de usuarios asignados
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  assigneeIds: Types.ObjectId[];

  @Prop({ type: [TaskLinkSchema], default: [] })
  links: TaskLink[];

  @Prop({ type: [TaskChecklistItemSchema], default: [] })
  checklist: TaskChecklistItem[];

  // Estado de votacion de story points
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
