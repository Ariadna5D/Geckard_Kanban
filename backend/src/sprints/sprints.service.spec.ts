import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SprintsService } from './sprints.service';
import { Sprint } from './schemas/sprint.schema';
import { Task } from '../tasks/schemas/task.schema';
import { BoardsService } from '../boards/boards.service';

describe('SprintsService', () => {
  let service: SprintsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SprintsService,
        { provide: getModelToken(Sprint.name), useValue: {} },
        { provide: getModelToken(Task.name), useValue: {} },
        { provide: BoardsService, useValue: {} },
      ],
    }).compile();

    service = module.get<SprintsService>(SprintsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
