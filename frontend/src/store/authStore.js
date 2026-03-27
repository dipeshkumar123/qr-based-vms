import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../lib/api';

export const useAuthStore = create(
  persist(
    (set) => ({
      isAdmin: false,
      isLoading: true,
      setAdmin: (flag) => set({ isAdmin: !!flag, isLoading: false }),
      logout: async () => {
        try {
          await apiClient.post('/api/admin/logout');
        } catch {
          // Server may be unreachable; clear local state regardless
        }
        set({ isAdmin: false });
      },
      /** Validate the persisted session against the server on app startup */
      validateSession: async () => {
        try {
          await apiClient.get('/api/admin/verify');
          set({ isAdmin: true, isLoading: false });
        } catch {
          set({ isAdmin: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ isAdmin: state.isAdmin }),
    }
  )
);
