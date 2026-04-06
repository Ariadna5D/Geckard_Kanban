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
   * Guarda un usuario nuevo: comprueba que email y nombre no estén cogidos
   * y guarda la contraseña ya encriptada.
   */
  async create(registerDto: RegisterDto): Promise<User> {
    const { username, password } = registerDto;
    const email = registerDto.email.toLowerCase().trim();

    const existingEmail = await this.userModel.findOne({ email });
    if (existingEmail)
      throw new ConflictException('El email ya está registrado');

    const existingUser = await this.userModel.findOne({ username });
    if (existingUser)
      throw new ConflictException('El nombre de usuario ya está en uso');

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new this.userModel({
      email,
      username,
      passwordHash: hashedPassword,
    });

    return newUser.save();
  }

  /**
   * Busca por email ignorando mayúsculas para que el login sea menos estricto.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  /**
   * Carga un usuario por su id de Mongo.
   */
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  /**
   * Lista todos (la contraseña nunca sale en la respuesta).
   */
  async findAll() {
    return this.userModel.find().select('-passwordHash').exec();
  }

  /**
   * Buscador para invitar gente al tablero: por nombre o email, sin datos sensibles.
   * El texto debe tener al menos 2 letras. Se excluye al usuario que está buscando.
   */
  async searchForInvite(
    q: string,
    excludeUserId: string,
    limit = 15,
  ): Promise<{ id: string; username: string; email: string }[]> {
    const trimmed = q?.trim() ?? '';
    if (trimmed.length < 2) return [];

    // Escapamos caracteres raros para que la búsqueda no se rompa (p. ej. un punto suelto).
    const escapedForRegex = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedForRegex, 'i');

    const filter: Record<string, unknown> = {
      $or: [{ username: regex }, { email: regex }],
    };
    if (Types.ObjectId.isValid(excludeUserId)) {
      filter._id = { $ne: new Types.ObjectId(excludeUserId) };
    }

    const cappedLimit = Math.min(Math.max(limit, 1), 30);
    const docs = await this.userModel
      .find(filter)
      .select('username email')
      .limit(cappedLimit)
      .lean()
      .exec();

    const out: { id: string; username: string; email: string }[] = [];
    for (const d of docs) {
      out.push({
        id: d._id.toString(),
        username: d.username,
        email: d.email,
      });
    }
    return out;
  }

  /**
   * Comprueba la contraseña del formulario contra el hash guardado en base de datos.
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Cambia datos del perfil comprobando otra vez que email y username no estén duplicados.
   */
  async update(userId: string, updateDto: UpdateUserDto) {
    const user = await this.userModel.findById(userId);

    if (!user) throw new BadRequestException('Usuario no encontrado');

    if (updateDto.email && updateDto.email !== user.email) {
      const isTaken = await this.userModel.findOne({ email: updateDto.email });
      if (isTaken)
        throw new ConflictException('Este email ya lo usa otra persona');
    }

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

  /**
   * Devuelve un usuario para mostrar en pantalla (sin contraseña ni campos internos raros).
   */
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
   * Borra la cuenta por completo.
   */
  async remove(id: string) {
    const deletedUser = await this.userModel.findByIdAndDelete(id).exec();

    if (!deletedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return deletedUser;
  }
}
