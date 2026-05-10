import { Model, Types } from 'mongoose';
import { Board, BoardRole } from '../boards/schemas/board.schema';
import { Task, TaskPriority } from '../tasks/schemas/task.schema';
import { DEMO_BOARD_SLUGS } from './constants';
import {
  buildEmptyColumns,
  findColumnIdByTitle,
  insertTasksForBoard,
} from './helpers';
import { buildClosedSprintRecords } from './sprint-data';

export async function seedMainBoard(options: {
  boardModel: Model<Board>;
  taskModel: Model<Task>;
  userIdByEmail: Record<string, Types.ObjectId>;
}) {
  // Tablero principal con mas variacion
  const { boardModel, taskModel, userIdByEmail } = options;
  const adminUser = userIdByEmail['admin@admin.com'];
  const freeUser = userIdByEmail['free.demo@mail.com'];
  const proUser = userIdByEmail['pro.demo@mail.com'];
  const evaUser = userIdByEmail['eva.front@demo.mail'];
  const leoUser = userIdByEmail['leo.back@demo.mail'];
  const noaUser = userIdByEmail['noa.qa@demo.mail'];
  const teoUser = userIdByEmail['teo.devops@demo.mail'];

  const columnsMain = buildEmptyColumns([
    { title: 'backlog', order: 'a0', columnKind: 'workflow' },
    { title: 'sprint', order: 'b0', columnKind: 'workflow' },
    { title: 'to do', order: 'c0', columnKind: 'workflow' },
    { title: 'doing', order: 'd0', columnKind: 'workflow' },
    { title: 'check', order: 'e0', columnKind: 'workflow' },
    { title: 'done', order: 'f0', columnKind: 'done' },
  ]);

  // Mapa rapido titulo a id
  const columnMapMain: Record<string, Types.ObjectId> = {
    backlog: findColumnIdByTitle(columnsMain, 'backlog'),
    sprint: findColumnIdByTitle(columnsMain, 'sprint'),
    'to do': findColumnIdByTitle(columnsMain, 'to do'),
    doing: findColumnIdByTitle(columnsMain, 'doing'),
    check: findColumnIdByTitle(columnsMain, 'check'),
    done: findColumnIdByTitle(columnsMain, 'done'),
  };

  const boardGeckard = await boardModel.create({
    title: 'Geckard - Roadmap TFG',
    slug: DEMO_BOARD_SLUGS[0],
    description:
      'Tablero principal de demo para la exposición: variabilidad de sprints, story points, tiempos y etiquetas.',
    owner: adminUser,
    members: [
      { user: adminUser, role: BoardRole.OWNER },
      { user: proUser, role: BoardRole.ADMIN },
      { user: freeUser, role: BoardRole.VIEWER },
      { user: evaUser, role: BoardRole.EDITOR },
      { user: leoUser, role: BoardRole.EDITOR },
      { user: noaUser, role: BoardRole.EDITOR },
      { user: teoUser, role: BoardRole.EDITOR },
    ],
    columns: columnsMain.map((column) => column.document),
    sprintsEnabled: true,
    sprints: [],
    closedSprintRecords: buildClosedSprintRecords({
      columnIdByTitle: columnMapMain,
      assigneeRotation: [
        adminUser,
        proUser,
        evaUser,
        leoUser,
        noaUser,
        teoUser,
      ],
    }),
  });

  // Carga tareas ejemplo
  await insertTasksForBoard({
    taskModel,
    boardObjectId: boardGeckard._id,
    columnIdByTitle: columnMapMain,
    userIdByEmail,
    taskDefinitions: [
      {
        title: 'Definir alcance v2 para post-TFG',
        columnTitle: 'backlog',
        order: 'a0',
        priority: TaskPriority.MEDIUM,
        storyPoints: 3,
        assigneeEmails: ['admin@admin.com'],
        labels: [{ name: 'investigacion', color: 'purple' }],
      },
      {
        title: 'Mejorar asistente de creación de tablero',
        columnTitle: 'backlog',
        order: 'a1',
        priority: TaskPriority.HIGH,
        storyPoints: 5,
        assigneeEmails: ['eva.front@demo.mail'],
        labels: [{ name: 'frontend', color: 'blue' }],
      },
      {
        title: 'Sprint de accesibilidad y UX',
        columnTitle: 'sprint',
        order: 'b0',
        priority: TaskPriority.MEDIUM,
        storyPoints: 8,
        assigneeEmails: ['eva.front@demo.mail', 'noa.qa@demo.mail'],
        labels: [
          { name: 'frontend', color: 'blue' },
          { name: 'testeo', color: 'yellow' },
        ],
      },
      {
        title: 'Validar permisos por columnas especiales',
        columnTitle: 'sprint',
        order: 'b1',
        priority: TaskPriority.HIGH,
        storyPoints: 5,
        assigneeEmails: ['leo.back@demo.mail'],
        labels: [{ name: 'backend', color: 'green' }],
      },
      {
        title: 'Refactor auth guards para membresías',
        columnTitle: 'to do',
        order: 'c0',
        priority: TaskPriority.HIGH,
        storyPoints: 8,
        assigneeEmails: ['leo.back@demo.mail'],
        labels: [{ name: 'backend', color: 'green' }],
      },
      {
        title: 'Escribir pruebas de regresión de login',
        columnTitle: 'to do',
        order: 'c1',
        priority: TaskPriority.MEDIUM,
        storyPoints: 3,
        assigneeEmails: ['noa.qa@demo.mail'],
        labels: [{ name: 'testeo', color: 'yellow' }],
      },
      {
        title: 'Automatizar backup nocturno en prod',
        columnTitle: 'doing',
        order: 'd0',
        priority: TaskPriority.URGENT,
        storyPoints: 13,
        assigneeEmails: ['teo.devops@demo.mail'],
        labels: [
          { name: 'despliegue', color: 'orange' },
          { name: 'backend', color: 'green' },
        ],
      },
      {
        title: 'Corregir drift de orden en drag and drop',
        columnTitle: 'doing',
        order: 'd1',
        priority: TaskPriority.HIGH,
        storyPoints: 5,
        assigneeEmails: ['eva.front@demo.mail', 'leo.back@demo.mail'],
        labels: [
          { name: 'bug', color: 'red' },
          { name: 'frontend', color: 'blue' },
        ],
      },
      {
        title: 'Revisar checklist de release final',
        columnTitle: 'check',
        order: 'e0',
        priority: TaskPriority.MEDIUM,
        storyPoints: 2,
        assigneeEmails: ['admin@admin.com', 'teo.devops@demo.mail'],
        labels: [{ name: 'documentacion', color: 'gray' }],
      },
      {
        title: 'Auditoría final de permisos por rol',
        columnTitle: 'check',
        order: 'e1',
        priority: TaskPriority.HIGH,
        storyPoints: 3,
        assigneeEmails: ['admin@admin.com', 'noa.qa@demo.mail'],
        labels: [
          { name: 'backend', color: 'green' },
          { name: 'testeo', color: 'yellow' },
        ],
      },
      {
        title: 'Entrega memoria técnica',
        columnTitle: 'done',
        order: 'f0',
        priority: TaskPriority.MEDIUM,
        storyPoints: 5,
        assigneeEmails: ['admin@admin.com'],
        labels: [{ name: 'documentacion', color: 'gray' }],
      },
      {
        title: 'Pipeline CI/CD estable',
        columnTitle: 'done',
        order: 'f1',
        priority: TaskPriority.HIGH,
        storyPoints: 8,
        assigneeEmails: ['teo.devops@demo.mail'],
        labels: [{ name: 'despliegue', color: 'orange' }],
      },
    ],
  });
}

