import { Test, TestingModule } from '@nestjs/testing';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { BoardPolicyGuard } from './board-policy.guard';

describe('BoardsController', () => {
  it('deberia dejar crear el controlador en el caso base sin bloqueo de guardas', async () => {
    // Prepara mocks en este caso concreto de prueba
    const boardsServiceMock = {};
    const jwtGuardMock = { canActivate: () => true };
    const policiesGuardMock = { canActivate: () => true };
    const boardPolicyGuardMock = { canActivate: () => true };

    // Monta modulo del controlador para este escenario simple
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardsController],
      providers: [{ provide: BoardsService, useValue: boardsServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuardMock)
      .overrideGuard(PoliciesGuard)
      .useValue(policiesGuardMock)
      .overrideGuard(BoardPolicyGuard)
      .useValue(boardPolicyGuardMock)
      .compile();

    // Obtiene controlador y valida que existe en este caso
    const controller = module.get<BoardsController>(BoardsController);
    expect(controller).toBeDefined();
  });
});
