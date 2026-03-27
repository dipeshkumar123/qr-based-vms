import { FormEvent, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { AdminStatus } from "../../types";

interface AdminLayoutProps {
  adminStatus: AdminStatus;
  adminEnabled: boolean;
  authError: string | null;
  isAuthenticating: boolean;
  attemptAuthentication: (key: string) => Promise<boolean>;
  handleLogout: () => void;
  clearAuthError: () => void;
}

interface AdminOutletContext {
  adminStatus: AdminStatus;
  adminEnabled: boolean;
  attemptAuthentication: (key: string) => Promise<boolean>;
  handleLogout: () => void;
  isAuthenticating: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const NAVIGATION = [
  { label: "Dashboard", to: "/admin" },
  { label: "Visitors", to: "/admin/visitors" },
  { label: "Hosts", to: "/admin/hosts" },
  { label: "QR Generator", to: "/admin/qr-generator" },
  { label: "Settings", to: "/admin/settings" },
];

export function AdminLayout(props: AdminLayoutProps) {
  const {
    adminStatus,
    adminEnabled,
    authError,
    isAuthenticating,
    attemptAuthentication,
    handleLogout,
    clearAuthError,
  } = props;
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeSection = useMemo(() => {
    const match = NAVIGATION.find((item) => {
      if (item.to === "/admin") {
        return location.pathname === "/admin";
      }
      return location.pathname.startsWith(item.to);
    });
    return match?.label ?? "Admin";
  }, [location.pathname]);

  return (
    <div className={`admin-shell ${sidebarOpen ? "admin-shell--sidebar" : ""}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar__header">
          <span className="sidebar-title">Control Center</span>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse sidebar"
          >
            ×
          </button>
        </div>
        <nav className="admin-nav">
          {NAVIGATION.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className={({ isActive }) => (isActive ? "admin-nav__link admin-nav__link--active" : "admin-nav__link")}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="admin-nav__dot" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <div>
            <span className="eyebrow">Admin Portal</span>
            <h1>{activeSection}</h1>
          </div>
          <div className="admin-header__actions">
            {adminEnabled ? (
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                Sign out
              </button>
            ) : (
              <span className="badge badge-outline">Locked</span>
            )}
          </div>
        </header>

        <div className="admin-content">
          {adminEnabled ? (
            <Outlet
              context={{
                adminStatus,
                adminEnabled,
                attemptAuthentication,
                handleLogout,
                isAuthenticating,
                authError,
                clearAuthError,
              }}
            />
          ) : (
            <AdminAccessCard
              adminStatus={adminStatus}
              isAuthenticating={isAuthenticating}
              attemptAuthentication={attemptAuthentication}
              authError={authError}
              clearAuthError={clearAuthError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface AdminAccessCardProps {
  adminStatus: AdminStatus;
  isAuthenticating: boolean;
  attemptAuthentication: (key: string) => Promise<boolean>;
  authError: string | null;
  clearAuthError: () => void;
}

function AdminAccessCard({
  adminStatus,
  isAuthenticating,
  attemptAuthentication,
  authError,
  clearAuthError,
}: AdminAccessCardProps) {
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [inputWarning, setInputWarning] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = adminKeyInput.trim();
    if (!trimmed) {
      setInputWarning("Admin key is required.");
      return;
    }

    const success = await attemptAuthentication(trimmed);
    if (success) {
      setAdminKeyInput("");
    }
  }

  function handleChange(value: string) {
    if (inputWarning) {
      setInputWarning(null);
    }
    if (authError) {
      clearAuthError();
    }
    setAdminKeyInput(value);
  }

  return (
    <div className="admin-access-card">
      <div>
        <span className="eyebrow">Secure entry</span>
        <h2>Authenticate to unlock the admin console</h2>
        <p>
          Use your administrator key to access visitor analytics, host management, QR issuance, and
          security controls.
        </p>
      </div>
      {adminStatus === "checking" ? (
        <p className="card-subtitle">Validating stored admin key...</p>
      ) : (
        <form className="admin-access-form" onSubmit={handleSubmit}>
          <label>
            Admin key
            <input
              type="password"
              value={adminKeyInput}
              onChange={(event) => handleChange(event.target.value)}
              placeholder="Enter admin key"
              disabled={isAuthenticating}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={isAuthenticating}>
            {isAuthenticating ? "Signing in..." : "Unlock dashboard"}
          </button>
        </form>
      )}
      {(authError || inputWarning) && <p className="alert alert-error">{authError ?? inputWarning}</p>}
      <p className="card-subtitle">Need help? Contact the security operations team to reset admin keys.</p>
    </div>
  );
}

export function useAdminOutletContext() {
  return useOutletContext<AdminOutletContext>();
}
