import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskDocument } from './schemas/task.schema';

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private taskModel: Model<TaskDocument>) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const createdTask = new this.taskModel(createTaskDto);
    return createdTask.save();
  }

  async findAll(): Promise<Task[]> {
    return this.taskModel.find().exec();
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException(`Tarea con ID ${id} no encontrada`);
    }
    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const existingTask = await this.taskModel
      .findByIdAndUpdate(id, updateTaskDto, { new: true }) // {new: true} sirve para que devuelva la tarea ya cambiada
      .exec();

    if (!existingTask) {
      throw new NotFoundException(
        `Tarea con ID ${id} no encontrada para actualizar`,
      );
    }
    return existingTask;
  }

  async remove(id: string): Promise<Task> {
    const deletedTask = await this.taskModel.findByIdAndDelete(id).exec();
    if (!deletedTask) {
      throw new NotFoundException(
        `Tarea con ID ${id} no encontrada para borrar`,
      );
    }
    return deletedTask;
  }
}
