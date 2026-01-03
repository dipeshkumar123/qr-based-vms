export interface Visitor {
  id: number;
  name: string;
  email: string;
  phone: string;
  purpose: string;
  status: "registered" | "checked_in" | "checked_out";
  qrToken: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
  biometricEnrolled?: boolean;
}

export interface CreateVisitorPayload {
  name: string;
  email: string;
  phone: string;
  purpose: string;
  photoUrl?: string;
}
