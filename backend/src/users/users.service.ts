import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

async create(email: string, password: string, role?: string): Promise<User> {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    try {
      const newUser = new this.userModel({
        email,
        passwordHash: hashedPassword,
        role: role || 'user',
        experiencePoints: 0, 
      });
      return await newUser.save();
    } catch (error) {
      
      if (error.code === 11000) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
      throw new InternalServerErrorException('Error al crear el usuario');
    }
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
    return this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { experiencePoints: points } }, 
      { new: true } 
    ).exec();
  }
}