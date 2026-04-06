import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /**
   * Crea un nuevo usuario a partir del RegisterDto.
   * @param registerDto datos de registro
   * @returns usuario creado
   * @throws ConflictException email o username duplicados
   */
  async create(registerDto: RegisterDto): Promise<User> {
    const { username, password } = registerDto;
    // Consistencia: email siempre en minúsculas y sin espacios extremos.
    const email = registerDto.email.toLowerCase().trim();

    // Validación de email único.
    const existingEmail = await this.userModel.findOne({ email });
    if (existingEmail)
      throw new ConflictException('El email ya está registrado');

    // Validación de username único.
    const existingUser = await this.userModel.findOne({ username });
    if (existingUser)
      throw new ConflictException('El nombre de usuario ya está en uso');

    // Nunca guardamos contraseña en texto plano.
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new this.userModel({
      email,
      username,
      passwordHash: hashedPassword,
    });

    return newUser.save();
  }

  /**
   * Busca un usuario por su email.
   * @param email correo recibido por login/otras rutas
   * @returns usuario o null
   */
  async findByEmail(email: string): Promise<User | null> {
    // Aseguramos que las búsquedas coincidan aunque el usuario escriba mayúsculas.
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  /**
   * Busca un usuario por su ID.
   * @param id ObjectId de usuario
   * @returns usuario o null
   */
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  /**
   * Obtiene todos los usuarios (sin passwordHash).
   */
  async findAll() {
    return this.userModel.find().select('-passwordHash').exec();
  }

  /**
   * Búsqueda acotada para invitar a tableros (username o email, sin datos sensibles).
   */
  async searchForInvite(
    q: string,
    excludeUserId: string,
    limit = 15,
  ): Promise<{ id: string; username: string; email: string }[]> {
    const trimmed = q?.trim() ?? '';
    if (trimmed.length < 2) return [];

    const esc = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(esc, 'i');

    const filter: Record<string, unknown> = {
      $or: [{ username: regex }, { email: regex }],
    };
    if (Types.ObjectId.isValid(excludeUserId)) {
      filter._id = { $ne: new Types.ObjectId(excludeUserId) };
    }

    const docs = await this.userModel
      .find(filter)
      .select('username email')
      .limit(Math.min(Math.max(limit, 1), 30))
      .lean()
      .exec();

    return docs.map((d) => ({
      id: d._id.toString(),
      username: d.username,
      email: d.email,
    }));
  }

  /**
   * Compara password en claro contra hash guardado.
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Actualiza perfil de usuario validando unicidad en email/username.
   */
  async update(userId: string, updateDto: UpdateUserDto) {
    const user = await this.userModel.findById(userId);

    if (!user) throw new BadRequestException('Usuario no encontrado');

    // Si cambia email, validamos duplicados.
    if (updateDto.email && updateDto.email !== user.email) {
      const isTaken = await this.userModel.findOne({ email: updateDto.email });
      if (isTaken)
        throw new ConflictException('Este email ya lo usa otra persona');
    }

    // Si cambia username, validamos duplicados.
    if (updateDto.username && updateDto.username !== user.username) {
      const isTaken = await this.userModel.findOne({
        username: updateDto.username,
      });
      if (isTaken)
        throw new ConflictException('Este nombre de usuario ya está en uso');
    }

    return this.userModel
      .findByIdAndUpdate(userId, updateDto, { returnDocument: 'after' })
      .exec();
  }

  /** Obtiene perfil público básico por id (sin hash ni __v). */
  async findOne(id: string) {
    const doc = await this.userModel
      .findById(id)
      .select('-passwordHash -__v')
      .lean()
      .exec();

    if (!doc) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const { _id, ...rest } = doc;
    return {
      id: _id.toString(),
      ...rest,
    };
  }

  /**
   * Elimina usuario por id.
   * @returns documento eliminado (útil para limpiar avatar en capa controller)
   */
  async remove(id: string) {
    const deletedUser = await this.userModel.findByIdAndDelete(id).exec();

    if (!deletedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return deletedUser;
  }
}
