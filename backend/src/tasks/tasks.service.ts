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

type TaskCreatePayload = {
  title: string;
  description?: string;
  boardId: Types.ObjectId;
  columnId: Types.ObjectId;
  order: string;
  labels: TaskLabel[];
  links: TaskLink[];
  checklist: TaskChecklistItem[];
  assigneeIds?: string[];
  priority?: string;
  dueDate?: string;
  storyPoints?: number;
  sprintId?: Types.ObjectId;
};

type TaskUpdateFields = {
  [key: string]: unknown;
};

@Injectable()
export class TasksService {
  /**
   * Inyecta modelo de tareas y servicios de tablero para permisos
   */
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly boardsService: BoardsService,
    private readonly boardActivityService: BoardActivityService,
  ) {}

  /**
   * Limpia etiquetas y deja solo valores permitidos
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
    const normalizedLabels: TaskLabel[] = [];
    for (const entry of input) {
      if (normalizedLabels.length >= 6) break;
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
        for (const allowedColor of allowedColors) {
          if (allowedColor === colorRaw) {
            color = allowedColor;
            break;
          }
        }
      }
      normalizedLabels.push({ name: name.slice(0, 24), color });
    }
    return normalizedLabels;
  }

  /**
   * Limpia enlaces repetidos y valida urls http o https
   */
  private normalizeLinks(input: unknown): TaskLink[] | undefined {
    if (!Array.isArray(input)) return undefined;
    const seenUrls = new Set<string>();
    const normalizedLinks: TaskLink[] = [];
    for (const entry of input) {
      if (normalizedLinks.length >= 20) break;
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
      if (seenUrls.has(hrefKey)) continue;
      seenUrls.add(hrefKey);
      const link: TaskLink = { url: storedUrl };
      if (typeof titleRaw === 'string') {
        const linkTitleText = titleRaw.trim().slice(0, 200);
        if (linkTitleText) link.title = linkTitleText;
      }
      normalizedLinks.push(link);
    }
    return normalizedLinks;
  }

  /**
   * Limpia checklist y limita cantidad de items
   */
  private normalizeChecklist(input: unknown): TaskChecklistItem[] | undefined {
    if (!Array.isArray(input)) return undefined;
    const normalizedChecklist: TaskChecklistItem[] = [];
    for (const entry of input) {
      if (normalizedChecklist.length >= 50) break;
      if (!entry || typeof entry !== 'object') continue;
      const textRaw = (entry as { text?: unknown }).text;
      const checkedRaw = (entry as { checked?: unknown }).checked;
      const text =
        typeof textRaw === 'string' ? textRaw.trim().slice(0, 500) : '';
      if (!text) continue;
      normalizedChecklist.push({
        text,
        checked: checkedRaw === true,
      });
    }
    return normalizedChecklist;
  }

  /**
   * Calcula el story point sugerido usando promedio simple
   */
  private nearestFibonacciFromMean(values: number[]): StoryPointValue | null {
    if (values.length === 0) return null;
    let sum = 0;
    for (const voteValue of values) sum += voteValue;
    const mean = sum / values.length;
    let best: StoryPointValue = STORY_POINT_SCALE[0];
    let bestDistance = Math.abs(mean - best);
    for (const fibonacciValue of STORY_POINT_SCALE) {
      const distance = Math.abs(mean - fibonacciValue);
      if (
        distance < bestDistance ||
        (distance === bestDistance && fibonacciValue < best)
      ) {
        bestDistance = distance;
        best = fibonacciValue;
      }
    }
    return best;
  }

  /**
   * Crea una tarea nueva validando permisos y datos
   */
  async create(
    createTaskDto: CreateTaskDto,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<TaskDocument> {
    // Valida acceso al tablero antes de crear cualquier tarea
    await this.boardsService.assertUserHasBoardAccess(
      createTaskDto.boardId,
      userId,
      isAppAdmin,
    );
    // Exige rol editor o superior para crear tarjetas
    await this.boardsService.assertMinBoardRole(
      createTaskDto.boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    await this.boardsService.assertBoardHasColumn(
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
        // Si llega sprint, valida que sea el activo del tablero
        await this.boardsService.assertTaskCanJoinSprint(
          boardId,
          sprintIdFromClient,
          userId,
          isAppAdmin,
        );
      }

      const newTaskPayload: TaskCreatePayload = {
        ...rest,
        labels,
        links,
        checklist,
        boardId: new Types.ObjectId(boardId),
        columnId: new Types.ObjectId(columnId),
      };
      if (sprintIdFromClient !== undefined && sprintIdFromClient !== null) {
        newTaskPayload.sprintId = new Types.ObjectId(sprintIdFromClient);
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
   * Lista tareas activas de un tablero
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
    // Devuelve solo tareas activas para la vista principal del tablero
    return this.taskModel
      .find({
        boardId: new Types.ObjectId(boardId),
        $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
      })
      .sort({ columnId: 1, order: 1 })
      .exec();
  }

  /**
   * Lista tareas archivadas del tablero
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
    // Devuelve tareas archivadas para el panel de restauracion
    return this.taskModel
      .find({
        boardId: new Types.ObjectId(boardId),
        archivedAt: { $exists: true, $ne: null },
      })
      .sort({ archivedAt: -1, updatedAt: -1 })
      .exec();
  }

  /**
   * Actualiza una tarea sin tocar ids sensibles
   */
  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<TaskDocument> {
    const existingTask = await this.taskModel.findById(id).exec();
    if (!existingTask) {
      throw new NotFoundException('Tarea no existe.');
    }
    await this.boardsService.assertUserHasBoardAccess(
      existingTask.boardId.toString(),
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      existingTask.boardId.toString(),
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const requestedSprintId = updateTaskDto.sprintId;

    const updatePayload: TaskUpdateFields = {};
    const keys = Object.keys(updateTaskDto) as (keyof UpdateTaskDto)[];
    for (const key of keys) {
      // Ignora ids sensibles que no se deben editar por este endpoint
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
      await this.boardsService.assertTaskCanJoinSprint(
        existingTask.boardId.toString(),
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

    const mongoUpdate: { $set?: TaskUpdateFields; $unset?: { sprintId: '' } } =
      {};
    if (Object.keys(updatePayload).length > 0) {
      mongoUpdate['$set'] = updatePayload;
    }
    if (shouldUnsetSprintId) {
      mongoUpdate['$unset'] = { sprintId: '' };
    }

    if (Object.keys(mongoUpdate).length === 0) {
      return existingTask;
    }

    // Aplica update en mongo y devuelve version final para refrescar UI
    const updatedTask = await this.taskModel
      .findByIdAndUpdate(id, mongoUpdate, { returnDocument: 'after' })
      .exec();

    if (!updatedTask) {
      throw new NotFoundException('Tarea no existe.');
    }

    await this.boardActivityService.record({
      boardId: existingTask.boardId.toString(),
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
   * Mueve una tarea de columna y guarda su orden nuevo
   */
  async updatePosition(
    taskId: string,
    newColumnId: string,
    newOrder: string,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<TaskDocument> {
    const existingTask = await this.taskModel.findById(taskId).exec();
    if (!existingTask) {
      throw new NotFoundException('Tarea no existe.');
    }
    const boardId = existingTask.boardId.toString();
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
    await this.boardsService.assertBoardHasColumn(
      boardId,
      newColumnId,
      userId,
      isAppAdmin,
    );
    // Guarda columna y order nuevos cuando se mueve la tarrea
    const previousColumnId = existingTask.columnId.toString();

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

    if (!updatedTask) throw new NotFoundException('Tarea no existe.');

    const fromColumnTitle =
      (await this.boardsService.getColumnTitle(boardId, previousColumnId)) ??
      '(columna desconocida)';
    const toColumnTitle =
      (await this.boardsService.getColumnTitle(boardId, newColumnId)) ??
      '(columna desconocida)';
    let moveMessage = `Movio la tarea «${updatedTask.title}» de «${fromColumnTitle}» a «${toColumnTitle}»`;
    if (previousColumnId === newColumnId) {
      moveMessage = `Reordeno la tarea «${updatedTask.title}» dentro de «${toColumnTitle}»`;
    }

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
   * Archiva una tarea para ocultarla del tablero
   */
  async remove(
    id: string,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<void> {
    const existingTask = await this.taskModel.findById(id).exec();
    if (!existingTask) {
      throw new NotFoundException('Tarea no existe.');
    }
    await this.boardsService.assertUserHasBoardAccess(
      existingTask.boardId.toString(),
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      existingTask.boardId.toString(),
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    if (existingTask.archivedAt) {
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
          $unset: { sprintId: '' },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!archived) {
      throw new NotFoundException('Tarea no existe.');
    }
    await this.boardActivityService.record({
      boardId: existingTask.boardId.toString(),
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.archived',
      message: `Archivó la tarea «${existingTask.title}».`,
      entityId: id,
    });
  }

  /**
   * Restaura una tarea archivada al tablero activo
   */
  async restore(
    id: string,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<TaskDocument> {
    const existingTask = await this.taskModel.findById(id).exec();
    if (!existingTask) {
      throw new NotFoundException('Tarea no existe.');
    }
    await this.boardsService.assertUserHasBoardAccess(
      existingTask.boardId.toString(),
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      existingTask.boardId.toString(),
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    if (!existingTask.archivedAt) {
      return existingTask;
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
      throw new NotFoundException('Tarea no existe.');
    }
    await this.boardActivityService.record({
      boardId: existingTask.boardId.toString(),
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
   * Borra una tarea archivada de forma permanente
   */
  async purge(
    id: string,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<void> {
    const existingTask = await this.taskModel.findById(id).exec();
    if (!existingTask) {
      throw new NotFoundException('Tarea no existe.');
    }
    await this.boardsService.assertUserHasBoardAccess(
      existingTask.boardId.toString(),
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      existingTask.boardId.toString(),
      userId,
      BoardRole.ADMIN,
      isAppAdmin,
    );
    if (!existingTask.archivedAt) {
      throw new BadRequestException('Primero archiva la tarea.');
    }

    const result = await this.taskModel
      .deleteOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Tarea no existe.');
    }
    await this.boardActivityService.record({
      boardId: existingTask.boardId.toString(),
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.deleted.permanent',
      message: `Borró definitivamente la tarea «${existingTask.title}».`,
      entityId: id,
    });
  }

  /**
   * Devuelve votos de story points y valor sugerido
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
    const taskDocument = await this.taskModel.findById(taskId).lean().exec();
    if (!taskDocument) throw new NotFoundException('Tarea no existe.');
    await this.boardsService.assertUserHasBoardAccess(
      taskDocument.boardId.toString(),
      userId,
      isAppAdmin,
    );

    // Normaliza votos para que frontend reciba ids como string
    const votes: { userId: string; value: number }[] = [];
    for (const storyPointVote of taskDocument.storyPointVotes ?? []) {
      votes.push({
        userId: storyPointVote.userId.toString(),
        value: storyPointVote.value,
      });
    }

    const currentUserId = String(userId).trim();
    let myVote: number | null = null;
    for (const vote of votes) {
      if (vote.userId === currentUserId) {
        myVote = vote.value;
        break;
      }
    }

    const voteNumericValues: number[] = [];
    for (const vote of votes) {
      voteNumericValues.push(vote.value);
    }

    return {
      totalVotes: votes.length,
      myVote,
      average: this.nearestFibonacciFromMean(voteNumericValues),
      votes,
    };
  }

  /**
   * Guarda o actualiza el voto de story points
   */
  async voteStoryPoints(
    taskId: string,
    userId: string,
    actorEmail: string,
    value: number,
    isAppAdmin = false,
  ): Promise<void> {
    // Valida que el voto este dentro de la escala permitida
    let allowedValue: StoryPointValue | undefined;
    for (const storyPointValue of STORY_POINT_SCALE) {
      if (storyPointValue === value) {
        allowedValue = storyPointValue;
        break;
      }
    }
    if (allowedValue === undefined) {
      throw new BadRequestException('Valor de story points no permitido.');
    }
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) throw new NotFoundException('Tarea no existe.');
    await this.boardsService.assertUserHasBoardAccess(
      task.boardId.toString(),
      userId,
      isAppAdmin,
    );

    if (!task.storyPointVotes) {
      // Inicializa arreglo si el doc viene sin votos
      task.storyPointVotes = [];
    }
    const normalizedUserId = String(userId).trim();
    let existingVoteIndex = -1;
    for (
      let voteIndex = 0;
      voteIndex < task.storyPointVotes.length;
      voteIndex++
    ) {
      if (String(task.storyPointVotes[voteIndex].userId) === normalizedUserId) {
        existingVoteIndex = voteIndex;
        break;
      }
    }
    if (existingVoteIndex >= 0) {
      task.storyPointVotes[existingVoteIndex].value = allowedValue;
      task.storyPointVotes[existingVoteIndex].votedAt = new Date();
    } else {
      task.storyPointVotes.push({
        userId: new Types.ObjectId(normalizedUserId),
        value: allowedValue,
        votedAt: new Date(),
      });
    }
    if (task.storyPointVotes.length > 0) {
      task.storyPointVotingStatus = 'voting';
    } else {
      task.storyPointVotingStatus = 'idle';
    }
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

  /**
   * Quita el voto del usuario de la votacion actual
   */
  async clearStoryPointsVote(
    taskId: string,
    userId: string,
    actorEmail: string,
    isAppAdmin = false,
  ): Promise<void> {
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) throw new NotFoundException('Tarea no existe.');
    await this.boardsService.assertUserHasBoardAccess(
      task.boardId.toString(),
      userId,
      isAppAdmin,
    );

    if (!task.storyPointVotes || task.storyPointVotes.length === 0) {
      return;
    }

    const normalizedUserId = String(userId).trim();
    const votesWithoutCurrentUser = task.storyPointVotes.filter(
      (voteRow) => String(voteRow.userId) !== normalizedUserId,
    );
    if (votesWithoutCurrentUser.length === task.storyPointVotes.length) {
      return;
    }

    task.storyPointVotes = votesWithoutCurrentUser;
    if (task.storyPointVotes.length > 0) {
      task.storyPointVotingStatus = 'voting';
    } else {
      task.storyPointVotingStatus = 'idle';
      // Si ya no queda ningun voto, limpiamos la estimacion guardada
      task.storyPoints = undefined;
    }
    task.markModified('storyPointVotes');
    await task.save();

    await this.boardActivityService.record({
      boardId: task.boardId.toString(),
      actorUserId: userId,
      actorEmail,
      entityType: 'task',
      action: 'task.storypoints.vote_removed',
      message: `Quitó su voto de story points en «${task.title}».`,
      entityId: taskId,
    });
  }
}
