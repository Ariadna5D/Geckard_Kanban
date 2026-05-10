import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Board,
  BoardDocument,
  BoardMember,
  BoardRole,
} from './schemas/board.schema';
import { UsersService } from '../users/users.service';
import { BoardActivityService } from './board-activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InviteBoardMemberDto } from './dto/invite-board-member.dto';
import { BoardsPermissionsService } from './boards-permissions.service';

const FREE_PLAN_MAX_BOARD_MEMBERS = 10;

type LeanMemberUser =
  | Types.ObjectId
  | {
      _id: Types.ObjectId;
      username?: string;
      email?: string;
      avatarUrl?: string;
    };

type LeanBoardMember = {
  user: LeanMemberUser;
  role: BoardRole;
};

type LeanPopulatedMemberUser = {
  _id: Types.ObjectId;
  username?: string;
  email?: string;
  avatarUrl?: string;
  userPlan?: string;
};

type LeanOwnerUser =
  | Types.ObjectId
  | {
      _id: Types.ObjectId;
      username?: string;
      email?: string;
      avatarUrl?: string;
      userPlan?: string;
    };

@Injectable()
export class BoardsMembersService {
  /**
   * Inyecta servicios para gestionar miembros e invitaciones
   */
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    private readonly usersService: UsersService,
    private readonly boardActivityService: BoardActivityService,
    private readonly notificationsService: NotificationsService,
    private readonly permissionsService: BoardsPermissionsService,
  ) {}

  /**
   * Convierte rol a nivel numerico para comparar jerarquia
   */
  private boardRoleRank(boardRole: BoardRole): number {
    switch (boardRole) {
      case BoardRole.VIEWER:
        return 1;
      case BoardRole.EDITOR:
        return 2;
      case BoardRole.ADMIN:
        return 3;
      case BoardRole.OWNER:
        return 4;
      default:
        return 0;
    }
  }

  /**
   * Busca email del actor para guardar actividad
   */
  private async resolveActorEmail(userId: string): Promise<string> {
    try {
      const user = await this.usersService.findById(userId);
      let email = '';
      if (user && typeof user.email === 'string') {
        email = user.email.trim();
      }
      if (email.length > 0) {
        return email;
      }
      return '(sin-email)';
    } catch {
      return '(sin-email)';
    }
  }

  /**
   * Valida limite de miembros cuando owner esta en plan free
   */
  private async assertOwnerCanAddMember(board: BoardDocument): Promise<void> {
    const ownerUser = await this.usersService.findById(board.owner.toString());
    let ownerPlan = 'free';
    if (
      ownerUser !== null &&
      ownerUser.userPlan !== undefined &&
      ownerUser.userPlan !== null
    ) {
      ownerPlan = ownerUser.userPlan;
    }
    if (
      ownerPlan === 'free' &&
      board.members.length >= FREE_PLAN_MAX_BOARD_MEMBERS
    ) {
      throw new ForbiddenException(
        'Con el plan Free solo puedes tener hasta 10 colaboradores en el tablero. Pasa a Pro para invitar sin límite.',
      );
    }
  }

  /**
   * Invita miembro nuevo o actualiza rol si ya estaba dentro
   */
  async inviteMember(
    boardId: string,
    dto: InviteBoardMemberDto,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    // Primero validamos que el usuario destino exista
    const target = await this.usersService.findById(dto.userId);
    if (!target) {
      throw new NotFoundException('No existe ese usuario.');
    }

    // Solo admin de tablero puede invitar o cambiar roles
    await this.permissionsService.assertMinBoardRole(
      boardId,
      actorUserId,
      BoardRole.ADMIN,
      isAppAdmin,
    );

    const board = await this.boardModel.findById(boardId).exec();

    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    const ownerId = board.owner.toString();
    if (dto.userId === ownerId) {
      throw new BadRequestException(
        'El propietario ya tiene acceso al tablero.',
      );
    }

    let existingMemberIndex = -1;
    for (let index = 0; index < board.members.length; index++) {
      if (board.members[index].user.toString() === dto.userId) {
        existingMemberIndex = index;
        break;
      }
    }

    // Si ya existe miembro solo cambiamos su rol
    if (existingMemberIndex >= 0) {
      if (board.members[existingMemberIndex].role === BoardRole.OWNER) {
        throw new BadRequestException(
          'No se puede cambiar el rol del propietario desde aquí.',
        );
      }
      board.members[existingMemberIndex].role = dto.role;
    } else {
      // Si no era miembro validamos plan y creamos invitacion pendiente
      await this.assertOwnerCanAddMember(board);
      await this.notificationsService.createBoardInvite({
        recipientUserId: dto.userId,
        actorUserId,
        actorEmail: await this.resolveActorEmail(actorUserId),
        boardId,
        boardTitle: board.title,
        boardSlug: board.slug,
        role: dto.role,
      });
    }
    const saved = existingMemberIndex >= 0 ? await board.save() : board;
    const actorEmail = await this.resolveActorEmail(actorUserId);
    let activityAction = 'member.invited';
    if (existingMemberIndex >= 0) {
      activityAction = 'member.role.updated';
    }
    let activityMessage = `Envió invitación a «${target.email}» como «${dto.role}».`;
    if (existingMemberIndex >= 0) {
      activityMessage = `Actualizó el rol de «${target.email}» a «${dto.role}».`;
    }
    await this.boardActivityService.record({
      boardId,
      actorUserId,
      actorEmail,
      entityType: 'member',
      action: activityAction,
      message: activityMessage,
      entityId: dto.userId,
    });
    return saved;
  }

  /**
   * Lista miembros con perfil basico y rol actual
   */
  async listMembers(
    boardId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<{
    ownerId: string;
    members: {
      userId: string;
      username: string;
      email: string;
      avatarUrl?: string;
      userPlan?: string;
      role: BoardRole;
    }[];
  }> {
    await this.permissionsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    // Popula datos basicos para no devolver ids sueltos
    const board = await this.boardModel
      .findById(boardId)
      .populate({
        path: 'owner',
        select: 'username email avatarUrl userPlan',
      })
      .populate({
        path: 'members.user',
        select: 'username email avatarUrl userPlan',
      })
      .lean()
      .exec();

    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    const rawOwner = board.owner as unknown as LeanOwnerUser;
    let ownerId = '';
    let ownerUsername = 'Usuario';
    let ownerEmail = '';
    let ownerAvatarUrl: string | undefined;
    let ownerPlan: string | undefined;
    if (rawOwner && typeof rawOwner === 'object' && '_id' in rawOwner) {
      const ownerUser = rawOwner as LeanPopulatedMemberUser;
      ownerId = ownerUser._id.toString();
      const rawOwnerUsername = ownerUser.username;
      if (
        typeof rawOwnerUsername === 'string' &&
        rawOwnerUsername.trim() !== ''
      ) {
        ownerUsername = rawOwnerUsername;
      }
      const rawOwnerEmail = ownerUser.email;
      if (typeof rawOwnerEmail === 'string') {
        ownerEmail = rawOwnerEmail;
      }
      // 2. Comprobamos si rawOwner es un objeto y no es nulo
      if (rawOwner && typeof rawOwner === 'object' && '_id' in rawOwner) {
        // 3. Hacemos el cast al tipo que ya tiene userPlan definido
        const ownerUser = rawOwner as LeanPopulatedMemberUser;

        if (ownerUser.userPlan) {
          ownerPlan = ownerUser.userPlan;
        }
      }
      if (
        ownerUser.avatarUrl !== undefined &&
        String(ownerUser.avatarUrl).trim() !== ''
      ) {
        ownerAvatarUrl = String(ownerUser.avatarUrl);
      }
    } else {
      ownerId = String(rawOwner);
    }
    const rawRows: {
      userId: string;
      username: string;
      email: string;
      avatarUrl?: string;
      userPlan?: string;
      role: BoardRole;
    }[] = [];

    const populatedMembers = board.members as unknown as LeanBoardMember[];
    // Normaliza tanto miembros populados como no populados
    for (let index = 0; index < populatedMembers.length; index++) {
      const item = populatedMembers[index];
      const data = item.user;
      let memberUserIdString: string;
      let displayUsername: string;
      let displayEmail: string;
      let displayAvatarUrl: string | undefined;
      let displayUserPlan: string | undefined;
      if (data && typeof data === 'object' && '_id' in data) {
        const userDocument = data as LeanPopulatedMemberUser;
        memberUserIdString = userDocument._id.toString();
        displayUsername =
          userDocument.username !== undefined
            ? userDocument.username
            : 'Usuario';
        displayEmail =
          userDocument.email !== undefined ? userDocument.email : '';
        if (
          userDocument.userPlan !== undefined &&
          userDocument.userPlan !== null &&
          String(userDocument.userPlan).trim() !== ''
        ) {
          displayUserPlan = String(userDocument.userPlan);
        } else {
          displayUserPlan = undefined;
        }
        if (
          userDocument.avatarUrl !== undefined &&
          String(userDocument.avatarUrl).trim() !== ''
        ) {
          displayAvatarUrl = String(userDocument.avatarUrl);
        } else {
          displayAvatarUrl = undefined;
        }
      } else {
        memberUserIdString = String(data);
        displayUsername = 'Usuario';
        displayEmail = '';
        displayAvatarUrl = undefined;
        displayUserPlan = undefined;
      }
      rawRows.push({
        userId: memberUserIdString,
        username: displayUsername,
        email: displayEmail,
        avatarUrl: displayAvatarUrl,
        userPlan: displayUserPlan,
        role: item.role,
      });
    }

    type MemberRow = {
      userId: string;
      username: string;
      email: string;
      avatarUrl?: string;
      userPlan?: string;
      role: BoardRole;
    };
    const dedupedMembers: MemberRow[] = [];
    // Metemos owner para que frontend siempre tenga username/avatar aunque no esté en members
    dedupedMembers.push({
      userId: ownerId,
      username: ownerUsername,
      email: ownerEmail,
      avatarUrl: ownerAvatarUrl,
      userPlan: ownerPlan,
      role: BoardRole.OWNER,
    });
    // Si aparece repetido se queda el rol mas alto
    for (let index = 0; index < rawRows.length; index++) {
      const item = rawRows[index];
      let previousIndex = -1;
      for (
        let searchIndex = 0;
        searchIndex < dedupedMembers.length;
        searchIndex++
      ) {
        if (dedupedMembers[searchIndex].userId === item.userId) {
          previousIndex = searchIndex;
          break;
        }
      }
      if (previousIndex === -1) {
        dedupedMembers.push(item);
        continue;
      }
      const previous = dedupedMembers[previousIndex];
      if (this.boardRoleRank(item.role) > this.boardRoleRank(previous.role)) {
        dedupedMembers[previousIndex] = item;
      }
    }

    dedupedMembers.sort(function sortMemberRows(first, second) {
      // Owner siempre arriba y luego orden por nombre
      if (first.userId === ownerId) {
        return -1;
      }
      if (second.userId === ownerId) {
        return 1;
      }
      return first.username.localeCompare(second.username, 'es', {
        sensitivity: 'base',
      });
    });

    return { ownerId, members: dedupedMembers };
  }

  /**
   * Expulsa miembro del tablero cuando actor tiene permiso
   */
  async removeMember(
    boardId: string,
    memberUserId: string,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.permissionsService.assertMinBoardRole(
      boardId,
      actorUserId,
      BoardRole.ADMIN,
      isAppAdmin,
    );

    const board = await this.boardModel.findById(boardId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    // No se permite expulsar al owner desde esta ruta
    if (board.owner.toString() === memberUserId) {
      throw new BadRequestException(
        'No puedes expulsar al propietario del tablero.',
      );
    }

    const memberCountBefore = board.members.length;
    const keptMembers: BoardMember[] = [];
    for (let index = 0; index < board.members.length; index++) {
      const member = board.members[index];
      if (member.user.toString() !== memberUserId) {
        keptMembers.push(member);
      }
    }
    board.members = keptMembers;
    if (board.members.length === memberCountBefore) {
      throw new NotFoundException('Ese usuario no es miembro del tablero.');
    }

    await board.save();
    const actorEmail = await this.resolveActorEmail(actorUserId);
    await this.boardActivityService.record({
      boardId,
      actorUserId,
      actorEmail,
      entityType: 'member',
      action: 'member.removed',
      message: 'Expulsó a un miembro del tablero.',
      entityId: memberUserId,
    });
  }

  /**
   * Permite que un miembro se salga del tablero por su cuenta
   */
  async leaveBoard(
    boardId: string,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.permissionsService.assertUserHasBoardAccess(
      boardId,
      actorUserId,
      isAppAdmin,
    );

    const board = await this.boardModel.findById(boardId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    // Owner no puede abandonar su propio tablero
    if (board.owner.toString() === actorUserId) {
      throw new BadRequestException(
        'El propietario no puede abandonar su propio tablero.',
      );
    }

    const memberCountBefore = board.members.length;
    const keptMembers: BoardMember[] = [];
    for (let index = 0; index < board.members.length; index++) {
      const member = board.members[index];
      if (member.user.toString() !== actorUserId) {
        keptMembers.push(member);
      }
    }
    board.members = keptMembers;

    if (board.members.length === memberCountBefore) {
      throw new BadRequestException(
        'No eres miembro directo del tablero; no se puede abandonar.',
      );
    }

    await board.save();
    const actorEmail = await this.resolveActorEmail(actorUserId);
    await this.boardActivityService.record({
      boardId,
      actorUserId,
      actorEmail,
      entityType: 'member',
      action: 'member.left',
      message: 'Abandonó el tablero.',
      entityId: actorUserId,
    });
  }
}
