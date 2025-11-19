import { useState } from "react";
import { QrPreview } from "../components/QrPreview";
import { VisitorForm } from "../components/VisitorForm";
import type { Visitor } from "../api";

export function VisitorPage() {
  const [recentVisitor, setRecentVisitor] = useState<Visitor | null>(null);

  return (
    <>
      <header className="hero">
        <h1>Visitor Portal</h1>
        <p>Register your visit and receive a QR code for quick, contactless entry.</p>
      </header>
      <div className="grid">
        <VisitorForm onSuccess={setRecentVisitor} />
        <QrPreview visitor={recentVisitor} />
      </div>
    </>
  );
}
