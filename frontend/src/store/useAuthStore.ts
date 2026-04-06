import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types/user';
import api from '../api/axios.instance'; // Importante para las peticiones

interface AuthState {
  // --- Estado ---
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // --- Hidratación de persist ---
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // --- Actions ---
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  
  /** Revalida usuario actual con /users/me usando el token persistido. */
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // --- Estado Inicial ---
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      /** Marca que el store persistido ya se restauró en cliente. */
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      /** Guarda usuario+token tras login correcto. */
      login: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true 
      }),

      /** Limpia sesión local (logout). */
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      /** Actualiza parcialmente datos del perfil sin perder los existentes. */
      updateUser: (updatedData) => set((state) => ({
        user: state.user ? { ...state.user, ...updatedData } : null
      })),

      fetchUser: async () => {
        try {
          const response = await api.get('/users/me');
          set({ 
            user: response.data, 
            isAuthenticated: true 
          });
        } catch (error) {
          // Token inválido/caducado o backend no accesible.
          set({ user: null, token: null, isAuthenticated: false });
        }
      },
    }),
    { 
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
    } 
  )
);