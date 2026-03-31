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
      // Si no nos pasan un orden, calculamos el máximo actual en esa columna
      let newOrder = createTaskDto.order;

      if (newOrder === undefined) {
        const lastTask = await this.taskModel
          .findOne({ columnId: new Types.ObjectId(createTaskDto.columnId) })
          .sort({ order: -1 }) // Orden descendente para pillar el mayor
          .exec();

        // Dejamos huecos de 1000 en 1000
        newOrder = lastTask ? lastTask.order + 1000 : 1000;
      }

      // Creamos la tarea con los IDs casteados correctamente
      const newTask = await this.taskModel.create({
        ...createTaskDto,
        boardId: new Types.ObjectId(createTaskDto.boardId),
        columnId: new Types.ObjectId(createTaskDto.columnId),
        order: newOrder,
      });

      return newTask;
    } catch (error) {
      throw new InternalServerErrorException('Error al crear la tarea');
    }
  }

  /**
   * READ: Obtener TODAS las tareas de un tablero específico.
   */
  async findAllByBoard(boardId: string): Promise<TaskDocument[]> {
    return this.taskModel
      .find({ boardId: new Types.ObjectId(boardId) })
      .sort({ columnId: 1, order: 1 }) // Agrupadas por columna y ordenadas
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
          // Si nos mandan IDs, aseguramos el casteo
          ...(updateTaskDto.columnId && {
            columnId: new Types.ObjectId(updateTaskDto.columnId),
          }),
          ...(updateTaskDto.boardId && {
            boardId: new Types.ObjectId(updateTaskDto.boardId),
          }),
        },
        { new: true },
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
    prevTaskOrder: number | null,
    nextTaskOrder: number | null,
  ): Promise<TaskDocument> {
    let calculatedOrder = 0;

    // La soltamos al PRINCIPIO de la columna (no hay tarea previa)
    if (prevTaskOrder === null && nextTaskOrder !== null) {
      calculatedOrder = nextTaskOrder / 2;
    }
    // La soltamos al FINAL de la columna (no hay tarea siguiente)
    else if (prevTaskOrder !== null && nextTaskOrder === null) {
      calculatedOrder = prevTaskOrder + 1000;
    }
    // La soltamos ENTRE dos tareas existentes
    else if (prevTaskOrder !== null && nextTaskOrder !== null) {
      calculatedOrder = (prevTaskOrder + nextTaskOrder) / 2;
    }
    // La columna está VACÍA
    else {
      calculatedOrder = 1000;
    }

    // Ejecutamos el único UPDATE necesario
    const updatedTask = await this.taskModel
      .findByIdAndUpdate(
        taskId,
        {
          columnId: new Types.ObjectId(newColumnId),
          order: calculatedOrder,
        },
        { new: true },
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
