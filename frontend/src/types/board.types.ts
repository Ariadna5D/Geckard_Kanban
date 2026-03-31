export type BoardRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface BoardMember {
  user: string; 
  role: BoardRole;
}

export interface BoardColumn {
  _id: string;
  title: string;
  tasks: any[]; 
}

// 3. Interfaz principal del Tablero
export interface Board {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  owner: string;
  members: BoardMember[]; // Añadido para que coincida con tu Schema de Mongo
  columns: BoardColumn[];
  createdAt: string;
  updatedAt: string;
}

// Payload para la creación (lo que enviamos al POST)
export interface CreateBoardPayload {
  title: string;
  description?: string;
}