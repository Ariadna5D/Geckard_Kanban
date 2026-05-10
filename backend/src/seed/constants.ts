export const DEMO_BOARD_SLUGS = [
  'demo-geckard-tfg-roadmap',
  'demo-free-user-board',
  'demo-pro-user-board',
] as const;

// Password comun para cuentas demo
export const DEMO_PASSWORD_PLAIN = 'Usuario123.';

export type DemoUserSeed = {
  email: string;
  username: string;
  role: 'user' | 'admin';
  userPlan: 'free' | 'pro' | 'team';
};

export const DEMO_USERS: DemoUserSeed[] = [
  // Admin demo para permisos altos
  {
    email: 'admin@admin.com',
    username: 'adminDemo',
    role: 'admin',
    userPlan: 'team',
  },
  {
    email: 'free.demo@mail.com',
    username: 'freeDemo',
    role: 'user',
    userPlan: 'free',
  },
  {
    email: 'pro.demo@mail.com',
    username: 'proDemo',
    role: 'user',
    userPlan: 'pro',
  },
  {
    email: 'eva.front@demo.mail',
    username: 'evaFront',
    role: 'user',
    userPlan: 'pro',
  },
  {
    email: 'leo.back@demo.mail',
    username: 'leoBack',
    role: 'user',
    userPlan: 'pro',
  },
  {
    email: 'noa.qa@demo.mail',
    username: 'noaQa',
    role: 'user',
    userPlan: 'free',
  },
  {
    email: 'teo.devops@demo.mail',
    username: 'teoDevops',
    role: 'user',
    userPlan: 'pro',
  },
];
