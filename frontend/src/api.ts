import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

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
