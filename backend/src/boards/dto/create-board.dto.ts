import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty({ message: 'El título del tablero es obligatorio' })
  @MaxLength(100, { message: 'El título no puede exceder los 100 caracteres' })
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripción es demasiado larga' })
  description?: string;
  // No pedimos el ownerIds, ni el slug.
  // El owner se sacará del JWT (req.user) en el controlador.
  // El slug se generará a partir del 'title' en el Service.
}