export async function seedFreeBoard(options: {
  boardModel: Model<Board>;
  taskModel: Model<Task>;
  userIdByEmail: Record<string, Types.ObjectId>;
}) {
  // Tablero sencillo para plan free
  const { boardModel, taskModel, userIdByEmail } = options;
  const adminUser = userIdByEmail['admin@admin.com'];
  const freeUser = userIdByEmail['free.demo@mail.com'];

  const columnsFree = buildEmptyColumns([
    { title: 'to do', order: 'a0', columnKind: 'workflow' },
    { title: 'doing', order: 'b0', columnKind: 'workflow' },
    { title: 'done', order: 'c0', columnKind: 'done' },
  ]);
  const columnMapFree: Record<string, Types.ObjectId> = {
    'to do': findColumnIdByTitle(columnsFree, 'to do'),
    doing: findColumnIdByTitle(columnsFree, 'doing'),
    done: findColumnIdByTitle(columnsFree, 'done'),
  };

  const freeBoard = await boardModel.create({
    title: 'Plan Free - tablero básico',
    slug: DEMO_BOARD_SLUGS[1],
    description:
      'Tablero simple para enseñar limitaciones del plan Free en la demo.',
    owner: freeUser,
    members: [
      { user: freeUser, role: BoardRole.OWNER },
      { user: adminUser, role: BoardRole.ADMIN },
    ],
    columns: columnsFree.map((column) => column.document),
    sprintsEnabled: false,
    sprints: [],
    closedSprintRecords: [],
  });

  await insertTasksForBoard({
    taskModel,
    boardObjectId: freeBoard._id,
    columnIdByTitle: columnMapFree,
    userIdByEmail,
    taskDefinitions: [
      {
        title: 'Crear primer tablero',
        columnTitle: 'done',
        order: 'c0',
        priority: TaskPriority.LOW,
        storyPoints: 1,
        assigneeEmails: ['free.demo@mail.com'],
        labels: [{ name: 'onboarding', color: 'sky' }],
      },
    ],
  });
}

