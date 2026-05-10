// Datos de usuario que usamos en sesion y perfil
export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  userPlan?: 'free' | 'pro' | 'team';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  experiencePoints: number;
  avatarUrl?: string;
  bio?: string;
}