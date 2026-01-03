import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      isAdmin: false,
      setAdmin: (flag) => set({ isAdmin: !!flag }),
      logout: () => {
        set({ isAdmin: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
