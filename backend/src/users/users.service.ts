import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  async create(registerDto: RegisterDto): Promise<User> {
    const { email, username, password } = registerDto;

    // 1. Check de Email
    const existingEmail = await this.userModel.findOne({ email });
    if (existingEmail)
      throw new ConflictException('El email ya está registrado');

    // 2. Check de Username
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

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async addExperience(userId: string, points: number): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $inc: { experiencePoints: points } },
        { new: true },
      )
      .exec();
  }

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
      .findByIdAndUpdate(userId, updateDto, { new: true })
      .exec();
  }
}
