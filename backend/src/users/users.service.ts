import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserPlan } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type InviteSearchFilter = {
  $or: { username?: RegExp; email?: RegExp }[];
  _id?: { $ne: Types.ObjectId };
};

type PublicUserData = {
  _id: Types.ObjectId;
  username: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  experiencePoints?: number;
  role: string;
  userPlan?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Indica si un caracter se debe escapar en regex
 */
function charNeedsRegexEscape(character: string): boolean {
  const specialRegexCharacters = [
    '\\',
    '.',
    '^',
    '$',
    '*',
    '+',
    '?',
    '(',
    ')',
    '[',
    ']',
    '{',
    '}',
    '|',
  ];
  for (let index = 0; index < specialRegexCharacters.length; index++) {
    if (character === specialRegexCharacters[index]) {
      return true;
    }
  }
  return false;
}

/**
 * Escapa texto libre para usarlo en una busqueda con regex
 */
function escapeRegexSpecialChars(plainText: string): string {
  let escapedText = '';
  for (let index = 0; index < plainText.length; index++) {
    const currentCharacter = plainText[index];
    if (charNeedsRegexEscape(currentCharacter)) {
      escapedText += '\\' + currentCharacter;
    } else {
      escapedText += currentCharacter;
    }
  }
  return escapedText;
}

/**
 * Ajusta el limite de resultados para invitaciones
 */
function clampInviteSearchLimit(requestedLimit: number): number {
  let safeLimit = requestedLimit;
  if (safeLimit < 1) {
    safeLimit = 1;
  }
  if (safeLimit > 30) {
    safeLimit = 30;
  }
  return safeLimit;
}

@Injectable()
export class UsersService {
  /**
   * Inyecta modelo de usuario para operaciones de cuenta
   */
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /**
   * Registra un usuario nuevo validando email y username
   */
  async create(registerDto: RegisterDto): Promise<User> {
    const username = registerDto.username;
    const password = registerDto.password;
    const email = registerDto.email.toLowerCase().trim();

    // Verifica que no exista otro usuario con el mismo email
    const userWithSameEmail = await this.userModel.findOne({ email });
    if (userWithSameEmail) {
      throw new ConflictException('Email en uso.');
    }

    // Verifica username unico anets de crear la cuenta
    const userWithSameUsername = await this.userModel.findOne({ username });
    if (userWithSameUsername) {
      throw new ConflictException('Nombre en uso.');
    }

    const saltRounds = 10;
    // Genera hash para no guardar password en texto plano
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new this.userModel({
      email,
      username,
      passwordHash: hashedPassword,
    });

    return newUser.save();
  }

  /**
   * Busca usuario por email normalizado
   */
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return this.userModel.findOne({ email: normalizedEmail }).exec();
  }

  /**
   * Busca usuario por id
   */
  async findById(userId: string): Promise<User | null> {
    return this.userModel.findById(userId).exec();
  }

  /**
   * Busca usuario por stripe customer id cuando viene informado
   */
  async findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    // Evita consulta cuando stripe id llega vacio desde evento
    if (stripeCustomerId.trim() === '') {
      return null;
    }
    return this.userModel.findOne({ stripeCustomerId }).exec();
  }

  /**
   * Baja al plan free cuando termina la suscripcion de stripe
   */
  async downgradeToFreeOnStripeEnd(
    stripeCustomerId: string,
    stripeSubscriptionId: string | null,
  ): Promise<void> {
    // Reintenta por customer si no encontro coincidencia por suscripcion
    const updatePayload = {
      userPlan: 'free' as UserPlan,
      stripeSubscriptionId: null as string | null,
    };
    if (
      stripeSubscriptionId !== null &&
      stripeSubscriptionId !== undefined &&
      stripeSubscriptionId.trim() !== ''
    ) {
      const updatedUserBySub = await this.userModel
        .findOneAndUpdate(
          {
            stripeCustomerId,
            stripeSubscriptionId,
          },
          updatePayload,
        )
        .exec();
      if (updatedUserBySub !== null) {
        return;
      }
    }
    await this.userModel
      .findOneAndUpdate({ stripeCustomerId }, updatePayload)
      .exec();
  }

  /**
   * Lista usuarios sin exponer passwordHash
   */
  async findAll() {
    return this.userModel.find().select('-passwordHash').exec();
  }

  /**
   * Busca usuarios para invitaciones por username o email
   */
  async searchForInvite(
    searchText: string,
    excludeUserId: string,
    limit = 15,
  ): Promise<{ id: string; username: string; email: string }[]> {
    let searchTextForInvite = '';
    if (searchText !== undefined && searchText !== null) {
      searchTextForInvite = searchText.trim();
    }
    if (searchTextForInvite.length < 2) {
      return [];
    }

    // Escapa texto para evitar regex invalida o rara
    const textEscapedForRegex = escapeRegexSpecialChars(searchTextForInvite);
    const usernameOrEmailPattern = new RegExp(textEscapedForRegex, 'i');

    const inviteSearchFilter: InviteSearchFilter = {
      $or: [
        { username: usernameOrEmailPattern },
        { email: usernameOrEmailPattern },
      ],
    };
    if (Types.ObjectId.isValid(excludeUserId)) {
      inviteSearchFilter._id = { $ne: new Types.ObjectId(excludeUserId) };
    }

    const maxResults = clampInviteSearchLimit(limit);
    // Consulta usuarios que coinciden por username o email
    const matchingUsers = await this.userModel
      .find(inviteSearchFilter)
      .select('username email')
      .limit(maxResults)
      .lean()
      .exec();

    const inviteSearchResults: {
      id: string;
      username: string;
      email: string;
    }[] = [];
    for (let index = 0; index < matchingUsers.length; index++) {
      const leanUser = matchingUsers[index];
      inviteSearchResults.push({
        id: leanUser._id.toString(),
        username: leanUser.username,
        email: leanUser.email,
      });
    }
    return inviteSearchResults;
  }

  /**
   * Compara password plano contra hash guardado
   */
  async comparePassword(
    plainPassword: string,
    storedHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, storedHash);
  }

  /**
   * Actualiza perfil validando conflictos de email y username
   */
  async update(userId: string, updateDto: UpdateUserDto) {
    const existingUser = await this.userModel.findById(userId);

    if (!existingUser) {
      throw new BadRequestException('Usuario no existe.');
    }

    // Copia limpia de campos editables para normalizar valores
    const fieldsToUpdate: UpdateUserDto = { ...updateDto };
    if (fieldsToUpdate.email !== undefined && fieldsToUpdate.email !== null) {
      fieldsToUpdate.email = fieldsToUpdate.email.toLowerCase().trim();
    }

    if (fieldsToUpdate.email && fieldsToUpdate.email !== existingUser.email) {
      const otherUserWithEmail = await this.userModel.findOne({
        email: fieldsToUpdate.email,
      });
      if (otherUserWithEmail) {
        throw new ConflictException('Email en uso.');
      }
    }

    if (
      fieldsToUpdate.username &&
      fieldsToUpdate.username !== existingUser.username
    ) {
      // Evita username duplicado cuando el usuario cambia su alias
      const otherUserWithUsername = await this.userModel.findOne({
        username: fieldsToUpdate.username,
      });
      if (otherUserWithUsername) {
        throw new ConflictException('Nombre en uso.');
      }
    }

    return this.userModel
      .findByIdAndUpdate(userId, fieldsToUpdate, { returnDocument: 'after' })
      .exec();
  }

  /**
   * Actualiza plan y datos de stripe desde eventos internos
   */
  async updatePlanFromStripe(
    userId: string,
    userPlan: Exclude<UserPlan, 'free'>,
    stripeCustomerId: string | null,
    stripeSubscriptionId: string | null,
  ) {
    // Sincroniza plan y referencias de stripe para el usuario local
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          userPlan,
          stripeCustomerId,
          stripeSubscriptionId,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (updatedUser === null) {
      throw new NotFoundException('Usuario no existe.');
    }

    return updatedUser;
  }

  /**
   * Devuelve un usuario publico por id
   */
  async findOne(userId: string) {
    // Carga datos publicos y excluye hash para no exponerlo por error
    const userDocument = await this.userModel
      .findById(userId)
      .select('-passwordHash -__v')
      .lean()
      .exec();

    if (!userDocument) {
      throw new NotFoundException('Usuario no existe.');
    }

    const publicUser = userDocument as PublicUserData;

    let bio = '';
    if (publicUser.bio !== undefined && publicUser.bio !== null) {
      bio = publicUser.bio;
    }
    let avatarUrl = '';
    if (publicUser.avatarUrl !== undefined && publicUser.avatarUrl !== null) {
      avatarUrl = publicUser.avatarUrl;
    }
    let experiencePoints = 0;
    if (
      publicUser.experiencePoints !== undefined &&
      publicUser.experiencePoints !== null
    ) {
      experiencePoints = publicUser.experiencePoints;
    }

    let stripeCustomerId: string | null = null;
    if (
      publicUser.stripeCustomerId !== undefined &&
      publicUser.stripeCustomerId !== null &&
      publicUser.stripeCustomerId.trim() !== ''
    ) {
      stripeCustomerId = publicUser.stripeCustomerId;
    }
    let stripeSubscriptionId: string | null = null;
    if (
      publicUser.stripeSubscriptionId !== undefined &&
      publicUser.stripeSubscriptionId !== null &&
      publicUser.stripeSubscriptionId.trim() !== ''
    ) {
      stripeSubscriptionId = publicUser.stripeSubscriptionId;
    }
    let userPlanValue = 'free';
    if (publicUser.userPlan) {
      userPlanValue = publicUser.userPlan;
    }

    return {
      id: publicUser._id.toString(),
      username: publicUser.username,
      email: publicUser.email,
      bio,
      avatarUrl,
      experiencePoints,
      role: publicUser.role,
      userPlan: userPlanValue,
      stripeCustomerId,
      stripeSubscriptionId,
      createdAt: publicUser.createdAt,
      updatedAt: publicUser.updatedAt,
    };
  }

  /**
   * Elimina usuario por id
   */
  async remove(userId: string) {
    const deletedUser = await this.userModel.findByIdAndDelete(userId).exec();

    if (!deletedUser) {
      throw new NotFoundException('Usuario no existe.');
    }

    return deletedUser;
  }
}
