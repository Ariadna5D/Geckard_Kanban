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
  ArrayMaxSize,
  ValidateNested,
  IsIn,
  IsUrl,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskPriority } from '../schemas/task.schema';
import { Transform, Type } from 'class-transformer';

function prependHttpUrl(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const urlText = value.trim();
  if (!urlText) return urlText;
  if (!/^https?:\/\//i.test(urlText)) return `https://${urlText}`;
  return urlText;
}

class TaskLabelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  name: string;

  @IsString()
  @IsIn(['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'gray'])
  color: string;
}

class TaskLinkDto {
  @Transform(({ value }) => prependHttpUrl(value))
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'La URL debe ser http o https' },
  )
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

class TaskChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;

  @IsOptional()
  @IsBoolean()
  checked?: boolean;
}

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

  @ApiProperty({
    required: false,
    example: '60d0fe4f5311236168a109cc',
    description: 'Optional active sprint id (only when the board has sprints enabled)',
  })
  @IsMongoId({ message: 'El sprintId debe ser un ID válido de MongoDB' })
  @IsOptional()
  sprintId?: string;

  // El motor del Drag & Drop. Usaremos números flotantes o enteros espaciados para reordenar.
  // --- EL MOTOR DEL DRAG & DROP ---
  @ApiProperty({
    required: true,
    example: 'a0',
    description:
      'Posición de la tarea en la columna (Índice fraccional generado por el frontend)',
  })
  @IsString()
  @IsNotEmpty({
    message: 'El orden (order) es obligatorio para el posicionamiento',
  })
  order: string;

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

  @ApiProperty({
    required: false,
    type: [Object],
    example: [
      { name: 'backend', color: 'blue' },
      { name: 'bug', color: 'red' },
    ],
    description: 'Etiquetas (nombre + color) de la tarea',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskLabelDto)
  @ArrayMaxSize(6, { message: 'Máximo 6 etiquetas por tarea' })
  @IsOptional()
  labels?: TaskLabelDto[];

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

  @ApiProperty({
    required: false,
    type: [Object],
    example: [{ url: 'https://example.com', title: 'Docs' }],
    description: 'Enlaces relacionados con la tarea',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskLinkDto)
  @ArrayMaxSize(20, { message: 'Máximo 20 enlaces por tarea' })
  @IsOptional()
  links?: TaskLinkDto[];

  @ApiProperty({
    required: false,
    type: [Object],
    example: [{ text: 'Paso 1', checked: false }],
    description: 'Checklist de subtareas',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskChecklistItemDto)
  @ArrayMaxSize(50, { message: 'Máximo 50 ítems en checklist' })
  @IsOptional()
  checklist?: TaskChecklistItemDto[];
}
