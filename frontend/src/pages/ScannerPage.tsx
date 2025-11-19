import { FormEvent, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Scanner } from "@yudiel/react-qr-scanner";
import type { Visitor } from "../api";
import { checkInVisitor } from "../api";

type AdminStatus = "checking" | "authenticated" | "unauthenticated";

interface ScannerPageProps {
  adminEnabled: boolean;
  adminStatus: AdminStatus;
}

export function ScannerPage({ adminEnabled, adminStatus }: ScannerPageProps) {
  const queryClient = useQueryClient();
  const [manualToken, setManualToken] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const recentScanRef = useRef<{ token: string; timestamp: number }>({ token: "", timestamp: 0 });

  const checkInMutation = useMutation({
    mutationFn: (token: string) => checkInVisitor(token),
    onSuccess(visitor: Visitor) {
      setFeedback(`Visitor ${visitor.name} is now checked in.`);
      setErrorMessage(null);
      setCameraError(null);
      setManualToken("");
      recentScanRef.current = { token: "", timestamp: 0 };
      queryClient.invalidateQueries({ queryKey: ["visitors"] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["ledger"] }).catch(() => undefined);
    },
    onError() {
      setErrorMessage("Unable to complete check-in. Make sure this QR token is valid and try again.");
      setFeedback(null);
    },
  });

  const scannerPaused = useMemo(
    () => adminStatus !== "authenticated" || !adminEnabled,
    [adminEnabled, adminStatus]
  );
  const scannerDisabled = scannerPaused || checkInMutation.isPending;

  function processToken(token: string, source: "scan" | "manual") {
    const value = token.trim();
    if (!value) {
      return;
    }

    if (scannerPaused) {
      setErrorMessage("Admin session required before confirming check-ins.");
      return;
    }

    if (checkInMutation.isPending) {
      return;
    }

    if (source === "scan") {
      const { token: lastToken, timestamp } = recentScanRef.current;
      const now = Date.now();
      if (value === lastToken && now - timestamp < 3000) {
        return;
      }
      recentScanRef.current = { token: value, timestamp: now };
    }

    setFeedback(null);
    setErrorMessage(null);
    checkInMutation.mutate(value);
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    processToken(manualToken, "manual");
  }

  return (
    <>
      <header className="hero">
        <h1>On-Site QR Scanner</h1>
        <p>Scan visitor QR codes to confirm arrivals. A valid admin session is required.</p>
      </header>
      <div className="scanner-layout">
        <div className="card scanner-card">
          <header className="scanner-card__header">
            <h2>Live camera</h2>
            <Link to="/management" className="nav-link nav-link--button">
              Back to management
            </Link>
          </header>
          {!adminEnabled ? (
            <p className="card-subtitle">
              {adminStatus === "checking"
                ? "Checking stored admin credentials..."
                : "Sign in with the admin key on the management page to activate scanning."}
            </p>
          ) : (
            <Scanner
              constraints={{ facingMode: "environment" }}
              formats={["qr_code"]}
              scanDelay={250}
              paused={scannerPaused}
              onError={(error) => {
                console.warn("Camera error", error);
                setCameraError(
                  "Cannot access the camera. Check permissions or try opening this page over HTTPS/localhost."
                );
              }}
              onScan={(detected) => {
                const [first] = detected;
                if (first?.rawValue) {
                  processToken(first.rawValue, "scan");
                }
              }}
              styles={{
                container: {
                  width: "100%",
                  maxWidth: "420px",
                  marginInline: "auto",
                  borderRadius: "12px",
                  overflow: "hidden",
                },
                video: { width: "100%", height: "auto", borderRadius: "12px" },
              }}
              sound={false}
            />
          )}
          <p className="card-subtitle">
            Use a device with a camera. Browsers require HTTPS or localhost to expose the camera feed.
          </p>
        </div>
        <div className="card scanner-card">
          <h2>Manual entry</h2>
          <p className="card-subtitle">Fallback when the camera is unavailable.</p>
          <form className="manual-checkin-form" onSubmit={handleManualSubmit}>
            <label>
              QR token
              <input
                value={manualToken}
                onChange={(event) => setManualToken(event.target.value)}
                placeholder="Paste or type the QR value"
                disabled={scannerDisabled}
              />
            </label>
            <button type="submit" disabled={scannerDisabled}>
              {checkInMutation.isPending ? "Checking..." : "Confirm check-in"}
            </button>
          </form>
          {cameraError && <p className="status-message status-message--error">{cameraError}</p>}
          {feedback && <p className="status-message status-message--success">{feedback}</p>}
          {errorMessage && <p className="status-message status-message--error">{errorMessage}</p>}
          <ul className="scanner-hints">
            <li>Ensure the QR code is well lit and fills most of the frame.</li>
            <li>If the scan repeats, move the badge away briefly before rescanning.</li>
            <li>Manual entry accepts the raw token printed under each QR code.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
