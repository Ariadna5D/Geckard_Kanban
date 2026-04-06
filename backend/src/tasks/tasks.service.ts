import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Task,
  TaskDocument,
  TaskLabel,
  TaskLabelColor,
  STORY_POINT_SCALE,
  StoryPointValue,
} from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BoardsService } from '../boards/boards.service';
import { BoardRole } from '../boards/schemas/board.schema';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly boardsService: BoardsService,
  ) {}

  /**
   * Deja las etiquetas en un formato fijo: nombre corto, color permitido, sin repetir.
   */
  private normalizeLabels(input: unknown): TaskLabel[] | undefined {
    if (!Array.isArray(input)) return undefined;
    const allowedColors: TaskLabelColor[] = [
      'green',
      'yellow',
      'orange',
      'red',
      'purple',
      'blue',
      'sky',
      'gray',
    ];
    const seenNameKeys: string[] = [];
    const out: TaskLabel[] = [];
    for (const entry of input) {
      if (out.length >= 6) break;
      if (!entry || typeof entry !== 'object') continue;
      const nameRaw = (entry as { name?: unknown }).name;
      const colorRaw = (entry as { color?: unknown }).color;
      const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
      if (!name) continue;
      const keyLower = name.toLowerCase();
      if (seenNameKeys.includes(keyLower)) continue;
      seenNameKeys.push(keyLower);
      let color: TaskLabelColor = 'blue';
      if (typeof colorRaw === 'string') {
        for (const c of allowedColors) {
          if (c === colorRaw) {
            color = c;
            break;
          }
        }
      }
      out.push({ name: name.slice(0, 24), color });
    }
    return out;
  }

  /**
   * Con la media de los votos, elegimos el número Fibonacci más cercano (empate: el más bajo).
   */
  private nearestFibonacciFromMean(values: number[]): StoryPointValue | null {
    if (values.length === 0) return null;
    let sum = 0;
    for (const v of values) sum += v;
    const mean = sum / values.length;
    let best: StoryPointValue = STORY_POINT_SCALE[0];
    let bestDistance = Math.abs(mean - best);
    for (const f of STORY_POINT_SCALE) {
      const d = Math.abs(mean - f);
      if (d < bestDistance || (d === bestDistance && f < best)) {
        bestDistance = d;
        best = f;
      }
    }
    return best;
  }

  /**
   * Crea la tarea comprobando que el usuario puede editar ese tablero y esa columna.
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
    await this.boardsService.assertMinBoardRole(
      createTaskDto.boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    await this.boardsService.assertColumnBelongsToBoard(
      createTaskDto.boardId,
      createTaskDto.columnId,
      userId,
      isAppAdmin,
    );

    try {
      const labels = this.normalizeLabels(createTaskDto.labels) ?? [];
      const newTask = await this.taskModel.create({
        ...createTaskDto,
        labels,
        boardId: new Types.ObjectId(createTaskDto.boardId),
        columnId: new Types.ObjectId(createTaskDto.columnId),
      });

      return newTask;
    } catch {
      throw new InternalServerErrorException('Error al crear la tarea');
    }
  }

  /**
   * Todas las tareas de un tablero (si tienes acceso al tablero).
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
   * Actualiza texto, prioridad, etiquetas… El tablero y la columna no se tocan aquí
   * (eso va por la ruta de mover tarea).
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
    await this.boardsService.assertMinBoardRole(
      task.boardId.toString(),
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const updatePayload: Record<string, unknown> = {};
    const keys = Object.keys(updateTaskDto) as (keyof UpdateTaskDto)[];
    for (const key of keys) {
      if (key === 'boardId' || key === 'columnId') {
        continue;
      }
      if (key === 'labels') {
        continue;
      }
      updatePayload[key as string] = updateTaskDto[key];
    }
    const cleanedLabels = this.normalizeLabels(updateTaskDto.labels);
    if (cleanedLabels !== undefined) {
      updatePayload.labels = cleanedLabels;
    }

    const updatedTask = await this.taskModel
      .findByIdAndUpdate(id, updatePayload, { returnDocument: 'after' })
      .exec();

    if (!updatedTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return updatedTask;
  }

  /**
   * Mueve la tarea a otra columna y guarda su nueva posición de orden.
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
    await this.boardsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
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
   * Borra la tarea de la base de datos.
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
    await this.boardsService.assertMinBoardRole(
      task.boardId.toString(),
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const result = await this.taskModel
      .deleteOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('No se pudo eliminar la tarea');
    }
  }

  /**
   * Devuelve los votos de story points y un número “de acuerdo” para mostrar en pantalla.
   */
  async getStoryPointVoting(
    taskId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<{
    totalVotes: number;
    myVote: number | null;
    average: number | null;
    votes: { userId: string; value: number }[];
  }> {
    const task = await this.taskModel.findById(taskId).lean().exec();
    if (!task) throw new NotFoundException('Tarea no encontrada');
    await this.boardsService.assertUserHasBoardAccess(
      task.boardId.toString(),
      userId,
      isAppAdmin,
    );

    const votes: { userId: string; value: number }[] = [];
    for (const v of task.storyPointVotes ?? []) {
      votes.push({
        userId: v.userId.toString(),
        value: v.value,
      });
    }

    const uid = String(userId).trim();
    let myVote: number | null = null;
    for (const v of votes) {
      if (v.userId === uid) {
        myVote = v.value;
        break;
      }
    }

    const voteNumericValues: number[] = [];
    for (const v of votes) {
      voteNumericValues.push(v.value);
    }

    return {
      totalVotes: votes.length,
      myVote,
      average: this.nearestFibonacciFromMean(voteNumericValues),
      votes,
    };
  }

  /**
   * Guarda o cambia el voto del usuario logueado en esta tarea.
   */
  async voteStoryPoints(
    taskId: string,
    userId: string,
    value: number,
    isAppAdmin = false,
  ): Promise<void> {
    let allowedValue: StoryPointValue | undefined;
    for (const v of STORY_POINT_SCALE) {
      if (v === value) {
        allowedValue = v;
        break;
      }
    }
    if (allowedValue === undefined) {
      throw new BadRequestException('Valor de story points no permitido.');
    }
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) throw new NotFoundException('Tarea no encontrada');
    await this.boardsService.assertUserHasBoardAccess(
      task.boardId.toString(),
      userId,
      isAppAdmin,
    );

    if (!task.storyPointVotes) {
      task.storyPointVotes = [];
    }
    const uid = String(userId).trim();
    let existingVoteIndex = -1;
    for (let i = 0; i < task.storyPointVotes.length; i++) {
      if (String(task.storyPointVotes[i].userId) === uid) {
        existingVoteIndex = i;
        break;
      }
    }
    if (existingVoteIndex >= 0) {
      task.storyPointVotes[existingVoteIndex].value = allowedValue;
      task.storyPointVotes[existingVoteIndex].votedAt = new Date();
    } else {
      task.storyPointVotes.push({
        userId: new Types.ObjectId(uid),
        value: allowedValue,
        votedAt: new Date(),
      });
    }
    task.storyPointVotingStatus =
      task.storyPointVotes.length > 0 ? 'voting' : 'idle';
    task.markModified('storyPointVotes');
    await task.save();
  }
}
