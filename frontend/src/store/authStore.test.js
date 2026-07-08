import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';

// ── Mock the apiClient used inside the store ──────────────────────────────────
vi.mock('../lib/api', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// ── We import the store AFTER the mock is set up ──────────────────────────────
// NOTE: Zustand `persist` middleware writes to localStorage; we clear between tests.
const getStore = async () => {
  const { useAuthStore } = await import('../store/authStore');
  return useAuthStore;
};

describe('authStore', () => {
  beforeEach(() => {
    // Clear localStorage so persisted state doesn't bleed between tests
    localStorage.clear();
    // Reset the Zustand store state before each test
    vi.resetModules();
  });

  // ── Test 1: isAdmin defaults to false ────────────────────────────────────
  it('has isAdmin as false by default', async () => {
    const useAuthStore = await getStore();
    const state = useAuthStore.getState();
    expect(state.isAdmin).toBe(false);
  });

  // ── Test 2: setAdmin(true) sets isAdmin to true ───────────────────────────
  it('setAdmin(true) sets isAdmin to true and isLoading to false', async () => {
    const useAuthStore = await getStore();

    act(() => {
      useAuthStore.getState().setAdmin(true);
    });

    const state = useAuthStore.getState();
    expect(state.isAdmin).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  // ── Test 3: setAdmin(false) sets isAdmin to false ─────────────────────────
  it('setAdmin(false) sets isAdmin back to false', async () => {
    const useAuthStore = await getStore();

    act(() => {
      useAuthStore.getState().setAdmin(true);
      useAuthStore.getState().setAdmin(false);
    });

    expect(useAuthStore.getState().isAdmin).toBe(false);
  });

  // ── Test 4: setAdmin coerces truthy values ────────────────────────────────
  it('setAdmin coerces truthy values to boolean true', async () => {
    const useAuthStore = await getStore();

    act(() => {
      useAuthStore.getState().setAdmin(1);
    });

    expect(useAuthStore.getState().isAdmin).toBe(true);
  });

  // ── Test 5: logout calls apiClient.post and resets isAdmin ───────────────
  it('logout posts to /api/admin/logout and resets isAdmin to false', async () => {
    const apiModule = await import('../lib/api');
    apiModule.apiClient.post.mockResolvedValue({});

    const useAuthStore = await getStore();

    act(() => {
      useAuthStore.getState().setAdmin(true);
    });

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    expect(apiModule.apiClient.post).toHaveBeenCalledWith('/api/admin/logout');
    expect(useAuthStore.getState().isAdmin).toBe(false);
  });

  // ── Test 6: logout handles server errors gracefully ──────────────────────
  it('logout still resets isAdmin even if the server call fails', async () => {
    const apiModule = await import('../lib/api');
    apiModule.apiClient.post.mockRejectedValue(new Error('Network error'));

    const useAuthStore = await getStore();

    act(() => {
      useAuthStore.getState().setAdmin(true);
    });

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    expect(useAuthStore.getState().isAdmin).toBe(false);
  });

  // ── Test 7: validateSession → success sets isAdmin to true ────────────────
  it('validateSession sets isAdmin to true when server verifies the session', async () => {
    const apiModule = await import('../lib/api');
    apiModule.apiClient.get.mockResolvedValue({ data: {} });

    const useAuthStore = await getStore();

    await act(async () => {
      await useAuthStore.getState().validateSession();
    });

    expect(useAuthStore.getState().isAdmin).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  // ── Test 8: validateSession → failure keeps isAdmin false ────────────────
  it('validateSession sets isAdmin to false when server returns an error', async () => {
    const apiModule = await import('../lib/api');
    apiModule.apiClient.get.mockRejectedValue(new Error('401 Unauthorized'));

    const useAuthStore = await getStore();

    await act(async () => {
      await useAuthStore.getState().validateSession();
    });

    expect(useAuthStore.getState().isAdmin).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
