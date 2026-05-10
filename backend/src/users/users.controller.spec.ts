import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';

describe('UsersController', () => {
  it('deberia crear el controlador con guardas simuladas en este caso', async () => {
    // Dobles simples para este escenario
    const fakeUsersService = {};
    const fakeCloudinary = {
      extractPublicId: jest.fn(),
      deleteFile: jest.fn(),
      uploadFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: fakeUsersService },
        { provide: CloudinaryService, useValue: fakeCloudinary },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PoliciesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = module.get<UsersController>(UsersController);
    expect(controller).toBeDefined();
  });
});
