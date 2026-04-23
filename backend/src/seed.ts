/**
 * Seeder de entorno demo (desarrollo / presentaciones).
 *
 * Credenciales (tras `npm run seed` en backend):
 * - admin@admin.com / adminadmin (rol app admin)
 * - usuario@mail.com / Demo2026! (propietario de tableros demo, plan team)
 * - alex.martin@demo.mail, bruna.silva@demo.mail, carlos.mendez@demo.mail, dana.kim@demo.mail / Demo2026!
 *
 * Tableros (slug): demo-sprint-showcase | demo-creative-studio | demo-enterprise-rollout
 *
 * Idempotente: borra tableros con esos slug y sus tareas, luego recrea usuarios demo y tableros.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from './users/schemas/user.schema';
import { Board, BoardRole } from './boards/schemas/board.schema';
import { Task } from './tasks/schemas/task.schema';
import { TaskPriority } from './tasks/schemas/task.schema';

const DEMO_BOARD_SLUGS = [
  'demo-sprint-showcase',
  'demo-creative-studio',
  'demo-enterprise-rollout',
] as const;

const DEMO_PASSWORD_PLAIN = 'Usuario123.';
const ADMIN_PASSWORD_PLAIN = 'Usuario123.';

type DemoUserSeed = {
  email: string;
  username: string;
  role: 'user' | 'admin';
  userPlan: 'free' | 'pro' | 'team';
  avatarUrl: string;
};

const DEMO_USERS: DemoUserSeed[] = [
  {
    email: 'admin@admin.com',
    username: 'adminDemo',
    role: 'admin',
    userPlan: 'team',
    avatarUrl:
      'https://ui-avatars.com/api/?name=Admin&size=128&background=1e293b&color=fff',
  },
  {
    email: 'usuario@mail.com',
    username: 'usuarioDemo',
    role: 'user',
    userPlan: 'team',
    avatarUrl:
      'https://ui-avatars.com/api/?name=Usuario+Demo&size=128&background=0078c4&color=fff',
  },
  {
    email: 'alex.martin@demo.mail',
    username: 'alexMartin',
    role: 'user',
    userPlan: 'pro',
    avatarUrl:
      'https://ui-avatars.com/api/?name=Alex+Martin&size=128&background=0d9488&color=fff',
  },
  {
    email: 'bruna.silva@demo.mail',
    username: 'brunaSilva',
    role: 'user',
    userPlan: 'pro',
    avatarUrl:
      'https://ui-avatars.com/api/?name=Bruna+Silva&size=128&background=7c3aed&color=fff',
  },
  {
    email: 'carlos.mendez@demo.mail',
    username: 'carlosMendez',
    role: 'user',
    userPlan: 'free',
    avatarUrl:
      'https://ui-avatars.com/api/?name=Carlos+Mendez&size=128&background=ea580c&color=fff',
  },
  {
    email: 'dana.kim@demo.mail',
    username: 'danaKim',
    role: 'user',
    userPlan: 'free',
    avatarUrl:
      'https://ui-avatars.com/api/?name=Dana+Kim&size=128&background=db2777&color=fff',
  },
];

function sprintActivityDate(dayIndex: number, hourInDay: number): Date {
  const base = new Date('2026-02-10T00:00:00.000Z');
  base.setUTCDate(base.getUTCDate() + dayIndex);
  base.setUTCHours(hourInDay, 15, 0, 0);
  return base;
}

async function removePreviousDemoBoards(
  boardModel: Model<Board>,
  taskModel: Model<Task>,
): Promise<void> {
  const existingBoards = await boardModel
    .find({ slug: { $in: [...DEMO_BOARD_SLUGS] } })
    .select('_id')
    .lean()
    .exec();
  const boardObjectIds = existingBoards.map((document) => document._id);
  if (boardObjectIds.length === 0) {
    return;
  }
  await taskModel.deleteMany({ boardId: { $in: boardObjectIds } }).exec();
  await boardModel.deleteMany({ _id: { $in: boardObjectIds } }).exec();
  console.log(
    'Tableros demo anteriores eliminados:',
    DEMO_BOARD_SLUGS.join(', '),
  );
}

async function upsertDemoUsers(
  userModel: Model<User>,
): Promise<Record<string, Types.ObjectId>> {
  const passwordForDemo = await bcrypt.hash(DEMO_PASSWORD_PLAIN, 10);
  const passwordForAdmin = await bcrypt.hash(ADMIN_PASSWORD_PLAIN, 10);
  const userIdByEmail: Record<string, Types.ObjectId> = {};

  for (let index = 0; index < DEMO_USERS.length; index++) {
    const definition = DEMO_USERS[index];
    const passwordHash =
      definition.email === 'admin@admin.com'
        ? passwordForAdmin
        : passwordForDemo;

    const updated = await userModel.findOneAndUpdate(
      { email: definition.email },
      {
        $set: {
          username: definition.username,
          email: definition.email,
          passwordHash,
          role: definition.role,
          userPlan: definition.userPlan,
          avatarUrl: definition.avatarUrl,
          bio: 'Cuenta generada por el seeder demo.',
        },
      },
      { upsert: true, new: true },
    );
    if (!updated || !updated._id) {
      throw new Error(`No se pudo upsert usuario: ${definition.email}`);
    }
    userIdByEmail[definition.email] = updated._id;
    console.log('Usuario demo listo:', definition.email);
  }

  return userIdByEmail;
}

type ColumnTemplate = {
  title: string;
  order: string;
  columnKind: 'workflow' | 'done' | 'archived';
};

function buildEmptyColumns(
  templates: ColumnTemplate[],
): { columnId: Types.ObjectId; document: Record<string, unknown> }[] {
  const output: {
    columnId: Types.ObjectId;
    document: Record<string, unknown>;
  }[] = [];
  for (let index = 0; index < templates.length; index++) {
    const template = templates[index];
    const columnId = new Types.ObjectId();
    output.push({
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
  return output;
}

function findColumnIdByTitle(
  columns: { columnId: Types.ObjectId; document: Record<string, unknown> }[],
  title: string,
): Types.ObjectId {
  for (let index = 0; index < columns.length; index++) {
    if (columns[index].document['title'] === title) {
      return columns[index].columnId;
    }
  }
  throw new Error(`Columna no encontrada: ${title}`);
}

async function insertTasksForBoard(options: {
  taskModel: Model<Task>;
  boardObjectId: Types.ObjectId;
  columnIdByTitle: Record<string, Types.ObjectId>;
  userIdByEmail: Record<string, Types.ObjectId>;
  taskDefinitions: {
    title: string;
    columnTitle: string;
    order: string;
    priority?: TaskPriority;
    storyPoints?: number;
    sprintId?: Types.ObjectId;
    assigneeEmails: string[];
    labels: { name: string; color: string }[];
  }[];
}): Promise<void> {
  const {
    taskModel,
    boardObjectId,
    columnIdByTitle,
    taskDefinitions,
    userIdByEmail,
  } = options;

  for (let index = 0; index < taskDefinitions.length; index++) {
    const row = taskDefinitions[index];
    const columnId = columnIdByTitle[row.columnTitle];
    const assigneeIds: Types.ObjectId[] = [];
    for (
      let assigneeIndex = 0;
      assigneeIndex < row.assigneeEmails.length;
      assigneeIndex++
    ) {
      const emailKey = row.assigneeEmails[assigneeIndex];
      const userObjectId = userIdByEmail[emailKey];
      if (userObjectId) {
        assigneeIds.push(userObjectId);
      }
    }
    await taskModel.create({
      title: row.title,
      description: '',
      boardId: boardObjectId,
      columnId,
      order: row.order,
      priority: row.priority ?? TaskPriority.MEDIUM,
      storyPoints: row.storyPoints,
      sprintId: row.sprintId,
      labels: row.labels,
      assigneeIds,
      links: [],
      checklist: [],
    });
  }
}

async function bootstrap(): Promise<void> {
  console.log('=== SEED DEMO Geckard ===');

  const application = await NestFactory.createApplicationContext(AppModule);
  const userModel = application.get<Model<User>>(getModelToken(User.name));
  const boardModel = application.get<Model<Board>>(getModelToken(Board.name));
  const taskModel = application.get<Model<Task>>(getModelToken(Task.name));

  try {
    await removePreviousDemoBoards(boardModel, taskModel);
    const userIdByEmail = await upsertDemoUsers(userModel);

    const ownerMain = userIdByEmail['usuario@mail.com'];
    const adminUser = userIdByEmail['admin@admin.com'];
    const alexUser = userIdByEmail['alex.martin@demo.mail'];
    const brunaUser = userIdByEmail['bruna.silva@demo.mail'];
    const carlosUser = userIdByEmail['carlos.mendez@demo.mail'];
    const danaUser = userIdByEmail['dana.kim@demo.mail'];

    // --- Tablero 1: historial de sprints rico (gráficos) ---
    const columnsShowcase = buildEmptyColumns([
      { title: 'Ideas', order: 'a0', columnKind: 'workflow' },
      { title: 'In progress', order: 'b0', columnKind: 'workflow' },
      { title: 'Done', order: 'c0', columnKind: 'done' },
    ]);
    const columnIdeas = findColumnIdByTitle(columnsShowcase, 'Ideas');
    const columnProgress = findColumnIdByTitle(columnsShowcase, 'In progress');
    const columnDone = findColumnIdByTitle(columnsShowcase, 'Done');

    const sprintAlphaId = new Types.ObjectId();
    const sprintBetaId = new Types.ObjectId();
    const sprintGammaId = new Types.ObjectId();

    const labelRotation = [
      { name: 'bug', color: 'red' },
      { name: 'feature', color: 'blue' },
      { name: 'design', color: 'purple' },
      { name: 'docs', color: 'gray' },
      { name: 'performance', color: 'orange' },
      { name: 'customer', color: 'green' },
    ];

    /** Solo miembros listados en `board.members` (la API de miembros no incluye al owner). */
    const assigneeRotation = [alexUser, brunaUser, carlosUser, danaUser];

    function buildSnapshotsForSprint(options: {
      sprintOffset: number;
      totalSnapshots: number;
      completedRatio: number;
    }) {
      const snapshots: Record<string, unknown>[] = [];
      const completedCount = Math.floor(
        options.totalSnapshots * options.completedRatio,
      );
      for (
        let snapshotIndex = 0;
        snapshotIndex < options.totalSnapshots;
        snapshotIndex++
      ) {
        const wasCompleted = snapshotIndex < completedCount;
        const columnId = wasCompleted ? columnDone : columnProgress;
        const columnTitleAtClose = wasCompleted ? 'Done' : 'In progress';
        const assigneeUser =
          assigneeRotation[snapshotIndex % assigneeRotation.length];
        const labelEntry = labelRotation[snapshotIndex % labelRotation.length];
        const dayIndex = (snapshotIndex + options.sprintOffset * 2) % 8;
        const hourInDay = 9 + (snapshotIndex % 6);
        snapshots.push({
          taskId: new Types.ObjectId(),
          title: `Sprint work item ${snapshotIndex + 1}`,
          columnId,
          columnTitleAtClose,
          wasCompleted,
          storyPointsWhenDone: wasCompleted
            ? ([1, 2, 3, 5, 8] as const)[snapshotIndex % 5]
            : undefined,
          taskUpdatedAtAtClose: sprintActivityDate(dayIndex, hourInDay),
          assigneeIdsAtClose: [assigneeUser],
          labelsAtClose: [labelEntry],
        });
      }
      return snapshots;
    }

    const closedSprintRecordsShowcase = [
      {
        sprintId: sprintAlphaId,
        sprintName: 'Sprint 01 — Foundation',
        closedAt: new Date('2026-02-28T18:00:00.000Z'),
        startedAt: new Date('2026-02-01T09:00:00.000Z'),
        plannedEndAt: new Date('2026-02-28T17:00:00.000Z'),
        taskSnapshots: buildSnapshotsForSprint({
          sprintOffset: 0,
          totalSnapshots: 22,
          completedRatio: 0.62,
        }),
      },
      {
        sprintId: sprintBetaId,
        sprintName: 'Sprint 02 — Growth',
        closedAt: new Date('2026-03-20T17:30:00.000Z'),
        startedAt: new Date('2026-03-01T09:00:00.000Z'),
        plannedEndAt: new Date('2026-03-22T17:00:00.000Z'),
        taskSnapshots: buildSnapshotsForSprint({
          sprintOffset: 1,
          totalSnapshots: 18,
          completedRatio: 0.72,
        }),
      },
      {
        sprintId: sprintGammaId,
        sprintName: 'Sprint 03 — Polish',
        closedAt: new Date('2026-04-05T16:00:00.000Z'),
        startedAt: new Date('2026-03-25T09:00:00.000Z'),
        plannedEndAt: new Date('2026-04-06T17:00:00.000Z'),
        taskSnapshots: buildSnapshotsForSprint({
          sprintOffset: 2,
          totalSnapshots: 14,
          completedRatio: 0.55,
        }),
      },
    ];

    const boardShowcase = await boardModel.create({
      title: 'Demo · Sprint analytics showcase',
      slug: DEMO_BOARD_SLUGS[0],
      description:
        'Historial de sprints con datos variados: etiquetas, asignaciones, fechas y puntos — ideal para enseñar los gráficos del informe.',
      owner: ownerMain,
      members: [
        { user: adminUser, role: BoardRole.ADMIN },
        { user: alexUser, role: BoardRole.EDITOR },
        { user: brunaUser, role: BoardRole.EDITOR },
        { user: carlosUser, role: BoardRole.EDITOR },
        { user: danaUser, role: BoardRole.VIEWER },
      ],
      columns: columnsShowcase.map((column) => column.document),
      sprintsEnabled: true,
      sprints: [],
      closedSprintRecords: closedSprintRecordsShowcase,
    });

    const columnMapShowcase: Record<string, Types.ObjectId> = {
      Ideas: columnIdeas,
      'In progress': columnProgress,
      Done: columnDone,
    };

    await insertTasksForBoard({
      taskModel,
      boardObjectId: boardShowcase._id,
      columnIdByTitle: columnMapShowcase,
      userIdByEmail,
      taskDefinitions: [
        {
          title: 'Refinar backlog del próximo trimestre',
          columnTitle: 'Ideas',
          order: 'a0',
          assigneeEmails: ['usuario@mail.com'],
          labels: [{ name: 'planning', color: 'sky' }],
        },
        {
          title: 'Diseño navegación móvil',
          columnTitle: 'In progress',
          order: 'b0',
          storyPoints: 5,
          assigneeEmails: ['bruna.silva@demo.mail'],
          labels: [{ name: 'design', color: 'purple' }],
        },
        {
          title: 'API rate limiting',
          columnTitle: 'Done',
          order: 'c0',
          storyPoints: 8,
          assigneeEmails: ['alex.martin@demo.mail', 'carlos.mendez@demo.mail'],
          labels: [
            { name: 'backend', color: 'blue' },
            { name: 'performance', color: 'orange' },
          ],
        },
      ],
    });

    console.log('Tablero creado:', DEMO_BOARD_SLUGS[0]);

    // --- Tablero 2: sprint activo + un cierre previo ---
    const columnsStudio = buildEmptyColumns([
      { title: 'Backlog', order: 'a0', columnKind: 'workflow' },
      { title: 'Doing', order: 'b0', columnKind: 'workflow' },
      { title: 'Hecho', order: 'c0', columnKind: 'done' },
    ]);
    const studioBacklog = findColumnIdByTitle(columnsStudio, 'Backlog');
    const studioDoing = findColumnIdByTitle(columnsStudio, 'Doing');
    const studioDone = findColumnIdByTitle(columnsStudio, 'Hecho');

    const sprintCurrentId = new Types.ObjectId();
    const sprintPastId = new Types.ObjectId();

    const closedStudioSnapshots: Record<string, unknown>[] = [];
    for (let index = 0; index < 12; index++) {
      const wasCompleted = index < 8;
      closedStudioSnapshots.push({
        taskId: new Types.ObjectId(),
        title: `Creative sprint task ${index + 1}`,
        columnId: wasCompleted ? studioDone : studioDoing,
        columnTitleAtClose: wasCompleted ? 'Hecho' : 'Doing',
        wasCompleted,
        storyPointsWhenDone: wasCompleted ? 3 : undefined,
        taskUpdatedAtAtClose: sprintActivityDate(index % 5, 11),
        assigneeIdsAtClose: index % 2 === 0 ? [brunaUser] : [danaUser],
        labelsAtClose: [{ name: 'ux', color: 'purple' }],
      });
    }

    const boardStudioDocument = await boardModel.create({
      title: 'Demo · Creative studio',
      slug: DEMO_BOARD_SLUGS[1],
      description:
        'Sprint activo con tareas etiquetadas y un sprint cerrado reciente. Prueba cerrar el sprint desde la cabecera.',
      owner: brunaUser,
      members: [
        { user: ownerMain, role: BoardRole.ADMIN },
        { user: adminUser, role: BoardRole.ADMIN },
        { user: alexUser, role: BoardRole.EDITOR },
        { user: carlosUser, role: BoardRole.EDITOR },
        { user: danaUser, role: BoardRole.VIEWER },
      ],
      columns: columnsStudio.map((column) => column.document),
      sprintsEnabled: true,
      sprints: [
        {
          _id: sprintCurrentId,
          name: 'Sprint Visual polish',
          startedAt: new Date('2026-04-01T10:00:00.000Z'),
          plannedEndAt: new Date('2026-04-18T18:00:00.000Z'),
        },
      ],
      activeSprintId: sprintCurrentId,
      closedSprintRecords: [
        {
          sprintId: sprintPastId,
          sprintName: 'Sprint Brand refresh',
          closedAt: new Date('2026-03-28T12:00:00.000Z'),
          startedAt: new Date('2026-03-10T09:00:00.000Z'),
          plannedEndAt: new Date('2026-03-29T17:00:00.000Z'),
          taskSnapshots: closedStudioSnapshots,
        },
      ],
    });

    const columnMapStudio: Record<string, Types.ObjectId> = {
      Backlog: studioBacklog,
      Doing: studioDoing,
      Hecho: studioDone,
    };

    const studioBoardObjectId = boardStudioDocument._id;

    await insertTasksForBoard({
      taskModel,
      boardObjectId: studioBoardObjectId,
      columnIdByTitle: columnMapStudio,
      userIdByEmail,
      taskDefinitions: [
        {
          title: 'Storyboard onboarding',
          columnTitle: 'Backlog',
          order: 'a0',
          sprintId: sprintCurrentId,
          assigneeEmails: ['dana.kim@demo.mail'],
          labels: [{ name: 'storyboard', color: 'yellow' }],
        },
        {
          title: 'Ilustraciones marketing',
          columnTitle: 'Doing',
          order: 'b0',
          sprintId: sprintCurrentId,
          storyPoints: 5,
          assigneeEmails: ['bruna.silva@demo.mail'],
          labels: [{ name: 'illustration', color: 'purple' }],
        },
      ],
    });

    console.log('Tablero creado:', DEMO_BOARD_SLUGS[1]);

    // --- Tablero 3: Kanban clásico sin sprints ---
    const columnsEnterprise = buildEmptyColumns([
      { title: 'Intake', order: 'a0', columnKind: 'workflow' },
      { title: 'Delivery', order: 'b0', columnKind: 'workflow' },
      { title: 'Done', order: 'c0', columnKind: 'done' },
    ]);
    const enterpriseIntake = findColumnIdByTitle(columnsEnterprise, 'Intake');
    const enterpriseDelivery = findColumnIdByTitle(
      columnsEnterprise,
      'Delivery',
    );
    const enterpriseDone = findColumnIdByTitle(columnsEnterprise, 'Done');

    await boardModel.create({
      title: 'Demo · Enterprise rollout',
      slug: DEMO_BOARD_SLUGS[2],
      description:
        'Flujo Kanban sin modo sprint: columnas, prioridades y varios asignados para demos de tablero.',
      owner: carlosUser,
      members: [
        { user: ownerMain, role: BoardRole.ADMIN },
        { user: adminUser, role: BoardRole.ADMIN },
        { user: alexUser, role: BoardRole.EDITOR },
        { user: brunaUser, role: BoardRole.EDITOR },
        { user: danaUser, role: BoardRole.EDITOR },
      ],
      columns: columnsEnterprise.map((column) => column.document),
      sprintsEnabled: false,
      sprints: [],
      closedSprintRecords: [],
    });

    const boardEnterpriseDoc = await boardModel
      .findOne({ slug: DEMO_BOARD_SLUGS[2] })
      .exec();
    const columnMapEnterprise: Record<string, Types.ObjectId> = {
      Intake: enterpriseIntake,
      Delivery: enterpriseDelivery,
      Done: enterpriseDone,
    };

    await insertTasksForBoard({
      taskModel,
      boardObjectId: boardEnterpriseDoc!._id,
      columnIdByTitle: columnMapEnterprise,
      userIdByEmail,
      taskDefinitions: [
        {
          title: 'Kickoff legal y seguridad',
          columnTitle: 'Intake',
          order: 'a0',
          priority: TaskPriority.HIGH,
          assigneeEmails: ['carlos.mendez@demo.mail'],
          labels: [{ name: 'legal', color: 'gray' }],
        },
        {
          title: 'Integración SSO',
          columnTitle: 'Delivery',
          order: 'b0',
          priority: TaskPriority.URGENT,
          storyPoints: 13,
          assigneeEmails: ['alex.martin@demo.mail'],
          labels: [{ name: 'security', color: 'red' }],
        },
        {
          title: 'Go-live checklist',
          columnTitle: 'Done',
          order: 'c0',
          priority: TaskPriority.MEDIUM,
          storyPoints: 3,
          assigneeEmails: ['dana.kim@demo.mail', 'usuario@mail.com'],
          labels: [{ name: 'release', color: 'green' }],
        },
      ],
    });

    console.log('Tablero creado:', DEMO_BOARD_SLUGS[2]);

    console.log('');
    console.log('=== Listo ===');
    console.log(
      'Inicia sesión como usuario@mail.com / Demo2026! y abre /boards/demo-sprint-showcase',
    );
    console.log(
      'Historial de sprints: menú de vista → sprints cerrados (3 informes con gráficos).',
    );
    console.log('Admin global: admin@admin.com / adminadmin');
  } catch (error) {
    console.error('ERROR EN SEED', error);
  } finally {
    await application.close();
    process.exit(0);
  }
}

void bootstrap();
