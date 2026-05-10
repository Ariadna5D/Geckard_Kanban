import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useState } from 'react';
import api from '../api/axios.instance';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { BrandMark } from '@/components/comons/BrandMark';

// Define los datos necesarios para registrar una cuenta
interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Gestiona el registro de usuario desde la interfaz
export const RegisterPage = () => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>();
  const navigate = useNavigate();
  const loginFn = useAuthStore((state) => state.login);

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValue = watch('password');
  const normalizedPasswordValue = passwordValue ?? '';

  const hasMinLen =
    normalizedPasswordValue.length >= 8 && normalizedPasswordValue.length <= 64;
  const hasLower = /[a-z]/.test(normalizedPasswordValue);
  const hasUpper = /[A-Z]/.test(normalizedPasswordValue);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(normalizedPasswordValue);

  // Crea cuenta y hace login automatico al terminar
  const onSubmit = async (registerData: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      await api.post('/auth/register', {
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
      });

      // Segundo paso: pedimos token para entrar directo al dashboard
      const loginResponse = await api.post('/auth/login', {
        email: registerData.email,
        password: registerData.password,
      });

      loginFn(loginResponse.data.user, loginResponse.data.access_token);

      navigate('/dashboard');
    } catch (error: unknown) {
      setServerError(apiErrorMessage(error, 'No se pudo crear la cuenta.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Alterna la visibilidad de la contrasena principal
  function handleTogglePasswordVisibility() {
    const nextVisibility = !showPassword;
    setShowPassword(nextVisibility);
  }

  // Alterna la visibilidad de la confirmacion de contrasena
  function handleToggleConfirmPasswordVisibility() {
    const nextVisibility = !showConfirmPassword;
    setShowConfirmPassword(nextVisibility);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 dark:bg-surface-950">
      <div className="w-full max-w-md rounded-xl border border-surface-200 bg-surface-50 p-8 text-surface-900 shadow-md dark:border-surface-800 dark:bg-surface-900 dark:text-surface-50">
        <div className="mb-6 flex justify-center">
          <BrandMark imgClassName="h-14 w-auto max-w-full sm:h-16" />
        </div>
        <h2 className="mb-6 text-center text-2xl font-bold text-primary-500 dark:text-surface-50">Crear cuenta en Geckard</h2>

        {serverError && (
          <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre de usuario</label>
            <div className="relative">
              <User className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input
                {...register('username', {
                  required: 'El nombre es obligatorio',
                  minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                })}
                type="text"
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-4 pl-10 text-surface-900 focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="usuario"
              />
            </div>
            {errors.username && <span className="text-xs text-danger">{errors.username.message}</span>}
          </div>

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
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-4 pl-10 text-surface-900 focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="usuario@correo.com"
              />
            </div>
            {errors.email && <span className="text-xs text-danger">{errors.email.message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input
                {...register('password', {
                  required: 'La contraseña es obligatoria',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                  maxLength: { value: 64, message: 'Máximo 64 caracteres' },
                  validate: (value) => {
                    const ok =
                      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,64}$/.test(
                        value,
                      );
                    return (
                      ok ||
                      'Debe incluir al menos 1 minúscula, 1 mayúscula y 1 carácter especial.'
                    );
                  },
                })}
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-12 pl-10 text-surface-900 focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="******"
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
            {errors.password && <span className="text-xs text-danger">{errors.password.message}</span>}

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {hasMinLen ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <XCircle size={16} className="text-danger" />
                )}
                <span>8-64 caracteres</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {hasLower ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <XCircle size={16} className="text-danger" />
                )}
                <span>1 minúscula</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {hasUpper ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <XCircle size={16} className="text-danger" />
                )}
                <span>1 mayúscula</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {hasSpecial ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <XCircle size={16} className="text-danger" />
                )}
                <span>1 carácter especial</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Confirmar contraseña</label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-400" size={18} />
              <input
                {...register('confirmPassword', {
                  required: 'Debes confirmar la contraseña',
                  validate: (value) =>
                    value === passwordValue || 'Las contraseñas no coinciden',
                })}
                type={showConfirmPassword ? 'text' : 'password'}
                className="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-12 pl-10 text-surface-900 focus:ring-2 focus:ring-primary-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={handleToggleConfirmPasswordVisibility}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-50"
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="text-xs text-danger">{errors.confirmPassword.message}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary-600 py-2 px-4 font-bold text-white transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
          >
            {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-surface-600 dark:text-surface-400">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
};