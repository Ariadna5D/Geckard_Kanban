import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types/user';
import api from '../api/axios.instance'; // Importante para las peticiones

interface AuthState {
  // --- Estado ---
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // --- Getters/Hydration ---
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // --- Actions ---
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  
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

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      login: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true 
      }),

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

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