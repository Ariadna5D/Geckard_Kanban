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

/**
 * Asegura protocolo en la url
 */
function prependHttpUrl(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const urlText = value.trim();
  if (!urlText) {
    return urlText;
  }
  if (!/^https?:\/\//i.test(urlText)) {
    return `https://${urlText}`;
  }
  return urlText;
}

/**
 * Representa una etiqueta simple de la tarea
 */
class TaskLabelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  name: string;

  @IsString()
  @IsIn(['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'gray'])
  color: string;
}

/**
 * Representa un enlace relacionado con la tarea
 */
class TaskLinkDto {
  // Normaliza url para aceptar dominio sin protocolo
  @Transform(({ value }) => prependHttpUrl(value))
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'URL no valida' },
  )
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

/**
 * Representa un item del checklist de la tarea
 */
class TaskChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;

  @IsOptional()
  @IsBoolean()
  checked?: boolean;
}

/**
 * Reune todos los datos permitidos para crear una tarea
 */
export class CreateTaskDto {
  /**
   * Titulo principal de la tarea
   */
  @ApiProperty({
    example: 'Configurar base de datos MongoDB',
    description: 'Titulo de la tarea',
  })
  @IsString()
  @IsNotEmpty({ message: 'El titulo es obligatorio' })
  @MaxLength(150, { message: 'El titulo es demasiado largo' })
  title: string;

  /**
   * Descripcion amplia en markdown
   */
  @ApiProperty({
    required: false,
    example: 'Instalar Mongoose y crear esquemas base.',
    description: 'Descripcion de la tarea',
  })
  @IsString()
  @IsOptional()
  @MaxLength(3000, { message: 'La descripcion es demasiado larga' })
  description?: string;

  /**
   * Id del tablero donde se crea la tarea
   */
  @ApiProperty({
    example: '60d0fe4f5311236168a109ca',
    description: 'ID del tablero al que pertenece',
  })
  // Valida id mongo para evitar referencia rota de tablero
  @IsMongoId({ message: 'BoardId no valido' })
  @IsNotEmpty()
  boardId: string;

  /**
   * Id de la columna destino al crear la tarea
   */
  @ApiProperty({
    example: '60d0fe4f5311236168a109cb',
    description: 'ID de la columna donde se creará',
  })
  @IsMongoId({ message: 'ColumnId no valido' })
  @IsNotEmpty()
  columnId: string;

  /**
   * Id de sprint activo opcional
   */
  @ApiProperty({
    required: false,
    example: '60d0fe4f5311236168a109cc',
    description:
      'Optional active sprint id (only when the board has sprints enabled)',
  })
  @IsMongoId({ message: 'SprintId no valido' })
  @IsOptional()
  sprintId?: string;

  /**
   * Orden fraccional calculado por el frontend
   */
  @ApiProperty({
    required: true,
    example: 'a0',
    description: 'Posicion de la tarea en la columna',
  })
  // El frontend manda orden fraccional para ubicar tarjeta
  @IsString()
  @IsNotEmpty({
    message: 'El orden es obligatorio',
  })
  order: string;

  /**
   * Prioridad funcional de la tarea
   */
  @ApiProperty({
    enum: TaskPriority,
    required: false,
    default: TaskPriority.MEDIUM,
  })
  @IsEnum(TaskPriority, { message: 'Prioridad no valida' })
  @IsOptional()
  priority?: TaskPriority;

  /**
   * Puntos de historia segun escala fibonacci
   */
  @ApiProperty({
    required: false,
    example: 5,
    description: 'Puntos de historia (Secuencia de Fibonacci)',
  })
  @IsNumber()
  @IsOptional()
  storyPoints?: number;

  /**
   * Fecha limite opcional de entrega
   */
  @ApiProperty({
    required: false,
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString({}, { message: 'Fecha no valida' })
  @IsOptional()
  dueDate?: string;

  /**
   * Etiquetas de clasificacion para la tarea
   */
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
  @ArrayMaxSize(6, { message: 'Maximo 6 etiquetas' })
  @IsOptional()
  labels?: TaskLabelDto[];

  /**
   * Lista de ids de usuarios asignados
   */
  @ApiProperty({
    required: false,
    type: [String],
    description: 'Array de IDs de los usuarios asignados',
  })
  // Lista simple para asignar responsables
  @IsArray()
  @IsMongoId({
    each: true,
    message: 'AssigneeId no valido',
  })
  @IsOptional()
  assigneeIds?: string[];

  /**
   * Enlaces de apoyo relacionados con la tarea
   */
  @ApiProperty({
    required: false,
    type: [Object],
    example: [{ url: 'https://example.com', title: 'Docs' }],
    description: 'Enlaces relacionados con la tarea',
  })
  // Links de apoyo como documentacion o tickets
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskLinkDto)
  @ArrayMaxSize(20, { message: 'Maximo 20 enlaces' })
  @IsOptional()
  links?: TaskLinkDto[];

  /**
   * Checklist simple de pasos o subtareas
   */
  @ApiProperty({
    required: false,
    type: [Object],
    example: [{ text: 'Configurar entorno', checked: false }],
    description: 'Checklist de subtareas',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskChecklistItemDto)
  @ArrayMaxSize(50, { message: 'Maximo 50 items' })
  @IsOptional()
  checklist?: TaskChecklistItemDto[];
}
