import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

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

  // Orden dentro de la columna para mantener el orden de las tareas (se actualiza al mover tareas)
  @Prop({ type: String, required: true })
  order: string;

  // --- CAMPOS SCRUM  ---

  @Prop({ type: String, enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  // Puntos de historia (normalmente Fibonacci: 1, 2, 3, 5, 8, 13...)
  @Prop({ type: Number, required: false })
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
}

export const TaskSchema = SchemaFactory.createForClass(Task);
