import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SprintDocument = HydratedDocument<Sprint>;

export type SprintStatus = 'active' | 'completed';

@Schema({ timestamps: true })
export class Sprint {
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true, index: true })
  boardId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 500 })
  goal?: string;

  @Prop({ type: Date })
  startsAt?: Date;

  @Prop({ type: Date })
  endsAt?: Date;

  @Prop({
    type: String,
    enum: ['active', 'completed'],
    default: 'active',
    index: true,
  })
  status: SprintStatus;

  /** Orden en el desplegable del tablero (menor = más arriba). */
  @Prop({ type: Number, default: 0 })
  displayOrder: number;
}

export const SprintSchema = SchemaFactory.createForClass(Sprint);
SprintSchema.index({ boardId: 1, status: 1 });
