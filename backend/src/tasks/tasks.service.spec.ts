import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TasksService } from './tasks.service';
import { Task } from './schemas/task.schema';
import { BoardsService } from '../boards/boards.service';
import { BoardActivityService } from '../boards/board-activity.service';

describe('TasksService', () => {
  it('deberia crear el servicio con dependencias simuladas en este caso', async () => {
    // Mocks simples para este escenario
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getModelToken(Task.name), useValue: {} },
        { provide: BoardsService, useValue: {} },
        { provide: BoardActivityService, useValue: {} },
      ],
    }).compile();

    const service = module.get<TasksService>(TasksService);
    expect(service).toBeDefined();
  });
});
