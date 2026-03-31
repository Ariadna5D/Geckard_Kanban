import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskPriority } from '../schemas/task.schema';

export class CreateTaskDto {
  // --- CAMPOS CORE ---

  // Título de la tarea (obligatorio)
  @ApiProperty({
    example: 'Configurar base de datos MongoDB',
    description: 'El título de la tarea',
  })
  @IsString()
  @IsNotEmpty({ message: 'El título de la tarea es obligatorio' })
  @MaxLength(150, { message: 'El título no puede exceder los 150 caracteres' })
  title: string;

  // Descripción opcional para detallar la tarea
  @ApiProperty({
    required: false,
    example: 'Instalar Mongoose y crear esquemas base.',
    description: 'Descripción detallada en Markdown',
  })
  @IsString()
  @IsOptional()
  @MaxLength(3000, { message: 'La descripción es demasiado larga' })
  description?: string;

  // Referencia al Board padre (para consultas rápidas sin hacer join con Column)
  @ApiProperty({
    example: '60d0fe4f5311236168a109ca',
    description: 'ID del tablero al que pertenece',
  })
  @IsMongoId({ message: 'El boardId debe ser un ID válido de MongoDB' })
  @IsNotEmpty()
  boardId: string;

  // Saber en qué columna exacta está renderizada
  @ApiProperty({
    example: '60d0fe4f5311236168a109cb',
    description: 'ID de la columna donde se creará',
  })
  @IsMongoId({ message: 'El columnId debe ser un ID válido de MongoDB' })
  @IsNotEmpty()
  columnId: string;

  // El motor del Drag & Drop. Usaremos números flotantes o enteros espaciados para reordenar.
  @ApiProperty({
    required: false,
    example: 0,
    description: 'Posición de la tarea en la columna (Drag & Drop)',
  })
  @IsNumber()
  @IsOptional()
  order?: number;

  // --- CAMPOS SCRUM  ---

  // Prioridad de la tarea (baja, media, alta, urgente)
  @ApiProperty({
    enum: TaskPriority,
    required: false,
    default: TaskPriority.MEDIUM,
  })
  @IsEnum(TaskPriority, { message: 'Prioridad no válida' })
  @IsOptional()
  priority?: TaskPriority;

  // Puntos de historia (normalmente Fibonacci: 1, 2, 3, 5, 8, 13...)
  @ApiProperty({
    required: false,
    example: 5,
    description: 'Puntos de historia (Secuencia de Fibonacci)',
  })
  @IsNumber()
  @IsOptional()
  storyPoints?: number;

  // Fecha de vencimiento opcional
  @ApiProperty({
    required: false,
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString({}, { message: 'La fecha límite debe ser una fecha válida' })
  @IsOptional()
  dueDate?: string;

  // Array de usuarios asignados (para que salgan sus avatares en la tarjeta)
  @ApiProperty({
    required: false,
    type: [String],
    description: 'Array de IDs de los usuarios asignados',
  })
  @IsArray()
  @IsMongoId({
    each: true,
    message: 'Cada assigneeId debe ser un MongoID válido',
  })
  @IsOptional()
  assigneeIds?: string[];
}
