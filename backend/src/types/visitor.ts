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
