// src/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './users/schemas/user.schema';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  console.log('INICIANDO SEEDER...');

  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const adminEmail = 'admin@admin.com';

  try {
    const existingAdmin = await userModel.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('ADMIN YA EXISTE');
    } else {
      console.log('CREANDO USUARIO ADMIN...');

      const hashedPassword = await bcrypt.hash('adminadmin', 10);

      await userModel.create({
        username: 'adminTest',
        email: adminEmail,
        passwordHash: hashedPassword,
        role: 'admin',
      });
    }
  } catch (error) {
    console.error('ERROR EN EL SEEDER', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}
void bootstrap();
