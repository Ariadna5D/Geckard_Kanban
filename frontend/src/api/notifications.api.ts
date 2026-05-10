import api from './axios.instance';
import type { NotificationItem } from '@/types/notification.types';

type UnreadCountResponse = number | { count: number };

export const getNotificationsRequest = async (
  limit = 40,
): Promise<NotificationItem[]> => {
  // Trae bandeja de notificaciones con limite configurable
  const response = await api.get<NotificationItem[]>('/notifications', {
    params: { limit },
  });
  return response.data;
};

export const getUnreadNotificationsCountRequest = async (): Promise<number> => {
  // Soporta respuesta numero simple o objeto con count
  const response = await api.get<UnreadCountResponse>('/notifications/unread-count');
  if (typeof response.data === 'number') {
    return response.data;
  }

  const countFromObject = response.data.count;
  return countFromObject;
};

export const markNotificationReadRequest = async (
  notificationId: string,
): Promise<void> => {
  // Marca notificacion como leida para bajar badge en ui
  await api.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
};

export const acceptBoardInviteNotificationRequest = async (
  notificationId: string,
): Promise<void> => {
  // Acepta invitacion y deja que backend ajuste membresia
  await api.post(`/notifications/${encodeURIComponent(notificationId)}/accept`);
};

export const rejectBoardInviteNotificationRequest = async (
  notificationId: string,
): Promise<void> => {
  // Rechaza invitacion para cerrar la accion pendiente
  await api.post(`/notifications/${encodeURIComponent(notificationId)}/reject`);
};
