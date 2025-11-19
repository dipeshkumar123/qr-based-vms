import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  verifyAdminKey,
  loadStoredAdminKey,
  registerAuthFailureHandler,
  clearAuthFailureHandler,
  clearAdminKey,
} from "./api";
import { VisitorPage } from "./pages/VisitorPage";
import { ManagementPage } from "./pages/ManagementPage";
import { ScannerPage } from "./pages/ScannerPage";

type AdminStatus = "checking" | "authenticated" | "unauthenticated";

export default function App() {
  const [adminStatus, setAdminStatus] = useState<AdminStatus>("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const queryClient = useQueryClient();

  const resetAdminData = useCallback(() => {
    queryClient.removeQueries({ queryKey: ["visitors"], exact: false });
    queryClient.removeQueries({ queryKey: ["ledger"], exact: false });
  }, [queryClient]);

  const attemptAuthentication = useCallback(
    async (key: string, options?: { silent?: boolean }) => {
      setIsAuthenticating(true);
      if (!options?.silent) {
        setAuthError(null);
      }
      try {
        await verifyAdminKey(key);
        setAdminStatus("authenticated");
        setAuthError(null);
        resetAdminData();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["visitors"] }),
          queryClient.invalidateQueries({ queryKey: ["ledger"] }),
        ]);
        return true;
      } catch (error) {
        const message = options?.silent
          ? "Stored admin key is no longer valid. Please sign in again."
          : "Invalid admin key. Please try again.";
        setAuthError(message);
        setAdminStatus("unauthenticated");
        return false;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [queryClient, resetAdminData]
  );

  useEffect(() => {
    registerAuthFailureHandler(() => {
      clearAdminKey();
      resetAdminData();
      setAdminStatus("unauthenticated");
      setAuthError("Session expired. Please sign in again.");
    });
    return () => {
      clearAuthFailureHandler();
    };
  }, [resetAdminData]);

  useEffect(() => {
    const stored = loadStoredAdminKey();
    if (stored) {
      void attemptAuthentication(stored, { silent: true });
    } else {
      setAdminStatus("unauthenticated");
    }
  }, [attemptAuthentication]);

  function handleLogout(): void {
    clearAdminKey();
    resetAdminData();
    setAdminStatus("unauthenticated");
    setAuthError(null);
  }

  const adminEnabled = adminStatus === "authenticated";

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">II-VMS</div>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Visitor portal
          </NavLink>
          <NavLink
            to="/management"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            Management
          </NavLink>
          <NavLink
            to="/management/scan"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            QR scanner
          </NavLink>
        </nav>
      </header>
      <main className="layout">
        <Routes>
          <Route path="/" element={<VisitorPage />} />
          <Route
            path="/management"
            element={
              <ManagementPage
                adminStatus={adminStatus}
                adminEnabled={adminEnabled}
                authError={authError}
                isAuthenticating={isAuthenticating}
                attemptAuthentication={attemptAuthentication}
                handleLogout={handleLogout}
                clearAuthError={() => setAuthError(null)}
              />
            }
          />
          <Route
            path="/management/scan"
            element={<ScannerPage adminEnabled={adminEnabled} adminStatus={adminStatus} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
