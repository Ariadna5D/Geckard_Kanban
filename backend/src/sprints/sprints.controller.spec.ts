import { Test, TestingModule } from '@nestjs/testing';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardPolicyGuard } from '../boards/board-policy.guard';

describe('SprintsController', () => {
  let controller: SprintsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SprintsController],
      providers: [{ provide: SprintsService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BoardPolicyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SprintsController>(SprintsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
