import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios.instance';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProfileFormData {
  username: string;
  bio: string;
}

export const ProfileForm = () => {
  const { user, updateUser } = useAuthStore();
  console.log('USUARIO EN ZUSTAND:', user);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>({
    defaultValues: {
      username: '',
      bio: '',
    }
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // El useEffect mágico que rellena todo en cuanto detecta al usuario
  useEffect(() => {
    if (user) {
      reset({
        username: user.username || '',
        bio: user.bio || '',
      });
      if (user.avatarUrl) {
        setPreviewUrl(user.avatarUrl);
      }
    }
  }, [user, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('username', data.username);
      formData.append('bio', data.bio);
      
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await api.patch('/users/me', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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

  return (
    <Card className="max-w-xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Tu Perfil</CardTitle>
        {/* AÑADE ESTO TEMPORALMENTE */}
        <pre className="bg-slate-800 text-green-400 p-4 text-xs overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
        <CardDescription>Actualiza tu foto y tus datos públicos.</CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="w-32 h-32 border-4 border-primary-50">
                <AvatarImage src={previewUrl || ''} alt="Avatar" className="object-cover" />
                <AvatarFallback className="text-4xl bg-primary-100 text-primary-700">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition shadow-lg"
              >
                <Camera size={20} />
              </button>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp" 
              />
            </div>
            <p className="text-xs text-slate-500">JPG, PNG o WEBP. Máx 5MB.</p>
          </div>

          {message && (
            <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de usuario</Label>
              <Input 
                id="username" 
                {...register('username', { required: 'El nombre es obligatorio' })} 
              />
              {errors.username && <span className="text-red-500 text-xs">{errors.username.message}</span>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografía (opcional)</Label>
              <Input 
                id="bio" 
                placeholder="Cuéntanos sobre ti..." 
                {...register('bio')} 
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Guardando cambios...' : 'Guardar perfil'}
          </Button>

        </form>
      </CardContent>
    </Card>
  );
};