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
} from 'lucide-react'; // Iconos estándar
import { useAuthStore } from '../store/useAuthStore';
import { useState } from 'react';
import api from '../api/axios.instance';
import { apiErrorMessage } from '../utils/apiErrorMessage';
// 1. Definimos el "contrato" de lo que vamos a enviar
interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function validateRegisterPasswordStrength(value: string): true | string {
  const ok = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,64}$/.test(value);
  return (
    ok ||
    'Debe incluir al menos 1 minúscula, 1 mayúscula y 1 carácter especial.'
  );
}

function buildConfirmPasswordValidator(password: string | undefined) {
  return (value: string) =>
    value === password || 'Las contraseñas no coinciden';
}

/**
 * RegisterPage: Este componente es la página de registro de usuarios.
 * Al enviar el formulario, hace una petición al backend para crear la cuenta.
 * Si el registro es exitoso, guarda el usuario y token en el estado global (Zustand) y redirige al dashboard.
 * Si hay un error (ej: email ya registrado), muestra el mensaje de error del backend.
 */
export const RegisterPage = () => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>();
  const navigate = useNavigate();
  const loginFn = useAuthStore((state) => state.login); //
  
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValue = watch('password');
  const pw = passwordValue ?? '';

  const hasMinLen = pw.length >= 8 && pw.length <= 64;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(pw);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // El backend solo espera { username, email, password }
      await api.post('/auth/register', {
        username: data.username,
        email: data.email,
        password: data.password,
      });
      
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

  function handleTogglePasswordVisibility() {
    setShowPassword((previous) => !previous);
  }

  function handleToggleConfirmPasswordVisibility() {
    setShowConfirmPassword((previous) => !previous);
  }

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
                  }
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

            {/* Feedback visual (checks) mientras el usuario escribe */}
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

          {/* CAMPO CONFIRMAR PASSWORD */}
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