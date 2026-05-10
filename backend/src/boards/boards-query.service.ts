import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Board,
  BoardColumn,
  BoardColumnKind,
  BoardDocument,
} from './schemas/board.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';

type RawStoryPointVote = {
  userId?: Types.ObjectId | null;
  value: number;
};

type RawBoardTask = {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  columnId: Types.ObjectId;
  sprintId?: Types.ObjectId | null;
  assigneeIds?: Types.ObjectId[];
  storyPointVotes?: RawStoryPointVote[];
  links?: unknown;
  checklist?: unknown;
};

type BoardTaskClient = {
  [key: string]: unknown;
  _id: string;
  boardId: string;
  columnId: string;
  assigneeIds: string[];
  storyPointVotes: { userId: string; value: number }[];
  links: { url: string; title?: string }[];
  checklist: { text: string; checked: boolean }[];
  sprintId?: string;
};

@Injectable()
export class BoardsQueryService {
  /**
   * Inyecta modelos para leer tablero y tareas activas
   */
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
  ) {}

  /**
   * Limpia enlaces de tarea antes de enviarlos al front
   */
  private mapTaskLinks(raw: unknown): { url: string; title?: string }[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const items = raw as unknown[];
    const normalizedLinks: { url: string; title?: string }[] = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const record = item as Record<string, unknown>;
      const urlVal = record['url'];
      if (typeof urlVal !== 'string') {
        continue;
      }
      const url = urlVal.trim();
      if (!url) {
        continue;
      }
      const titleVal = record['title'];
      const titleTrim =
        typeof titleVal === 'string' ? titleVal.trim().slice(0, 200) : '';
      if (titleTrim) {
        normalizedLinks.push({ url, title: titleTrim });
      } else {
        normalizedLinks.push({ url });
      }
    }
    return normalizedLinks;
  }

  /**
   * Limpia checklist de tarea para evitar items invalidos
   */
  private mapTaskChecklist(raw: unknown): { text: string; checked: boolean }[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const items = raw as unknown[];
    const normalizedChecklist: { text: string; checked: boolean }[] = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const record = item as Record<string, unknown>;
      const textVal = record['text'];
      if (typeof textVal !== 'string') {
        continue;
      }
      const text = textVal.trim().slice(0, 500);
      if (!text) {
        continue;
      }
      const checkedVal = record['checked'];
      normalizedChecklist.push({ text, checked: checkedVal === true });
    }
    return normalizedChecklist;
  }

  /**
   * Mapea tarea mongo al formato que usa el cliente
   */
  private mapTaskForBoardClient(task: RawBoardTask): BoardTaskClient {
    // Se normalizan ids porque el front trabaja con string
    const votes = task.storyPointVotes ?? [];
    const assigneeIds: string[] = [];
    const rawAssignees = task.assigneeIds ?? [];
    for (let index = 0; index < rawAssignees.length; index++) {
      assigneeIds.push(rawAssignees[index].toString());
    }
    const storyPointVotesOut: { userId: string; value: number }[] = [];
    for (let index = 0; index < votes.length; index++) {
      const vote = votes[index];
      let voterUserId = '';
      if (vote.userId !== undefined && vote.userId !== null) {
        voterUserId = vote.userId.toString();
      }
      storyPointVotesOut.push({
        userId: voterUserId,
        value: vote.value,
      });
    }
    const mapped: Record<string, unknown> = {
      ...task,
      _id: task._id.toString(),
      boardId: task.boardId.toString(),
      columnId: task.columnId.toString(),
      assigneeIds,
      storyPointVotes: storyPointVotesOut,
      links: this.mapTaskLinks(task.links),
      checklist: this.mapTaskChecklist(task.checklist),
    };
    // Guardamos sprintId solo cuando existe en la tarea
    if (task.sprintId !== undefined && task.sprintId !== null) {
      mapped['sprintId'] = task.sprintId.toString();
    }
    return mapped as BoardTaskClient;
  }

  /**
   * Carga tablero por slug con columnas activas y archivadas
   */
  async findOneBySlug(slug: string, userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    // Validamos acceso por owner o miembro del tablero
    const boardDoc = await this.boardModel
      .findOne({
        slug,
        $or: [{ owner: userObjectId }, { 'members.user': userObjectId }],
      })
      .lean()
      .exec();

    if (!boardDoc) {
      throw new NotFoundException(`El tablero no existe o no tienes permiso.`);
    }

    // Traemos solo tareas activas para el estado vivo del kanban
    const tasks = await this.taskModel
      .find({
        boardId: boardDoc._id,
        $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
      })
      .lean()
      .exec();

    type ColumnWithId = BoardColumn & { _id: Types.ObjectId };

    const columnsOut: unknown[] = [];
    const archivedColumnsOut: unknown[] = [];
    const rawColumns = boardDoc.columns;
    for (let columnIndex = 0; columnIndex < rawColumns.length; columnIndex++) {
      const column = rawColumns[columnIndex];
      const columnWithId = column as ColumnWithId;
      const columnIdString = columnWithId._id.toString();
      const columnArchivedAt = (column as { archivedAt?: Date }).archivedAt;
      const columnArchivedBy = (column as { archivedBy?: Types.ObjectId })
        .archivedBy;
      let columnKindValue: BoardColumnKind = 'workflow';
      if (column.columnKind === 'done' || column.columnKind === 'archived') {
        columnKindValue = column.columnKind;
      }
      if (columnArchivedAt != null) {
        // La columna archivada se mueve al bloque de historial
        const archivedData: Record<string, unknown> = {
          _id: columnIdString,
          title: column.title,
          order: column.order,
          columnKind: columnKindValue,
        };
        if (columnArchivedAt instanceof Date) {
          archivedData['archivedAt'] = columnArchivedAt.toISOString();
        } else {
          archivedData['archivedAt'] = String(columnArchivedAt);
        }
        if (columnArchivedBy) {
          archivedData['archivedBy'] = columnArchivedBy.toString();
        }
        archivedColumnsOut.push(archivedData);
        continue;
      }
      const columnTasksRaw: (typeof tasks)[number][] = [];
      for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
        const taskRow = tasks[taskIndex];
        if (taskRow.columnId.toString() === columnIdString) {
          columnTasksRaw.push(taskRow);
        }
      }
      // Orden visual por clave order para mostrar en el mismo orden
      columnTasksRaw.sort((first, second) => {
        if (first.order === second.order) return 0;
        return first.order < second.order ? -1 : 1;
      });
      const mappedTasks: unknown[] = [];
      for (
        let mappedIndex = 0;
        mappedIndex < columnTasksRaw.length;
        mappedIndex++
      ) {
        const rawTask = columnTasksRaw[mappedIndex] as unknown as RawBoardTask;
        mappedTasks.push(this.mapTaskForBoardClient(rawTask));
      }
      columnsOut.push({
        ...column,
        columnKind: columnKindValue,
        tasks: mappedTasks,
      });
    }

    return {
      ...boardDoc,
      columns: columnsOut,
      archivedColumns: archivedColumnsOut,
    };
  }
}
