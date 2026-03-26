import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock } from 'lucide-react'; // Iconos estándar
import { useAuthStore } from '../store/useAuthStore';
import axios from 'axios';
import { useState } from 'react';

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

  // Función que se ejecuta al enviar el formulario
  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // Hacemos la petición al backend para registrar el usuario
      const response = await axios.post('http://localhost:3000/api/auth/register', data);
      
      // Si el registro es exitoso, guardamos el usuario y token en el estado global
      loginFn(response.data.user, response.data.access_token);
      
      // Y mandamos al usuario al Kanban
      navigate('/dashboard');
    } catch (error: any) {
      
      // Si NestJS nos rechaza (ej: email repetido), mostramos su mensaje
      setServerError(error.response?.data?.message || 'Error al registrar el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-primary-600">Crear Cuenta</h2>

        {serverError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {serverError}
          </div>
        )}

        {/* Usamos handleSubmit de react-hook-form para manejar el submit del formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* CAMPO USERNAME */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                {...register('username', { 
                  required: 'El nombre es obligatorio',
                  minLength: { value: 3, message: 'Mínimo 3 caracteres' }
                })}
                type="text" 
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: NinjaKanban"
              />
            </div>
            {errors.username && <span className="text-red-500 text-xs">{errors.username.message}</span>}
          </div>

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
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="correo@ejemplo.com"
              />
            </div>
            {errors.email && <span className="text-red-500 text-xs">{errors.email.message}</span>}
          </div>

          {/* CAMPO PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                {...register('password', { 
                  required: 'La contraseña es obligatoria',
                  minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                })}
                type="password" 
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="******"
              />
            </div>
            {errors.password && <span className="text-red-500 text-xs">{errors.password.message}</span>}
          </div>

          {/* BOTÓN SUBMIT */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            {isLoading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>

        {/* ENLACE PARA IR AL LOGIN */}
        <p className="text-center mt-6 text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-semibold hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
};