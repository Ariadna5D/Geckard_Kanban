import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BoardsService } from '../boards/boards.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly boardsService: BoardsService,
  ) {}

  /**
   * CREATE: Crea una tarea y la pone automáticamente al final de la columna.
   */
  async create(
    createTaskDto: CreateTaskDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<TaskDocument> {
    await this.boardsService.assertUserHasBoardAccess(
      createTaskDto.boardId,
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertColumnBelongsToBoard(
      createTaskDto.boardId,
      createTaskDto.columnId,
      userId,
      isAppAdmin,
    );

    try {
      const newTask = await this.taskModel.create({
        ...createTaskDto,
        boardId: new Types.ObjectId(createTaskDto.boardId),
        columnId: new Types.ObjectId(createTaskDto.columnId),
      });

      return newTask;
    } catch {
      throw new InternalServerErrorException('Error al crear la tarea');
    }
  }

  /**
   * READ: Obtener TODAS las tareas de un tablero específico (solo miembros del tablero).
   */
  async findAllByBoard(
    boardId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<TaskDocument[]> {
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    return this.taskModel
      .find({ boardId: new Types.ObjectId(boardId) })
      .sort({ columnId: 1, order: 1 })
      .exec();
  }

  /**
   * UPDATE BASIC: Actualizar texto, descripción, o campos Scrum.
   * No permite cambiar boardId/columnId por este endpoint (usar position / flujo DnD).
   */
  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }
    await this.boardsService.assertUserHasBoardAccess(
      task.boardId.toString(),
      userId,
      isAppAdmin,
    );

    const { boardId: _b, columnId: _c, ...safe } = updateTaskDto;
    void _b;
    void _c;

    const updatedTask = await this.taskModel
      .findByIdAndUpdate(
        id,
        {
          ...safe,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return updatedTask;
  }

  /**
   * Recalcula la posición matemática con un solo UPDATE.
   */
  async updatePosition(
    taskId: string,
    newColumnId: string,
    newOrder: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }
    const boardId = task.boardId.toString();
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertColumnBelongsToBoard(
      boardId,
      newColumnId,
      userId,
      isAppAdmin,
    );

    const updatedTask = await this.taskModel
      .findByIdAndUpdate(
        taskId,
        {
          columnId: new Types.ObjectId(newColumnId),
          order: newOrder,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedTask) throw new NotFoundException('Tarea no encontrada');

    return updatedTask;
  }

  /**
   * DELETE: Fulminar la tarea
   */
  async remove(id: string, userId: string, isAppAdmin = false): Promise<void> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException('No se pudo eliminar la tarea');
    }
    await this.boardsService.assertUserHasBoardAccess(
      task.boardId.toString(),
      userId,
      isAppAdmin,
    );

    const result = await this.taskModel
      .deleteOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('No se pudo eliminar la tarea');
    }
  }
}
