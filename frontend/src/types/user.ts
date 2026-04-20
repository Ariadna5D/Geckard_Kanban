export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  userPlan?: 'free' | 'pro' | 'team';
  /** Cliente Stripe (tras un pago); sirve para abrir el Customer Portal. */
  stripeCustomerId?: string | null;
  /** Suscripción activa en Stripe (si existe). */
  stripeSubscriptionId?: string | null;
  experiencePoints: number;
  avatarUrl?: string; 
  bio?: string;       
}