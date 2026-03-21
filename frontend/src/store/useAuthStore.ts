import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types/user';


interface AuthState {
  //--- Estado ---
  user: User | null; // Información del usuario autenticado
  token: string | null; // Token JWT para autenticación
  isAuthenticated: boolean; // Bandera para saber si el usuario está autenticado
  
  // --- Getters ---
  _hasHydrated: boolean; // Bandera interna para saber si ya se ha cargado el usuario
  setHasHydrated: (state: boolean) => void; // Función para actualizar la bandera de hidratación

  // --- Actions ---
  login: (user: User, token: string) => void; // Función para iniciar sesión
  logout: () => void; // Función para cerrar sesión
}

// Creamos el store de autenticación usando Zustand con persistencia en LocalStorage
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // --- Estado ---
      user: null, // Por defecto no hay usuario autenticado
      token: null, // Por defecto no hay token
      isAuthenticated: false, // Por defecto no estamos autenticados
      _hasHydrated: false, // Por defecto la app no ha leído la api aún

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Al hacer login, guardamos user y token y activamos la bandera de autenticado
      login: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true 
      }),

      // Al cerrar sesión, limpiamos todo
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    { 
      name: 'auth-storage', // Nombre de la clave en LocalStorage

      // es una función que se ejecuta cuando el store se carga desde LocalStorage
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
    } 
  )
);