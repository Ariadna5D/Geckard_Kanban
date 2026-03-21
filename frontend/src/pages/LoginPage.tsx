import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react'; // Añadimos los iconos para mantener la consistencia
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios.instance'; // Asumo que tienes tu instancia de axios configurada
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
    } catch (error: any) {
      // Adiós al alert(). Capturamos el mensaje del backend o ponemos uno genérico
      setServerError(error.response?.data?.message || 'Correo o contraseña incorrectos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-primary-600">Acceder a Kanban</h2>

        {/* CAJA DE ERROR DEL SERVIDOR */}
        {serverError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* CAMPO EMAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                {...register('email', { 
                  required: 'El email es obligatorio',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Email no válido' }
                })}
                type="email" 
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                placeholder="correo@ejemplo.com"
              />
            </div>
            {errors.email && <span className="text-red-500 text-xs mt-1 block">{errors.email.message}</span>}
          </div>

          {/* CAMPO PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                {...register('password', { 
                  required: 'La contraseña es obligatoria' 
                })}
                type="password" 
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>
            {errors.password && <span className="text-red-500 text-xs mt-1 block">{errors.password.message}</span>}
          </div>

          {/* BOTÓN SUBMIT */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Entrar al Sistema'}
          </button>
        </form>

        {/* ENLACE PARA IR AL REGISTRO */}
        <p className="text-center mt-6 text-sm text-gray-600">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-800 font-semibold hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
};