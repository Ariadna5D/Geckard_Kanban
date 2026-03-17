import { useForm } from 'react-hook-form';
import api from '../api/axios.instance';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export const LoginPage = () => {
  const { register, handleSubmit } = useForm();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleFormSubmit = async (data: any) => {
    try {
      const response = await api.post('/auth/login', {
        email: data.email,
        password: data.password
        });

      // Guardamos en Zustand
      login(response.data.user, response.data.access_token);
      navigate('/dashboard');
    } catch (error) {
      alert('Error: Credenciales no válidas');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-slate-100">
      <form 
        onSubmit={handleSubmit(handleFormSubmit)}
        className="p-8 bg-white rounded-2xl shadow-lg w-96 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center text-slate-800">Acceder a Kanban</h1>
        
        <div>
          <label className="block text-sm font-medium text-slate-600">Correo Electrónico</label>
          <input 
            {...register('email')} 
            type="email" 
            className="w-full mt-1 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="ejemplo@correo.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600">Contraseña</label>
          <input 
            {...register('password')} 
            type="password" 
            className="w-full mt-1 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <button 
          type="submit" 
          className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition"
        >
          Entrar al Sistema
        </button>
      </form>
    </div>
  );
};