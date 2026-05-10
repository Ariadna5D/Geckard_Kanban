import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios.instance';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useState } from 'react';
import { BrandMark } from '@/components/comons/BrandMark';

// Define los datos necesarios para iniciar sesion
interface LoginFormData {
  email: string;
  password: string;
}

  // Gestiona la pantalla de acceso del usuario
export const LoginPage = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();
  const navigate = useNavigate();
  const loginFn = useAuthStore((state) => state.login);

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Procesa envio de login y guarda sesion en store
  const onSubmit = async (loginData: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await api.post('/auth/login', {
        email: loginData.email,
        password: loginData.password,
      });

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

  // Alterna la visibilidad de la contrasena
  function handleTogglePasswordVisibility() {
    const nextVisibility = !showPassword;
    setShowPassword(nextVisibility);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 dark:bg-surface-950">
      <div className="w-full max-w-md rounded-xl border border-surface-200 bg-surface-50 p-8 text-surface-900 shadow-md dark:border-surface-800 dark:bg-surface-900 dark:text-surface-50">
        <div className="mb-6 flex justify-center">
          <BrandMark imgClassName="h-14 w-auto max-w-full sm:h-16" />
        </div>
        <h2 className="mb-6 text-center text-2xl font-bold text-primary-500 dark:text-surface-50">Iniciar sesión en Geckard</h2>

        {serverError && (
          <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input
                {...register('email', {
                  required: 'El email es obligatorio',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Email no válido' },
                })}
                type="email"
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-4 pl-10 text-surface-900 outline-none transition focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="usuario@correo.com"
              />
            </div>
            {errors.email && <span className="mt-1 block text-xs text-danger">{errors.email.message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input
                {...register('password', {
                  required: 'La contraseña es obligatoria',
                })}
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-12 pl-10 text-surface-900 outline-none transition focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={handleTogglePasswordVisibility}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-50"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="mt-1 block text-xs text-danger">{errors.password.message}</span>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary-600 py-2 px-4 font-bold text-white transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

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