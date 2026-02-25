import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

// @Schema() le dice a Mongoose que esto será una colección en tu base de datos
@Schema({ timestamps: true }) 
export class Task {
  // El título es obligatorio para que nadie cree una tarea vacía en tu Kanban
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  // Por defecto, las tareas nuevas irán a la columna "To Do"
  @Prop({ default: 'To Do' })
  status: string;
}

export const TaskSchema = SchemaFactory.createForClass(Task);