export async function seedProBoard(options: {
  boardModel: Model<Board>;
  taskModel: Model<Task>;
  userIdByEmail: Record<string, Types.ObjectId>;
}) {
  // Tablero pro con actividad media
  const { boardModel, taskModel, userIdByEmail } = options;
  const adminUser = userIdByEmail['admin@admin.com'];
  const proUser = userIdByEmail['pro.demo@mail.com'];
  const evaUser = userIdByEmail['eva.front@demo.mail'];
  const noaUser = userIdByEmail['noa.qa@demo.mail'];

  const columnsPro = buildEmptyColumns([
    { title: 'backlog', order: 'a0', columnKind: 'workflow' },
    { title: 'doing', order: 'b0', columnKind: 'workflow' },
    { title: 'done', order: 'c0', columnKind: 'done' },
  ]);
  const columnMapPro: Record<string, Types.ObjectId> = {
    backlog: findColumnIdByTitle(columnsPro, 'backlog'),
    doing: findColumnIdByTitle(columnsPro, 'doing'),
    done: findColumnIdByTitle(columnsPro, 'done'),
  };

  const proBoard = await boardModel.create({
    title: 'Plan Pro - equipo pequeño',
    slug: DEMO_BOARD_SLUGS[2],
    description:
      'Tablero para usuario Pro con más actividad que Free pero menos que Team.',
    owner: proUser,
    members: [
      { user: proUser, role: BoardRole.OWNER },
      { user: adminUser, role: BoardRole.ADMIN },
      { user: evaUser, role: BoardRole.EDITOR },
      { user: noaUser, role: BoardRole.EDITOR },
    ],
    columns: columnsPro.map((column) => column.document),
    sprintsEnabled: true,
    sprints: [],
    closedSprintRecords: [],
  });

  await insertTasksForBoard({
    taskModel,
    boardObjectId: proBoard._id,
    columnIdByTitle: columnMapPro,
    userIdByEmail,
    taskDefinitions: [
      {
        title: 'Analizar embudo de conversión',
        columnTitle: 'backlog',
        order: 'a0',
        priority: TaskPriority.MEDIUM,
        storyPoints: 3,
        assigneeEmails: ['pro.demo@mail.com'],
        labels: [{ name: 'investigacion', color: 'purple' }],
      },
      {
        title: 'Corregir bug de filtros en dashboard',
        columnTitle: 'doing',
        order: 'b0',
        priority: TaskPriority.HIGH,
        storyPoints: 5,
        assigneeEmails: ['eva.front@demo.mail', 'pro.demo@mail.com'],
        labels: [
          { name: 'bug', color: 'red' },
          { name: 'frontend', color: 'blue' },
        ],
      },
      {
        title: 'Suite de smoke tests semanal',
        columnTitle: 'done',
        order: 'c0',
        priority: TaskPriority.MEDIUM,
        storyPoints: 2,
        assigneeEmails: ['noa.qa@demo.mail'],
        labels: [{ name: 'testeo', color: 'yellow' }],
      },
    ],
  });
}
