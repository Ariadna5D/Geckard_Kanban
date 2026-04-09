import { IsIn, IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BoardRole } from '../schemas/board.schema';

// ROLES PERMITIDOS PARA INVITAR
const INVITE_ROLES = [
  BoardRole.ADMIN,
  BoardRole.EDITOR,
  BoardRole.VIEWER,
] as const;

export class InviteBoardMemberDto {
  // ID DEL USUARIO A INVITAR
  @ApiProperty({ description: 'ID del usuario a invitar' })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  // ROL EN EL TABLERO
  @ApiProperty({
    enum: INVITE_ROLES,
    description: 'Rol en el tablero (no se asigna owner por aquí)',
  })
  @IsIn([...INVITE_ROLES], {
    message: 'El rol debe ser admin, editor o viewer',
  })
  role: (typeof INVITE_ROLES)[number];
}
