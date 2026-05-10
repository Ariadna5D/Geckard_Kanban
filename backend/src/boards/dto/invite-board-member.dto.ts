import { IsIn, IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BoardRole } from '../schemas/board.schema';

const INVITE_ROLES = [
  BoardRole.ADMIN,
  BoardRole.EDITOR,
  BoardRole.VIEWER,
] as const;

export class InviteBoardMemberDto {
  /**
   * Id del usuario que se va a invitar
   */
  @ApiProperty({ description: 'ID del usuario a invitar' })
  // Usuario destino de la invitacion
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  /**
   * Rol que tendra el usuario dentro del tablero
   */
  @ApiProperty({
    enum: INVITE_ROLES,
    description: 'Rol en el tablero',
  })
  // Rol permitido desde UI sin incluir owner
  @IsIn([...INVITE_ROLES], {
    message: 'Rol no valido',
  })
  role: (typeof INVITE_ROLES)[number];
}
