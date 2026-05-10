import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { Board } from '../boards/schemas/board.schema';
import { Task, TaskPriority } from '../tasks/schemas/task.schema';
import { User } from '../users/schemas/user.schema';
import { DEMO_BOARD_SLUGS, DEMO_PASSWORD_PLAIN, DEMO_USERS } from './constants';

export type ColumnTemplate = {
  title: string;
  order: string;
  columnKind: 'workflow' | 'done' | 'archived';
};

export function buildEmptyColumns(
  templates: ColumnTemplate[],
): { columnId: Types.ObjectId; document: Record<string, unknown> }[] {
  // Crea columnas vacias con id fijo para luego enlazar tareas
  const rows: {
    columnId: Types.ObjectId;
    document: Record<string, unknown>;
  }[] = [];
  for (let index = 0; index < templates.length; index++) {
    const template = templates[index];
    const columnId = new Types.ObjectId();
    rows.push({
      columnId,
      document: {
        _id: columnId,
        title: template.title,
        order: template.order,
        columnKind: template.columnKind,
        tasks: [] as Types.ObjectId[],
      },
    });
  }
  return rows;
}

export function findColumnIdByTitle(
  columns: { columnId: Types.ObjectId; document: Record<string, unknown> }[],
  title: string,
): Types.ObjectId {
  // Busca columna por titulo exacto dentro del tablero demo
  for (let index = 0; index < columns.length; index++) {
    const column = columns[index];
    if (column.document['title'] === title) {
      return column.columnId;
    }
  }
  throw new Error(`Columna no encontrada: ${title}`);
}

export async function removePreviousDemoBoards(
  boardModel: Model<Board>,
  taskModel: Model<Task>,
): Promise<void> {
  // Ubica tableros demo por slug para borrarlos junto con sus tareas
  const existingBoards = await boardModel
    .find({ slug: { $in: [...DEMO_BOARD_SLUGS] } })
    .select('_id')
    .lean()
    .exec();

  const boardObjectIds: Types.ObjectId[] = [];
  for (let index = 0; index < existingBoards.length; index++) {
    boardObjectIds.push(existingBoards[index]._id);
  }
  if (boardObjectIds.length === 0) return;

  // Primero borra tareas hijas y despues tableros para mantener limpieza
  await taskModel.deleteMany({ boardId: { $in: boardObjectIds } }).exec();
  await boardModel.deleteMany({ _id: { $in: boardObjectIds } }).exec();
}

export async function upsertDemoUsers(
  userModel: Model<User>,
): Promise<Record<string, Types.ObjectId>> {
  // Usa una sola contraseña demo para acelerar seed local
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD_PLAIN, 10);
  const userIdByEmail: Record<string, Types.ObjectId> = {};

  for (const definition of DEMO_USERS) {
    // Upsert por email para que el seed sea idempotente
    const updated = await userModel.findOneAndUpdate(
      { email: definition.email },
      {
        $set: {
          username: definition.username,
          email: definition.email,
          passwordHash,
          role: definition.role,
          userPlan: definition.userPlan,
          bio: 'Cuenta demo generada automáticamente para el TFG.',
          avatarUrl: '',
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    if (!updated?._id) {
      throw new Error(`No se pudo upsert usuario: ${definition.email}`);
    }
    userIdByEmail[definition.email] = updated._id;
  }

  return userIdByEmail;
}

export type TaskSeedDefinition = {
  title: string;
  columnTitle: string;
  order: string;
  priority?: TaskPriority;
  storyPoints?: number;
  assigneeEmails: string[];
  labels: { name: string; color: string }[];
};

export async function insertTasksForBoard(options: {
  taskModel: Model<Task>;
  boardObjectId: Types.ObjectId;
  columnIdByTitle: Record<string, Types.ObjectId>;
  userIdByEmail: Record<string, Types.ObjectId>;
  taskDefinitions: TaskSeedDefinition[];
}): Promise<void> {
  const {
    taskModel,
    boardObjectId,
    columnIdByTitle,
    taskDefinitions,
    userIdByEmail,
  } = options;

  for (const row of taskDefinitions) {
    // Convierte emails de asignados en objectid reales de usuario
    const assigneeIds: Types.ObjectId[] = [];
    for (let index = 0; index < row.assigneeEmails.length; index++) {
      const assigneeEmail = row.assigneeEmails[index];
      const assigneeId = userIdByEmail[assigneeEmail];
      if (assigneeId) {
        assigneeIds.push(assigneeId);
      }
    }

    await taskModel.create({
      title: row.title,
      description: '',
      boardId: boardObjectId,
      columnId: columnIdByTitle[row.columnTitle],
      order: row.order,
      priority: row.priority ?? TaskPriority.MEDIUM,
      storyPoints: row.storyPoints,
      labels: row.labels,
      assigneeIds,
      links: [],
      checklist: [],
    });
  }
}
