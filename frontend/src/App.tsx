import { useState } from "react";
import { Visitor } from "./api";
import { QrPreview } from "./components/QrPreview";
import { VisitorForm } from "./components/VisitorForm";
import { VisitorTable } from "./components/VisitorTable";

export default function App() {
  const [activeVisitor, setActiveVisitor] = useState<Visitor | null>(null);

  return (
    <div className="layout">
      <header className="hero">
        <h1>II-VMS MVP</h1>
        <p>Contactless visitor registration with QR-based check-in.</p>
      </header>
      <main className="grid">
        <VisitorForm onSuccess={setActiveVisitor} />
        <QrPreview visitor={activeVisitor} />
      </main>
      <section>
        <VisitorTable onSelect={setActiveVisitor} />
      </section>
    </div>
  );
}
