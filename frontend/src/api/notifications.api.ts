import api from './axios.instance';
import type { NotificationItem } from '@/types/notification.types';

export const getNotificationsRequest = async (
  limit = 40,
): Promise<NotificationItem[]> => {
  const response = await api.get<NotificationItem[]>('/notifications', {
    params: { limit },
  });
  return response.data;
};

export const getUnreadNotificationsCountRequest = async (): Promise<number> => {
  const response = await api.get<number | { count: number }>(
    '/notifications/unread-count',
  );
  if (typeof response.data === 'number') {
    return response.data;
  }
  return response.data.count;
};

export const markNotificationReadRequest = async (
  notificationId: string,
): Promise<void> => {
  await api.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
};

export const acceptBoardInviteNotificationRequest = async (
  notificationId: string,
): Promise<void> => {
  await api.post(`/notifications/${encodeURIComponent(notificationId)}/accept`);
};

export const rejectBoardInviteNotificationRequest = async (
  notificationId: string,
): Promise<void> => {
  await api.post(`/notifications/${encodeURIComponent(notificationId)}/reject`);
};
