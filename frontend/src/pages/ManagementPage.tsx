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
      <header className="hero hero--management">
        <span className="hero-badge">Operations control</span>
        <h1>Management Console</h1>
        <p>
          Authenticate with the admin key to unlock live visitor data, confirm arrivals, and audit the
          tamper-evident ledger.
        </p>
      </header>
      <section className="management-dashboard">
        <aside className="management-sidebar">
          <div className="card admin-card">
            <h2>Admin Access</h2>
            {adminStatus === "checking" ? (
              <p className="card-subtitle">Validating stored admin key...</p>
            ) : adminEnabled ? (
              <>
                <p className="card-subtitle">You are signed in. Use the quick actions below to stay on top of arrivals.</p>
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

          <div className="card guidance-card">
            <h2>Guided actions</h2>
            <ul>
              <li>Check the visitor roster for registrations awaiting check-in.</li>
              <li>Launch the QR scanner on a kiosk or handheld device at the gate.</li>
              <li>Monitor the ledger to verify every change is captured.</li>
            </ul>
            <p className="card-subtitle">
              Tip: keep this console open in a desktop browser while scanning from a mobile device.
            </p>
          </div>
        </aside>

        <div className="management-main">
          <section className="management-stats" aria-label="Operational snapshots">
            <article className="stat-card">
              <h3>Live arrivals</h3>
              <p>{adminEnabled ? "Refresh the visitor table to confirm check-ins." : "Authenticate to unlock real-time metrics."}</p>
            </article>
            <article className="stat-card">
              <h3>Ledger health</h3>
              <p>Each check-in is hashed with SHA-256 for tamper detection.</p>
            </article>
            <article className="stat-card">
              <h3>Device readiness</h3>
              <p>Ensure the scanner device is on HTTPS and has camera permissions.</p>
            </article>
          </section>

          <section className="management-panels">
            <div className="management-primary">
              <VisitorTable onSelect={setSelectedVisitor} enabled={adminEnabled} />
            </div>
            <div className="management-secondary">
              <QrPreview
                visitor={selectedVisitor}
                emptyMessage="Select a visitor from the table to view their QR token."
              />
              <LedgerPanel enabled={adminEnabled} />
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
