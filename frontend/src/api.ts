import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

const ADMIN_HEADER = "x-admin-key";
const ADMIN_STORAGE_KEY = "ii_vms_admin_key";

let authFailureHandler: (() => void) | null = null;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      clearAdminKey();
      if (authFailureHandler) {
        authFailureHandler();
      }
    }
    return Promise.reject(error);
  }
);

export function registerAuthFailureHandler(handler: () => void): void {
  authFailureHandler = handler;
}

export function clearAuthFailureHandler(): void {
  authFailureHandler = null;
}

function setHeader(key: string | null): void {
  if (key) {
    api.defaults.headers.common[ADMIN_HEADER] = key;
  } else {
    delete api.defaults.headers.common[ADMIN_HEADER];
  }
}

export function loadStoredAdminKey(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(ADMIN_STORAGE_KEY);
  if (stored) {
    setHeader(stored);
    return stored;
  }
  return null;
}

export function clearAdminKey(): void {
  setHeader(null);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
  }
}

export async function verifyAdminKey(key: string): Promise<void> {
  setHeader(key);
  try {
    await api.post("/admin/verify");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_STORAGE_KEY, key);
    }
  } catch (error) {
    clearAdminKey();
    throw error;
  }
}

export interface Visitor {
  id: number;
  name: string;
  email: string;
  phone: string;
  purpose: string;
  status: "registered" | "checked_in";
  qrToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitorPayload {
  name: string;
  email: string;
  phone: string;
  purpose: string;
}

export async function createVisitor(payload: CreateVisitorPayload): Promise<Visitor> {
  const { data } = await api.post<Visitor>("/visitors", payload);
  return data;
}

export async function listVisitors(): Promise<Visitor[]> {
  const { data } = await api.get<Visitor[]>("/visitors");
  return data;
}

export async function checkInVisitor(token: string): Promise<Visitor> {
  const { data } = await api.post<Visitor>(`/visitors/${token}/check-in`);
  return data;
}

export async function deleteVisitor(id: number): Promise<void> {
  await api.delete(`/visitors/${id}`);
}

export async function getLedger(): Promise<{ hash: string; visitorId: number; createdAt: string }[]> {
  const { data } = await api.get(`/ledger`);
  return data;
}
