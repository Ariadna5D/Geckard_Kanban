import { useAuthStore } from "../store/useAuthStore";

export const DashboardPage = () => {
  const {user} = useAuthStore();

  return (
    <main className="p-8">
      <h2 className="text-3xl font-bold text-slate-800">
        ¡Hola de nuevo, {user?.username}!
      </h2>
      <p className="text-slate-500 mt-2">
        Bienvenido a tu sistema de gestión gamificado.
      </p>

      <div className="mt-10 p-20 border-2 border-dashed border-slate-200 rounded-3xl text-center">
        <p className="text-slate-400">
          Aquí irán tus tableros de Trello muy pronto...
        </p>
      </div>
    </main>
  );
};
