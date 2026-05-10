import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardPolicyGuard } from '../boards/board-policy.guard';

describe('TasksController', () => {
  it('deberia crear el controlador con guardas simuladas en este caso', async () => {
    // Se desactivan guardas para este escenario
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BoardPolicyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = module.get<TasksController>(TasksController);
    expect(controller).toBeDefined();
  });
});
