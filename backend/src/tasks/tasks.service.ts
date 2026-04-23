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
  TaskLink,
  TaskChecklistItem,
  STORY_POINT_SCALE,
  StoryPointValue,
} from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BoardsService } from '../boards/boards.service';
import { BoardActivityService } from '../boards/board-activity.service';
import { BoardRole } from '../boards/schemas/board.schema';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly boardsService: BoardsService,
    private readonly boardActivityService: BoardActivityService,
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
   * URLs http(s) únicas, título opcional acotado.
   */
  private normalizeLinks(input: unknown): TaskLink[] | undefined {
    if (!Array.isArray(input)) return undefined;
    const seen = new Set<string>();
    const out: TaskLink[] = [];
    for (const entry of input) {
      if (out.length >= 20) break;
      if (!entry || typeof entry !== 'object') continue;
      const urlRaw = (entry as { url?: unknown }).url;
      const titleRaw = (entry as { title?: unknown }).title;
      if (typeof urlRaw !== 'string') continue;
      let candidateUrl = urlRaw.trim();
      if (!candidateUrl) continue;
      if (!/^https?:\/\//i.test(candidateUrl)) {
        candidateUrl = `https://${candidateUrl}`;
      }
      let hrefKey: string;
      let storedUrl: string;
      try {
        const parsed = new URL(candidateUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
          continue;
        hrefKey = parsed.href;
        storedUrl = parsed.href.slice(0, 2048);
      } catch {
        continue;
      }
      if (seen.has(hrefKey)) continue;
      seen.add(hrefKey);
      const link: TaskLink = { url: storedUrl };
      if (typeof titleRaw === 'string') {
        const linkTitleText = titleRaw.trim().slice(0, 200);
        if (linkTitleText) link.title = linkTitleText;
      }
      out.push(link);
    }
    return out;
  }

  /**
   * Texto no vacío por ítem; checked solo si es boolean true.
   */
  private normalizeChecklist(input: unknown): TaskChecklistItem[] | undefined {
    if (!Array.isArray(input)) return undefined;
    const out: TaskChecklistItem[] = [];
    for (const entry of input) {
      if (out.length >= 50) break;
      if (!entry || typeof entry !== 'object') continue;
      const textRaw = (entry as { text?: unknown }).text;
      const checkedRaw = (entry as { checked?: unknown }).checked;
      const text =
        typeof textRaw === 'string' ? textRaw.trim().slice(0, 500) : '';
      if (!text) continue;
      out.push({
        text,
        checked: checkedRaw === true,
      });
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
      const distance = Math.abs(mean - f);
      if (distance < bestDistance || (distance === bestDistance && f < best)) {
        bestDistance = distance;
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
    actorEmail: string,
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
      const {
        labels: rawLabels,
        links: rawLinks,
        checklist: rawChecklist,
        boardId,
        columnId,
        sprintId: sprintIdFromClient,
        ...rest
      } = createTaskDto;
      const labels = this.normalizeLabels(rawLabels) ?? [];
      const links = this.normalizeLinks(rawLinks) ?? [];
      const checklist = this.normalizeChecklist(rawChecklist) ?? [];

      if (sprintIdFromClient !== undefined && sprintIdFromClient !== null) {
        await this.boardsService.assertTaskSprintAssignmentAllowed(
          boardId,
          sprintIdFromClient,
          userId,
          isAppAdmin,
        );
      }

      const newTaskPayload: Record<string, unknown> = {
        ...rest,
        labels,
        links,
        checklist,
        boardId: new Types.ObjectId(boardId),
        columnId: new Types.ObjectId(columnId),
      };
      if (sprintIdFromClient !== undefined && sprintIdFromClient !== null) {
        newTaskPayload['sprintId'] = new Types.ObjectId(sprintIdFromClient);
      }

      const newTask = await this.taskModel.create(newTaskPayload);

      await this.boardActivityService.record({
        boardId,
        actorUserId: userId,
        actorEmail,
        entityType: 'task',
        action: 'task.created',
        message: `Creó la tarea «${newTask.title}».`,
        entityId: newTask._id.toString(),
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
      .find({
        boardId: new Types.ObjectId(boardId),
        $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
      })
      .sort({ columnId: 1, order: 1 })
      .exec();
  }

  /**
   * Lista tareas archivadas de un tablero (fuera de columnas del Kanban principal).
   */
  async findArchivedByBoard(
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
      .find({
        boardId: new Types.ObjectId(boardId),
        archivedAt: { $exists: true, $ne: null },
      })
      .sort({ archivedAt: -1, updatedAt: -1 })
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
    actorEmail: string,
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

    const requestedSprintId = updateTaskDto.sprintId;

    const updatePayload: Record<string, unknown> = {};
    const keys = Object.keys(updateTaskDto) as (keyof UpdateTaskDto)[];
    for (const key of keys) {
      if (key === 'boardId' || key === 'columnId' || key === 'sprintId') {
        continue;
      }
      if (key === 'labels' || key === 'links' || key === 'checklist') {
        continue;
      }
      updatePayload[key as string] = updateTaskDto[key];
    }

    let shouldUnsetSprintId = false;
    if (requestedSprintId !== undefined) {
      await this.boardsService.assertTaskSprintAssignmentAllowed(
        task.boardId.toString(),
        requestedSprintId,
        userId,
        isAppAdmin,
      );
      if (requestedSprintId === null) {
        shouldUnsetSprintId = true;
      } else {
        updatePayload['sprintId'] = new Types.ObjectId(requestedSprintId);
      }
    }

    const cleanedLabels = this.normalizeLabels(updateTaskDto.labels);
    if (cleanedLabels !== undefined) {
      updatePayload.labels = cleanedLabels;
    }
    const cleanedLinks = this.normalizeLinks(updateTaskDto.links);
    if (cleanedLinks !== undefined) {
      updatePayload.links = cleanedLinks;
    }
    const cleanedChecklist = this.normalizeChecklist(updateTaskDto.checklist);
    if (cleanedChecklist !== undefined) {
      updatePayload.checklist = cleanedChecklist;
    }

    const mongoUpdate: Record<string, unknown> = {};
    if (Object.keys(updatePayload).length > 0) {
      mongoUpdate['$set'] = updatePayload;
    }
    if (shouldUnsetSprintId) {
      mongoUpdate['$unset'] = { sprintId: '' };
    }

    if (Object.keys(mongoUpdate).length === 0) {
      return task;
    }

    const updatedTask = await this.taskModel
      .findByIdAndUpdate(id, mongoUpdate, { returnDocument: 'after' })
      .exec();

    if (!updatedTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    await this.boardActivityService.record({
      boardId: task.boardId.toString(),
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.updated',
      message: `Actualizó la tarea «${updatedTask.title}».`,
      entityId: updatedTask._id.toString(),
    });

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
    actorEmail: string,
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
    const previousColumnId = task.columnId.toString();

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

    const fromColumnTitle =
      (await this.boardsService.getColumnTitle(boardId, previousColumnId)) ??
      '(columna desconocida)';
    const toColumnTitle =
      (await this.boardsService.getColumnTitle(boardId, newColumnId)) ??
      '(columna desconocida)';
    const moveMessage =
      previousColumnId === newColumnId
        ? `Reordenó la tarea «${updatedTask.title}» dentro de «${toColumnTitle}».`
        : `Movió la tarea «${updatedTask.title}» de «${fromColumnTitle}» a «${toColumnTitle}».`;

    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.moved',
      message: moveMessage,
      entityId: updatedTask._id.toString(),
    });

    return updatedTask;
  }

  /**
   * Archiva la tarea (desaparece del Kanban, pero sigue recuperable).
   */
  async remove(
    id: string,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<void> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException('No se encontró la tarea');
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

    if (task.archivedAt) {
      return;
    }

    const archived = await this.taskModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            archivedAt: new Date(),
            archivedBy: new Types.ObjectId(userId),
          },
          // Evita que tareas ocultas sigan afectando cierres de sprint.
          $unset: { sprintId: '' },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!archived) {
      throw new NotFoundException('No se pudo archivar la tarea');
    }
    await this.boardActivityService.record({
      boardId: task.boardId.toString(),
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.archived',
      message: `Archivó la tarea «${task.title}».`,
      entityId: id,
    });
  }

  /**
   * Restaura una tarea archivada para que vuelva al tablero activo.
   */
  async restore(
    id: string,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException('No se encontró la tarea');
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

    if (!task.archivedAt) {
      return task;
    }

    const restored = await this.taskModel
      .findByIdAndUpdate(
        id,
        {
          $unset: {
            archivedAt: '',
            archivedBy: '',
            archivedWithColumnId: '',
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!restored) {
      throw new NotFoundException('No se pudo restaurar la tarea');
    }
    await this.boardActivityService.record({
      boardId: task.boardId.toString(),
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.restored',
      message: `Restauró la tarea «${restored.title}».`,
      entityId: id,
    });
    return restored;
  }

  /**
   * Borra de forma permanente una tarea ya archivada (solo admin/owner de tablero).
   */
  async purge(
    id: string,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<void> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException('No se encontró la tarea');
    }
    await this.boardsService.assertUserHasBoardAccess(
      task.boardId.toString(),
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      task.boardId.toString(),
      userId,
      BoardRole.ADMIN,
      isAppAdmin,
    );
    if (!task.archivedAt) {
      throw new BadRequestException(
        'Solo puedes borrar definitivamente tareas que ya estén archivadas.',
      );
    }

    const result = await this.taskModel
      .deleteOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('No se pudo borrar definitivamente la tarea');
    }
    await this.boardActivityService.record({
      boardId: task.boardId.toString(),
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.deleted.permanent',
      message: `Borró definitivamente la tarea «${task.title}».`,
      entityId: id,
    });
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
    actorEmail: string,
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
    for (
      let voteIndex = 0;
      voteIndex < task.storyPointVotes.length;
      voteIndex++
    ) {
      if (String(task.storyPointVotes[voteIndex].userId) === uid) {
        existingVoteIndex = voteIndex;
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
    await this.boardActivityService.record({
      boardId: task.boardId.toString(),
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.storypoints.voted',
      message: `Votó story points (${allowedValue}) en «${task.title}».`,
      entityId: taskId,
    });
  }
}
