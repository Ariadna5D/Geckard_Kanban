import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types/user';
import api from '../api/axios.instance';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      // Marca cuando el store persistido termina de hidratarse
      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),

      // Guarda usuario y token tras autenticacion correcta
      login: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true 
      }),

      // Limpia los datos de sesion local
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      // Actualiza datos parciales del usuario actual
      updateUser: (updatedData) =>
        set((state) => {
          if (!state.user) {
            return { user: null };
          }
          return { user: { ...state.user, ...updatedData } };
        }),

      // Revalida el usuario actual desde el backend
      fetchUser: async () => {
        try {
          // Pide el perfil actual para mantener store sincronizado con API
          const response = await api.get('/users/me');
          set({ 
            user: response.data, 
            isAuthenticated: true 
          });
        } catch {
          // Si falla sesion, limpiamos estado local de auteticacion
          set({ user: null, token: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      // Marca hidratacion completa tras restaurar el estado persistido
      onRehydrateStorage: () => () => {
        useAuthStore.getState().setHasHydrated(true);
      },
    },
  ),
);