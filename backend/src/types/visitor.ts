export interface Visitor {
  _id?: string;
  name: string;
  email: string;
  phone: string;
  purpose: string;
  status: "registered" | "checked_in";
  qrToken: string;
  createdAt: string;
}

export interface CreateVisitorPayload {
  name: string;
  email: string;
  phone: string;
  purpose: string;
}
