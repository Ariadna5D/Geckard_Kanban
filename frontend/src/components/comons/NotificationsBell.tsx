import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  acceptBoardInviteNotificationRequest,
  getNotificationsRequest,
  markNotificationReadRequest,
  rejectBoardInviteNotificationRequest,
} from '@/api/notifications.api';
import type { NotificationItem } from '@/types/notification.types';
import { apiErrorMessage } from '@/utils/apiErrorMessage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/useAuthStore';

const NOTIFICATIONS_FETCH_LIMIT = 30;

function notificationsSocketBaseUrl(): string {
  const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!configuredBase || configuredBase.trim() === '' || configuredBase === '/api') {
    return window.location.origin;
  }
  const normalized = configuredBase.replace(/\/+$/, '');
  if (normalized.endsWith('/api')) {
    return normalized.slice(0, -4);
  }
  return normalized;
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initialsFromUser(username?: string, email?: string): string {
  const source = username && username.trim() !== '' ? username : email ?? 'U';
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getNotificationsRequest(NOTIFICATIONS_FETCH_LIMIT);
      setItems(rows);
    } catch (errorObject) {
      setError(
        apiErrorMessage(errorObject, 'No se pudieron cargar las notificaciones.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const refreshTimer = window.setInterval(() => {
      void loadNotifications();
    }, 20_000);
    return () => window.clearInterval(refreshTimer);
  }, [open, loadNotifications]);

  useEffect(() => {
    if (!token) return undefined;
    const socket: Socket = io(`${notificationsSocketBaseUrl()}/notifications`, {
      auth: { token },
      withCredentials: true,
    });
    socket.on('notifications:changed', () => {
      void loadNotifications();
    });
    return () => {
      socket.disconnect();
    };
  }, [token, loadNotifications]);

  async function handleMarkAsRead(notificationId: string) {
    try {
      await markNotificationReadRequest(notificationId);
      setItems((current) =>
        current.map((item) =>
          item._id === notificationId
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch {
      // Silent: no interrumpimos interacción por un tap rápido.
    }
  }

  async function handleAccept(notification: NotificationItem) {
    setActingOnId(notification._id);
    setError(null);
    try {
      await acceptBoardInviteNotificationRequest(notification._id);
      setItems((current) =>
        current.map((item) =>
          item._id === notification._id
            ? {
                ...item,
                status: 'accepted',
                isRead: true,
                resolvedAt: new Date().toISOString(),
                readAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      navigate(`/boards/${notification.boardInvite.boardSlug}`);
    } catch (errorObject) {
      setError(apiErrorMessage(errorObject, 'No se pudo aceptar la invitación.'));
    } finally {
      setActingOnId(null);
    }
  }

  async function handleReject(notification: NotificationItem) {
    setActingOnId(notification._id);
    setError(null);
    try {
      await rejectBoardInviteNotificationRequest(notification._id);
      setItems((current) =>
        current.map((item) =>
          item._id === notification._id
            ? {
                ...item,
                status: 'rejected',
                isRead: true,
                resolvedAt: new Date().toISOString(),
                readAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    } catch (errorObject) {
      setError(apiErrorMessage(errorObject, 'No se pudo rechazar la invitación.'));
    } finally {
      setActingOnId(null);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Abrir notificaciones"
          className="relative h-11 w-11 rounded-xl border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notificaciones</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="p-3 text-sm text-destructive">{error}</div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No tienes notificaciones.
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="max-h-[26rem] overflow-y-auto p-2">
            {items.map((notification) => {
              const pendingInvite =
                notification.type === 'board_invite' &&
                notification.status === 'pending';
              return (
                <div
                  key={notification._id}
                  className={`mb-2 rounded-lg border p-2 last:mb-0 ${
                    notification.isRead
                      ? 'border-border bg-background'
                      : 'border-primary/25 bg-primary/5'
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (!notification.isRead) {
                        void handleMarkAsRead(notification._id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <Avatar className="size-8">
                        <AvatarImage
                          src={notification.actorAvatarUrl ?? ''}
                          alt={notification.actorUsername ?? notification.actorEmail}
                        />
                        <AvatarFallback className="text-[11px]">
                          {initialsFromUser(
                            notification.actorUsername,
                            notification.actorEmail,
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatNotificationTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>

                  {pendingInvite ? (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actingOnId === notification._id}
                        onClick={() => {
                          void handleReject(notification);
                        }}
                      >
                        <X className="size-3.5" />
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        disabled={actingOnId === notification._id}
                        onClick={() => {
                          void handleAccept(notification);
                        }}
                      >
                        {actingOnId === notification._id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        Aceptar
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
