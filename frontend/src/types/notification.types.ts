import type { BoardInviteRole } from './board.types';

export type NotificationType = 'board_invite';
export type NotificationStatus = 'pending' | 'accepted' | 'rejected';

export interface NotificationBoardInvitePayload {
  boardId: string;
  boardTitle: string;
  boardSlug: string;
  role: BoardInviteRole;
}

export interface NotificationItem {
  _id: string;
  recipientUserId: string;
  actorUserId: string;
  actorEmail: string;
  actorUsername?: string;
  actorAvatarUrl?: string;
  type: NotificationType;
  status: NotificationStatus;
  isRead: boolean;
  readAt?: string;
  resolvedAt?: string;
  title: string;
  message: string;
  boardInvite: NotificationBoardInvitePayload;
  createdAt: string;
  updatedAt: string;
}
