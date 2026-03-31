export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  _id: string;
  title: string;
  description: string;
  boardId: string;
  columnId: string;
  order: number;
  priority: TaskPriority;
  storyPoints?: number;
  dueDate?: string;
  assigneeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  _id: string;
  title: string;
  tasks?: Task[]; 
}

export interface BoardMember {
  user: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface Board {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  owner: string;
  members: BoardMember[];
  columns: Column[];
  createdAt: string;
  updatedAt: string;
}

// --- DTOs del Frontend ---

export interface CreateTaskPayload {
  title: string;
  boardId: string;
  columnId: string;
}

export interface UpdateTaskPositionPayload {
  newColumnId: string;
  prevTaskOrder: number | null;
  nextTaskOrder: number | null;
}

export interface CreateBoardPayload {
  title: string;
  description?: string;
}