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

/**
 * ESTO ES PARA ESCAPAR CARACTERES RAROS
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

// APLICA LO ANTERIOR A TODO EL TEXTO DE BÚSQUEDA PARA EVITAR INYECCIONES O ERRORES DE REGEX
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

// Limita el número de resultados
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

/// SERVICIOS ///////////////////////////////////////////////////////////////////
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  // REGISTRO
  async create(registerDto: RegisterDto): Promise<User> {
    const username = registerDto.username;
    const password = registerDto.password;
    const email = registerDto.email.toLowerCase().trim(); // Mutacion de mail

    const userWithSameEmail = await this.userModel.findOne({ email }); // Buscar si mail existe
    if (userWithSameEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    const userWithSameUsername = await this.userModel.findOne({ username }); // Buscar si username existe
    if (userWithSameUsername) {
      throw new ConflictException('El nombre de usuario ya está en uso');
    }

    const saltRounds = 10; // sal para bcrypt
    const hashedPassword = await bcrypt.hash(password, saltRounds); // Hasheado de contraseña

    const newUser = new this.userModel({
      email,
      username,
      passwordHash: hashedPassword,
    });

    return newUser.save();
  }

  // BUSCAR MAIL
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return this.userModel.findOne({ email: normalizedEmail }).exec();
  }

  // BUSCAR POR ID
  async findById(userId: string): Promise<User | null> {
    return this.userModel.findById(userId).exec();
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<User | null> {
    if (stripeCustomerId.trim() === '') {
      return null;
    }
    return this.userModel
      .findOne({ stripeCustomerId })
      .exec();
  }

  /** Tras cancelación o borrado de suscripción en Stripe: vuelve a plan free. */
  async downgradeToFreeAfterStripeSubscriptionEnd(
    stripeCustomerId: string,
    stripeSubscriptionId: string | null,
  ): Promise<void> {
    const updatePayload = {
      userPlan: 'free' as UserPlan,
      stripeSubscriptionId: null as string | null,
    };
    if (
      stripeSubscriptionId !== null &&
      stripeSubscriptionId !== undefined &&
      stripeSubscriptionId.trim() !== ''
    ) {
      const withSub = await this.userModel
        .findOneAndUpdate(
          {
            stripeCustomerId,
            stripeSubscriptionId,
          },
          updatePayload,
        )
        .exec();
      if (withSub !== null) {
        return;
      }
    }
    await this.userModel
      .findOneAndUpdate({ stripeCustomerId }, updatePayload)
      .exec();
  }

  // OBTENER TODOS LOS USUARIOS
  async findAll() {
    return this.userModel.find().select('-passwordHash').exec(); // quitamos password
  }

  // BUSQUEDA PARA INVITAR USUARIOS
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

    // Escapamos caracteres especiales para evitar inyecciones o errores en la regex
    const textEscapedForRegex = escapeRegexSpecialChars(searchTextForInvite);
    const usernameOrEmailPattern = new RegExp(textEscapedForRegex, 'i');

    const mongoFilter: Record<string, unknown> = {
      // Filtro para la búsqueda en MongoDB
      $or: [
        { username: usernameOrEmailPattern },
        { email: usernameOrEmailPattern },
      ],
    };
    if (Types.ObjectId.isValid(excludeUserId)) {
      mongoFilter._id = { $ne: new Types.ObjectId(excludeUserId) };
    }

    // Limitamos el número de resultados para evitar sobrecargar la respuesta
    const maxResults = clampInviteSearchLimit(limit);
    const matchingUsers = await this.userModel
      .find(mongoFilter) // Solo seleccionamos campos necesarios para la invitación
      .select('username email') // quitamos password y otros campos sensibles
      .limit(maxResults) // Limitamos el número de resultados para evitar sobrecargar la respuesta
      .lean() // lean() para obtener objetos JavaScript simples en lugar de documentos Mongoose
      .exec(); // Ejecutamos la consulta

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

  // COMPARAR CONTRASEÑA EN CLARO CON HASH
  async comparePassword(
    plainPassword: string,
    storedHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, storedHash);
  }

  // ACTUALIZAR USUARIO
  async update(userId: string, updateDto: UpdateUserDto) {
    const existingUser = await this.userModel.findById(userId);

    if (!existingUser) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const fieldsToUpdate: UpdateUserDto = { ...updateDto };
    if (fieldsToUpdate.email !== undefined && fieldsToUpdate.email !== null) {
      fieldsToUpdate.email = fieldsToUpdate.email.toLowerCase().trim();
    }

    if (fieldsToUpdate.email && fieldsToUpdate.email !== existingUser.email) {
      const otherUserWithEmail = await this.userModel.findOne({
        email: fieldsToUpdate.email,
      });
      if (otherUserWithEmail) {
        throw new ConflictException('Este email ya lo usa otra persona');
      }
    }

    if (
      fieldsToUpdate.username &&
      fieldsToUpdate.username !== existingUser.username
    ) {
      const otherUserWithUsername = await this.userModel.findOne({
        username: fieldsToUpdate.username,
      });
      if (otherUserWithUsername) {
        throw new ConflictException('Este nombre de usuario ya está en uso');
      }
    }

    return this.userModel
      .findByIdAndUpdate(userId, fieldsToUpdate, { returnDocument: 'after' })
      .exec();
  }

  // ACTUALIZA EL PLAN DESDE EVENTOS DE STRIPE (USO INTERNO)
  async updatePlanFromStripe(
    userId: string,
    userPlan: Exclude<UserPlan, 'free'>,
    stripeCustomerId: string | null,
    stripeSubscriptionId: string | null,
  ) {
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
      throw new NotFoundException('Usuario no encontrado');
    }

    return updatedUser;
  }

  // OBTENER USUARIO POR ID
  async findOne(userId: string) {
    const userDocument = await this.userModel
      .findById(userId)
      .select('-passwordHash -__v')
      .lean()
      .exec();

    if (!userDocument) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const storedUser = userDocument as {
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

    let bio = '';
    if (storedUser.bio !== undefined && storedUser.bio !== null) {
      bio = storedUser.bio;
    }
    let avatarUrl = '';
    if (storedUser.avatarUrl !== undefined && storedUser.avatarUrl !== null) {
      avatarUrl = storedUser.avatarUrl;
    }
    let experiencePoints = 0;
    if (
      storedUser.experiencePoints !== undefined &&
      storedUser.experiencePoints !== null
    ) {
      experiencePoints = storedUser.experiencePoints;
    }

    let stripeCustomerId: string | null = null;
    if (
      storedUser.stripeCustomerId !== undefined &&
      storedUser.stripeCustomerId !== null &&
      storedUser.stripeCustomerId.trim() !== ''
    ) {
      stripeCustomerId = storedUser.stripeCustomerId;
    }
    let stripeSubscriptionId: string | null = null;
    if (
      storedUser.stripeSubscriptionId !== undefined &&
      storedUser.stripeSubscriptionId !== null &&
      storedUser.stripeSubscriptionId.trim() !== ''
    ) {
      stripeSubscriptionId = storedUser.stripeSubscriptionId;
    }

    return {
      id: storedUser._id.toString(),
      username: storedUser.username,
      email: storedUser.email,
      bio,
      avatarUrl,
      experiencePoints,
      role: storedUser.role,
      userPlan: storedUser.userPlan ?? 'free',
      stripeCustomerId,
      stripeSubscriptionId,
      createdAt: storedUser.createdAt,
      updatedAt: storedUser.updatedAt,
    };
  }

  // ELIMINAR USUARIO POR ID
  async remove(userId: string) {
    const deletedUser = await this.userModel.findByIdAndDelete(userId).exec();

    if (!deletedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return deletedUser;
  }
}
