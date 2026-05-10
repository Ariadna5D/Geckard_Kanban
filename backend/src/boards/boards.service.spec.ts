import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BoardsService } from './boards.service';
import { Board } from './schemas/board.schema';
import { Task } from '../tasks/schemas/task.schema';
import { BoardsPermissionsService } from './boards-permissions.service';
import { BoardsMembersService } from './boards-members.service';
import { BoardsColumnsService } from './boards-columns.service';
import { BoardsSprintsService } from './boards-sprints.service';
import { BoardsCoreService } from './boards-core.service';
import { BoardsQueryService } from './boards-query.service';

describe('BoardsService', () => {
  it('deberia iniciar el servicio cuando todas las dependencias estan simuladas en este caso', async () => {
    // Prepara mocks basicos para este escenario
    const boardModelMock = {};
    const taskModelMock = {};
    const permissionsServiceMock = {};
    const membersServiceMock = {};
    const columnsServiceMock = {};
    const sprintsServiceMock = {};
    const coreServiceMock = {};
    const queryServiceMock = {};

    // Crea el modulo de pruebas con dependencias simuladas
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        { provide: getModelToken(Board.name), useValue: boardModelMock },
        { provide: getModelToken(Task.name), useValue: taskModelMock },
        { provide: BoardsPermissionsService, useValue: permissionsServiceMock },
        { provide: BoardsMembersService, useValue: membersServiceMock },
        { provide: BoardsColumnsService, useValue: columnsServiceMock },
        { provide: BoardsSprintsService, useValue: sprintsServiceMock },
        { provide: BoardsCoreService, useValue: coreServiceMock },
        { provide: BoardsQueryService, useValue: queryServiceMock },
      ],
    }).compile();

    // Obtiene el servicio final para ejecutar esta prueba
    const service = module.get<BoardsService>(BoardsService);
    expect(service).toBeDefined();
  });
});
