import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'; // Iconos para mostrar/ocultar contraseña
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios.instance';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useState } from 'react';

// 1. Contrato estricto para el Login
interface LoginFormData {
  email: string;
  password: string;
}

export const LoginPage = () => {
  // 2. Extraemos 'errors' de formState para pintar los mensajes en rojo
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();
  const navigate = useNavigate();
  const loginFn = useAuthStore((state) => state.login);

  // 3. Estados locales para manejar la UI
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null); // Limpiamos errores anteriores antes de reintentar

    try {
      const response = await api.post('/auth/login', {
        email: data.email,
        password: data.password
      });

      // Guardamos en Zustand y pa'dentro
      loginFn(response.data.user, response.data.access_token);
      navigate('/dashboard');
    } catch (error: unknown) {
      setServerError(
        apiErrorMessage(error, 'Correo o contraseña incorrectos'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 dark:bg-surface-950">
      <div className="w-full max-w-md rounded-xl border border-surface-200 bg-surface-50 p-8 text-surface-900 shadow-md dark:border-surface-800 dark:bg-surface-900 dark:text-surface-50">
        <h2 className="mb-6 text-center text-2xl font-bold text-surface-900 dark:text-surface-50">Acceder a AxiUp</h2>

        {/* CAJA DE ERROR DEL SERVIDOR */}
        {serverError && (
          <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
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
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-4 pl-10 text-surface-900 outline-none transition focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="correo@ejemplo.com"
              />
            </div>
            {errors.email && <span className="mt-1 block text-xs text-danger">{errors.email.message}</span>}
          </div>

          {/* CAMPO PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input 
                {...register('password', { 
                  required: 'La contraseña es obligatoria' 
                })}
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-12 pl-10 text-surface-900 outline-none transition focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-50"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="mt-1 block text-xs text-danger">{errors.password.message}</span>}
          </div>

          {/* BOTÓN SUBMIT */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full rounded-lg bg-primary-600 py-2 px-4 font-bold text-white transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
          >
            {isLoading ? 'Entrando...' : 'Entrar al Sistema'}
          </button>
        </form>

        {/* ENLACE PARA IR AL REGISTRO */}
        <p className="mt-6 text-center text-sm text-surface-600 dark:text-surface-400">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
};