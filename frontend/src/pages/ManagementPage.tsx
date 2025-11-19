import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import type { Visitor } from "../api";
import { QrPreview } from "../components/QrPreview";
import { VisitorTable } from "../components/VisitorTable";
import { LedgerPanel } from "../components/LedgerPanel";

type AdminStatus = "checking" | "authenticated" | "unauthenticated";

interface ManagementPageProps {
  adminStatus: AdminStatus;
  adminEnabled: boolean;
  authError: string | null;
  isAuthenticating: boolean;
  attemptAuthentication: (key: string) => Promise<boolean>;
  handleLogout: () => void;
  clearAuthError: () => void;
}

export function ManagementPage({
  adminStatus,
  adminEnabled,
  authError,
  isAuthenticating,
  attemptAuthentication,
  handleLogout,
  clearAuthError,
}: ManagementPageProps) {
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [inputWarning, setInputWarning] = useState<string | null>(null);

  async function handleAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = adminKeyInput.trim();
    if (!trimmed) {
      setInputWarning("Admin key is required.");
      return;
    }

    const success = await attemptAuthentication(trimmed);
    if (success) {
      setAdminKeyInput("");
      setSelectedVisitor(null);
    }
  }

  function handleInputChange(value: string) {
    if (inputWarning) {
      setInputWarning(null);
    }
    if (authError) {
      clearAuthError();
    }
    setAdminKeyInput(value);
  }

  return (
    <>
      <header className="hero">
        <h1>Management Console</h1>
        <p>Authenticate to manage visitors, confirm check-ins, and review the immutable ledger.</p>
      </header>
      <section className="admin-grid">
        <div className="card admin-card">
          <h2>Admin Access</h2>
          {adminStatus === "checking" ? (
            <p className="card-subtitle">Validating stored admin key...</p>
          ) : adminEnabled ? (
            <>
              <p className="card-subtitle">Admin tools are unlocked on this device.</p>
              <div className="admin-actions">
                <Link to="/management/scan" className="nav-link nav-link--button">
                  Launch QR Scanner
                </Link>
                <button type="button" className="secondary" onClick={handleLogout}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <form className="admin-form" onSubmit={handleAdminSubmit}>
              <label>
                Admin key
                <input
                  type="password"
                  value={adminKeyInput}
                  onChange={(event) => handleInputChange(event.target.value)}
                  placeholder="Enter admin key"
                  disabled={isAuthenticating}
                  required
                />
              </label>
              <button type="submit" disabled={isAuthenticating}>
                {isAuthenticating ? "Signing in..." : "Unlock admin tools"}
              </button>
            </form>
          )}
          {(authError || inputWarning) && (
            <p className="error" style={{ marginTop: "0.75rem" }}>
              {authError ?? inputWarning}
            </p>
          )}
        </div>
        <VisitorTable onSelect={setSelectedVisitor} enabled={adminEnabled} />
        <QrPreview
          visitor={selectedVisitor}
          emptyMessage="Select a visitor from the table to view their QR token."
        />
        <LedgerPanel enabled={adminEnabled} />
      </section>
    </>
  );
}
