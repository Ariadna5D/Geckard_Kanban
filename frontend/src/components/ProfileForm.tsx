import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Loader2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios.instance';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Importamos las piezas del AlertDialog de shadcn
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

export const ProfileForm = () => {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>({
    defaultValues: { username: '', bio: '' }
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const matches = name.match(/[A-Z]/g);
    if (matches && matches.length >= 2) {
      return `${matches[0]}${matches[1]}`;
    }
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (user) {
      reset({ username: user.username || '', bio: user.bio || '' });
      setPreviewUrl(user.avatarUrl || null);
    }
  }, [user, reset]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor, sube solo archivos de imagen.' });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
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
    if (file) processFile(file);
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('username', data.username);
      formData.append('bio', data.bio);
      if (selectedFile) formData.append('file', selectedFile);

      const response = await api.patch('/users/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser(response.data);
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al actualizar el perfil' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Lógica para borrar cuenta limpia, sin el window.confirm nativo
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.delete('/users/me');
      logout();
      navigate('/login');
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al eliminar la cuenta' 
      });
      setIsDeleting(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto mt-8">
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
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors
              ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:bg-slate-50'}`}
          >
            <Avatar className="w-32 h-32 border-4 border-white shadow-sm mb-4">
              <AvatarImage src={previewUrl || ''} alt="Avatar" className="object-cover" />
              {/* MEJORA: Usamos la función de iniciales y le damos un toque formal (gris/azulado) */}
              <AvatarFallback className="text-4xl font-semibold bg-slate-800 text-white tracking-wider">
                {getInitials(user?.username || '')}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <UploadCloud size={18} className="text-primary-600" />
              <span>Haz clic o arrastra tu foto aquí</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">JPG, PNG o WEBP. Máximo 5MB.</p>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/png, image/jpeg, image/webp" 
            />
          </div>

          {message && (
            <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de usuario</Label>
              <Input id="username" {...register('username', { required: 'El nombre es obligatorio' })} />
              {errors.username && <span className="text-red-500 text-xs">{errors.username.message}</span>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografía (opcional)</Label>
              <Input id="bio" placeholder="Cuéntanos sobre ti..." {...register('bio')} />
            </div>
          </div>

          <Button type="submit" disabled={isLoading || isDeleting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Guardando cambios...' : 'Guardar perfil'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-red-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-surface-600 font-semibold text-sm">Eliminar Cuenta</h3>
              <p className="text-xs text-slate-500 mt-1">Elimina tu cuenta y todos tus datos permanentemente.</p>
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="destructive" 
                  disabled={isDeleting || isLoading}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  {isDeleting ? 'Eliminando...' : 'Eliminar cuenta'}
                </Button>
              </AlertDialogTrigger>
              
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará tu cuenta, tus puntos de experiencia y todos tus datos de nuestros servidores de forma permanente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount}
                    className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
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
  );
};