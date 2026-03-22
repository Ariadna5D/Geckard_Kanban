export interface ValidatedUser {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  experiencePoints: number;
}