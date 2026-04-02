import { IsIn, IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BoardRole } from '../schemas/board.schema';

const INVITE_ROLES = [
  BoardRole.ADMIN,
  BoardRole.EDITOR,
  BoardRole.VIEWER,
] as const;

export class InviteBoardMemberDto {
  @ApiProperty({ description: 'ID del usuario a invitar' })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: INVITE_ROLES,
    description: 'Rol en el tablero (no se asigna owner por aquí)',
  })
  @IsIn([...INVITE_ROLES], {
    message: 'El rol debe ser admin, editor o viewer',
  })
  role: (typeof INVITE_ROLES)[number];
}
