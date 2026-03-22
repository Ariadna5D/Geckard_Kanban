import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
// Asegúrate de que la ruta apunte a donde guardaste el ProfileForm en el paso anterior
import { ProfileForm } from '../components/ProfileForm'; 

export const ProfilePage = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar de navegación */}
      <nav className="flex items-center p-4 bg-white shadow-sm gap-4">
        <Link 
          to="/dashboard" 
          className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-full transition"
          title="Volver al Dashboard"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-bold text-xl text-slate-800">Ajustes de Perfil</h1>
      </nav>

      {/* Contenedor principal donde inyectamos el formulario */}
      <main className="p-4 md:p-8">
        <ProfileForm />
      </main>
    </div>
  );
};