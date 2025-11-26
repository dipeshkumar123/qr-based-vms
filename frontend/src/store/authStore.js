import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      adminKey: null,
      isAdmin: false,
      setAdminKey: (key) => {
        localStorage.setItem('adminKey', key);
        set({ adminKey: key, isAdmin: !!key });
      },
      logout: () => {
        localStorage.removeItem('adminKey');
        set({ adminKey: null, isAdmin: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
