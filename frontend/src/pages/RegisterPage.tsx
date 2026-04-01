import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock } from 'lucide-react'; // Iconos estándar
import { useAuthStore } from '../store/useAuthStore';
import { useState } from 'react';
import api from '../api/axios.instance';
import { apiErrorMessage } from '../utils/apiErrorMessage';
// 1. Definimos el "contrato" de lo que vamos a enviar
interface RegisterFormData {
  username: string;
  email: string;
  password: string;
}

/**
 * RegisterPage: Este componente es la página de registro de usuarios.
 * Al enviar el formulario, hace una petición al backend para crear la cuenta.
 * Si el registro es exitoso, guarda el usuario y token en el estado global (Zustand) y redirige al dashboard.
 * Si hay un error (ej: email ya registrado), muestra el mensaje de error del backend.
 */
export const RegisterPage = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>();
  const navigate = useNavigate();
  const loginFn = useAuthStore((state) => state.login); //
  
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      await api.post('/auth/register', data);
      
      const loginResponse = await api.post('/auth/login', {
        email: data.email,
        password: data.password
      });
      
      loginFn(loginResponse.data.user, loginResponse.data.access_token);
      
      navigate('/dashboard');
    } catch (error: unknown) {
      setServerError(apiErrorMessage(error, 'Error en el proceso'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 dark:bg-surface-950">
      <div className="w-full max-w-md rounded-xl border border-surface-200 bg-surface-50 p-8 text-surface-900 shadow-md dark:border-surface-800 dark:bg-surface-900 dark:text-surface-50">
        <h2 className="mb-6 text-center text-2xl font-bold text-surface-900 dark:text-surface-50">Crear Cuenta</h2>

        {serverError && (
          <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
            {serverError}
          </div>
        )}

        {/* Usamos handleSubmit de react-hook-form para manejar el submit del formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* CAMPO USERNAME */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre de usuario</label>
            <div className="relative">
              <User className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input 
                {...register('username', { 
                  required: 'El nombre es obligatorio',
                  minLength: { value: 3, message: 'Mínimo 3 caracteres' }
                })}
                type="text" 
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-4 pl-10 text-surface-900 focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="Ej: NinjaKanban"
              />
            </div>
            {errors.username && <span className="text-xs text-danger">{errors.username.message}</span>}
          </div>

          {/* CAMPO EMAIL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input 
                {...register('email', { 
                  required: 'El email es obligatorio',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Email no válido' }
                })}
                type="email" 
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-4 pl-10 text-surface-900 focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="correo@ejemplo.com"
              />
            </div>
            {errors.email && <span className="text-xs text-danger">{errors.email.message}</span>}
          </div>

          {/* CAMPO PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input 
                {...register('password', { 
                  required: 'La contraseña es obligatoria',
                  minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                })}
                type="password" 
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-4 pl-10 text-surface-900 focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="******"
              />
            </div>
            {errors.password && <span className="text-xs text-danger">{errors.password.message}</span>}
          </div>

          {/* BOTÓN SUBMIT */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full rounded-lg bg-primary-600 py-2 px-4 font-bold text-white transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
          >
            {isLoading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>

        {/* ENLACE PARA IR AL LOGIN */}
        <p className="mt-6 text-center text-sm text-surface-600 dark:text-surface-400">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
};