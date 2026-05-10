import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios.instance';
import { apiErrorMessage } from '@/utils/apiErrorMessage';
import { createCustomerPortalSessionRequest } from '@/api/billing.api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  userAvatarFallbackClass,
} from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProfileFormData {
  username: string;
  bio: string;
}

// Permite actualizar el perfil y la suscripcion
export const ProfileForm = () => {
  const { user, updateUser, logout, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>({
    defaultValues: { username: '', bio: '' }
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.trim().charAt(0).toUpperCase() || 'U';
  };

  const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
  const CLIENT_UPLOAD_TARGET_BYTES = 900 * 1024;
  const AVATAR_SIZE = 400;

  const canvasToBlob = (
    canvas: HTMLCanvasElement,
    mime: string,
    quality: number,
  ) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blobValue) => resolve(blobValue),
        mime,
        quality,
      );
    });

  const compressImageForUpload = async (file: File): Promise<File> => {
    // Evita subir archivos grandes al proxy optimizando siempre la imagen
    if (file.size <= CLIENT_UPLOAD_TARGET_BYTES) return file;

    let source: ImageBitmap | HTMLImageElement;
    try {
      source = await createImageBitmap(file);
    } catch {
      const url = URL.createObjectURL(file);
      try {
        source = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to decode image'));
          img.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    const imgW = source.width;
    const imgH = source.height;
    const srcAspect = imgW / imgH;
    const targetAspect = 1;

    let sx = 0;
    let sy = 0;
    let sw = imgW;
    let sh = imgH;

    if (srcAspect > targetAspect) {
      sw = imgH;
      sh = imgH;
      sx = (imgW - sw) / 2;
      sy = 0;
    } else {
      sw = imgW;
      sh = imgW;
      sx = 0;
      sy = (imgH - sh) / 2;
    }

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const targetName = `${baseName}.jpg`;

    const qualitySteps = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
    for (const qualityValue of qualitySteps) {
      // Probamos varias calidades hasta entrar en el limite objetivo de cliente
      const blob = await canvasToBlob(canvas, 'image/jpeg', qualityValue);
      if (!blob) continue;
      if (blob.size <= CLIENT_UPLOAD_TARGET_BYTES) {
        return new File([blob], targetName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }
    }

    const finalBlob = await canvasToBlob(canvas, 'image/jpeg', 0.4);
    if (!finalBlob) return file;
    return new File([finalBlob], targetName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  };

  useEffect(() => {
    // Sincroniza formulario cuando cambian datos del usuario en store
    if (user) {
      reset({ username: user.username || '', bio: user.bio || '' });
      setPreviewUrl(user.avatarUrl || null);
      setRemoveAvatar(false);
    }
  }, [user, reset]);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor, sube solo archivos de imagen.' });
      return;
    }

    try {
      const normalized = await compressImageForUpload(file);
      if (normalized.size > MAX_AVATAR_BYTES) {
        setMessage({
          type: 'error',
          text: 'La imagen supera 5MB y no se pudo reducir lo suficiente. Intenta con otra.',
        });
        setSelectedFile(null);
        return;
      }
      if (normalized.size > CLIENT_UPLOAD_TARGET_BYTES) {
        setMessage({
          type: 'error',
          text: 'La imagen sigue siendo pesada para la subida. Prueba con otra imagen más ligera.',
        });
        setSelectedFile(null);
        return;
      } else {
        setMessage(null);
      }
      setRemoveAvatar(false);
      setSelectedFile(normalized);
      // Preview local para ver el avatar antes de guardar en back
      setPreviewUrl(URL.createObjectURL(normalized));
    } catch {
      setMessage({ type: 'error', text: 'No se pudo preparar la imagen para subir. Intenta con otra.' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const onSubmit = async (profileData: ProfileFormData) => {
    setIsLoading(true);
    setMessage(null);

    try {
      // Multipart para enviar texto y archivo en una sola petciion
      const formData = new FormData();
      formData.append('username', profileData.username);
      formData.append('bio', profileData.bio);
      if (selectedFile) formData.append('file', selectedFile);
      if (removeAvatar && !selectedFile) {
        formData.append('avatarUrl', '');
      }

      const response = await api.patch('/users/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser(response.data);
      setSelectedFile(null);
      setRemoveAvatar(false);
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
    } catch (error: unknown) {
      setMessage({ 
        type: 'error', 
        text: apiErrorMessage(error, 'Error al actualizar el perfil'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.delete('/users/me');
      logout();
      navigate('/login');
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: apiErrorMessage(error, 'Error al eliminar la cuenta'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  function handleAvatarZoneClick() {
    fileInputRef.current?.click();
  }

  function handleRemoveAvatar() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
    setMessage(null);
  }

  let planLabel: 'free' | 'pro' | 'team' = 'free';
  if (user?.userPlan === 'pro' || user?.userPlan === 'team') {
    planLabel = user.userPlan;
  }
  const hasStripeCustomer =
    user?.stripeCustomerId !== undefined &&
    user?.stripeCustomerId !== null &&
    user.stripeCustomerId.trim() !== '';
  const hasActiveSubscription =
    user?.stripeSubscriptionId !== undefined &&
    user?.stripeSubscriptionId !== null &&
    user.stripeSubscriptionId.trim() !== '';

  async function handleOpenStripePortal() {
    setIsPortalLoading(true);
    setMessage(null);
    try {
      // El backend devuelve url de portal y redirigimos al instante
      const { url } = await createCustomerPortalSessionRequest();
      window.location.href = url;
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: apiErrorMessage(
          error,
          'No se pudo abrir el portal de Stripe. Revisa STRIPE_PORTAL_RETURN_URL y la configuración del portal en Stripe.',
        ),
      });
    } finally {
      setIsPortalLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-xl space-y-6">
    <Card className="border border-surface-200 bg-surface-50 shadow-sm ring-1 ring-surface-200/70 dark:border-surface-800 dark:bg-surface-900 dark:ring-surface-800/80">
      <CardHeader>
        <CardTitle>Tu Perfil</CardTitle>
        <CardDescription>Actualiza tu foto y tus datos públicos.</CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleAvatarZoneClick}
            className={`group/avatar-zone relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors
              ${isDragging ? 'border-primary-500 bg-primary-500/10 dark:border-primary-400 dark:bg-primary-500/15' : 'border-surface-300 hover:border-primary-500/45 hover:bg-primary-500/10 dark:border-surface-600 dark:hover:border-primary-400/40 dark:hover:bg-primary-500/10'}`}
          >
            <Avatar className="size-32 border-4 border-background shadow-sm mb-4">
              <AvatarImage src={previewUrl || ''} alt="Avatar" className="object-cover" />
              <AvatarFallback
                className={`${userAvatarFallbackClass} text-[2.5rem] font-bold leading-none uppercase`}
              >
                {getInitials(user?.username || '')}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex items-center gap-2 text-sm font-medium text-surface-800 transition-colors group-hover/avatar-zone:text-primary-700 dark:text-surface-200 dark:group-hover/avatar-zone:text-primary-300">
              <UploadCloud size={18} className="text-surface-500 transition-colors group-hover/avatar-zone:text-primary-600 dark:text-surface-400 dark:group-hover/avatar-zone:text-primary-400" />
              <span>Haz clic o arrastra tu foto aquí</span>
            </div>
            <p className="mt-1 text-xs text-warning dark:text-warning">JPG, PNG o WEBP. Máximo 5MB.</p>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/png, image/jpeg, image/webp" 
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRemoveAvatar}
            disabled={isLoading || isDeleting || (!previewUrl && !selectedFile)}
            className="w-full"
          >
            Quitar foto
          </Button>

          {message && (
            <div className={`rounded p-3 text-sm ${message.type === 'success' ? 'bg-success/15 text-success' : 'bg-danger/10 text-danger'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de usuario</Label>
              <Input id="username" {...register('username', { required: 'El nombre es obligatorio' })} />
              {errors.username && <span className="text-xs text-danger">{errors.username.message}</span>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografía (opcional)</Label>
              <Input id="bio" placeholder="Cuéntanos sobre ti..." {...register('bio')} />
            </div>
          </div>

          <Button type="submit" disabled={isLoading || isDeleting} className="w-full">
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isLoading ? 'Guardando cambios...' : 'Guardar cambios'}
          </Button>
        </form>

        <div className="mt-8 border-t border-danger/25 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-semibold text-danger">Eliminar cuenta</h3>
              <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">Elimina tu cuenta y todos tus datos permanentemente.</p>
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="destructive" 
                  disabled={isDeleting || isLoading}
                  className="w-full sm:w-auto"
                >
                  {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                  {isDeleting ? 'Eliminando...' : 'Eliminar cuenta'}
                </Button>
              </AlertDialogTrigger>
              
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará tu cuenta, tus tableros y todos tus datos de nuestros servidores de forma permanente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount}
                    className="bg-danger text-white hover:bg-danger/90 focus-visible:ring-2 focus-visible:ring-danger/50"
                  >
                    Sí, eliminar mi cuenta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
          </div>
        </div>

      </CardContent>
    </Card>

    <Card className="border border-surface-200 bg-surface-50 shadow-sm ring-1 ring-surface-200/70 dark:border-surface-800 dark:bg-surface-900 dark:ring-surface-800/80">
      <CardHeader>
        <CardTitle>Suscripción</CardTitle>
        <CardDescription>
          Plan actual y gestión subscripción.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-surface-700 dark:text-surface-300">
          <p>
            <span className="font-medium text-surface-900 dark:text-surface-100">
              Plan:
            </span>{' '}
            <span className="capitalize">{planLabel}</span>
          </p>
          <p className="mt-1">
            <span className="font-medium text-surface-900 dark:text-surface-100">
              Suscripción Stripe:
            </span>{' '}
            {hasActiveSubscription ? 'Activa' : 'Sin suscripción activa'}
          </p>
          {hasActiveSubscription && user?.stripeSubscriptionId ? (
            <p className="mt-1 break-all font-mono text-xs text-surface-500 dark:text-surface-400">
              {user.stripeSubscriptionId}
            </p>
          ) : null}
        </div>
        {hasStripeCustomer ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full flex-1"
              disabled={isPortalLoading || isLoading || isDeleting}
              onClick={() => {
                void handleOpenStripePortal();
              }}
            >
              {isPortalLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 size-4" />
              )}
              {isPortalLoading ? 'Abriendo portal...' : 'Abrir portal de Stripe'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full flex-1"
              disabled={isPortalLoading || isLoading || isDeleting}
              onClick={() => {
                void fetchUser();
              }}
            >
              Actualizar estado
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              navigate('/billing/plans');
            }}
          >
            Ver planes y contratar
          </Button>
        )}
      </CardContent>
    </Card>
    </div>
  );
};