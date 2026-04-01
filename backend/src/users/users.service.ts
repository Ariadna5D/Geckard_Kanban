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
   * @param registerDto
   * @returns El usuario creado.
   * @throws ConflictException si el email o el username ya están en uso.
   */
  async create(registerDto: RegisterDto): Promise<User> {
    // Extraemos los campos del DTO
    const { email, username, password } = registerDto;

    // Validamos que el email y el username sean únicos
    const existingEmail = await this.userModel.findOne({ email });
    if (existingEmail)
      throw new ConflictException('El email ya está registrado');

    // Validamos que el username sea único
    const existingUser = await this.userModel.findOne({ username });
    if (existingUser)
      throw new ConflictException('El nombre de usuario ya está en uso');

    // Hasheamos la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Creamos el nuevo usuario con el password hasheado
    const newUser = new this.userModel({
      email,
      username,
      passwordHash: hashedPassword,
    });

    return newUser.save();
  }

  /**
   * Busca un usuario por su email.
   * @param email
   * @returns El usuario encontrado o null si no existe.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  /**
   * Busca un usuario por su ID.
   * @param id
   * @returns El usuario encontrado o null si no existe.
   */
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  /**
   * Obtiene todos los usuarios de la plataforma
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
   * Compara una contraseña sin hash con su versión hasheada.
   * @param password
   * @param hash
   * @returns true si la contraseña coincide con el hash, false en caso contrario.
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Actualiza la información de un usuario. Solo se pueden actualizar email, username y bio.
   * @param userId ID del usuario a actualizar
   * @param updateDto DTO con los campos a actualizar (email, username, bio)
   * @returns El usuario actualizado, o null si no se encontró el usuario.
   * @throws BadRequestException si el usuario no existe.
   * @throws ConflictException si el nuevo email o username ya están en uso por otro usuario.
   */
  async update(userId: string, updateDto: UpdateUserDto) {
    const user = await this.userModel.findById(userId);

    if (!user) throw new BadRequestException('Usuario no encontrado');

    // Validar email único solo si lo está cambiando
    if (updateDto.email && updateDto.email !== user.email) {
      const isTaken = await this.userModel.findOne({ email: updateDto.email });
      if (isTaken)
        throw new ConflictException('Este email ya lo usa otra persona');
    }

    // Validar username único solo si lo está cambiando
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
   * Elimina un usuario por su ID de la base de datos.
   * @param id ID del usuario a eliminar
   * @returns El usuario eliminado (para poder leer su avatar y borrarlo luego)
   */
  async remove(id: string) {
    const deletedUser = await this.userModel.findByIdAndDelete(id).exec();

    if (!deletedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return deletedUser;
  }
}
