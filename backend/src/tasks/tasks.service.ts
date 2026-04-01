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

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
  ) {}

  /**
   * CREATE: Crea una tarea y la pone automáticamente al final de la columna.
   */
  async create(createTaskDto: CreateTaskDto): Promise<TaskDocument> {
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
   * READ: Obtener TODAS las tareas de un tablero específico.
   */
  async findAllByBoard(boardId: string): Promise<TaskDocument[]> {
    return this.taskModel
      .find({ boardId: new Types.ObjectId(boardId) })
      .sort({ columnId: 1, order: 1 })
      .exec();
  }

  /**
   * UPDATE BASIC: Actualizar texto, descripción, o campos Scrum
   */
  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
  ): Promise<TaskDocument> {
    const updatedTask = await this.taskModel
      .findByIdAndUpdate(
        id,
        {
          ...updateTaskDto,
          ...(updateTaskDto.columnId && {
            columnId: new Types.ObjectId(updateTaskDto.columnId),
          }),
          ...(updateTaskDto.boardId && {
            boardId: new Types.ObjectId(updateTaskDto.boardId),
          }),
        },
        { returnDocument: 'after' }, // <-- CORREGIDO
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
  ): Promise<TaskDocument> {
    const updatedTask = await this.taskModel
      .findByIdAndUpdate(
        taskId,
        {
          columnId: new Types.ObjectId(newColumnId),
          order: newOrder,
        },
        { returnDocument: 'after' }, // <-- CORREGIDO
      )
      .exec();

    if (!updatedTask) throw new NotFoundException('Tarea no encontrada');

    return updatedTask;
  }

  /**
   * DELETE: Fulminar la tarea
   */
  async remove(id: string): Promise<void> {
    const result = await this.taskModel
      .deleteOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('No se pudo eliminar la tarea');
    }
  }
}
