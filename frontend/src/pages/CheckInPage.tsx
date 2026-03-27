import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Html5Qrcode,
  type Html5QrcodeCameraScanConfig,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { AdminStatus } from "../types";
import type { Visitor } from "../api";
import { checkInVisitor } from "../api";
import { Modal } from "../components/Modal";

interface CheckInPageProps {
  adminEnabled: boolean;
  adminStatus: AdminStatus;
}

export function CheckInPage({ adminEnabled, adminStatus }: CheckInPageProps) {
  const queryClient = useQueryClient();
  const [manualToken, setManualToken] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isImageDecoding, setIsImageDecoding] = useState(false);
  const [modalVisitor, setModalVisitor] = useState<Visitor | null>(null);
  const [hostName, setHostName] = useState("");
  const preferredCameraIdRef = useRef<string | null>(null);
  const recentScanRef = useRef<{ token: string; timestamp: number }>({ token: "", timestamp: 0 });
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCameraRunningRef = useRef(false);
  const previewElementId = useMemo(
    () => `qr-live-preview-${Math.random().toString(36).slice(2, 10)}`,
    []
  );
  const fileScanElementId = useMemo(
    () => `qr-file-scan-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const checkInMutation = useMutation({
    mutationFn: (token: string) => checkInVisitor(token),
    onSuccess(visitor: Visitor) {
      setModalVisitor(visitor);
      setHostName("");
      setFeedback(`Visitor ${visitor.name} successfully checked in.`);
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

  const processToken = useCallback(
    (token: string, source: "scan" | "manual" | "image") => {
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
    },
    [checkInMutation, scannerPaused]
  );

  const scannerConfig = useMemo<Html5QrcodeCameraScanConfig>(
    () => ({
      fps: 12,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const boxSize = Math.max(Math.floor(minEdge * 0.7), 220);
        return { width: boxSize, height: boxSize };
      },
      aspectRatio: 1,
      disableFlip: true,
      videoConstraints: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }),
    []
  );

  useEffect(() => {
    let active = true;

    const ensureInstance = () => {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(previewElementId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: true,
        });
      }
      return html5QrCodeRef.current;
    };

    const startCamera = async () => {
      if (isCameraRunningRef.current || scannerPaused) {
        return;
      }

      const scanner = ensureInstance();
      if (!scanner) {
        return;
      }

      try {
        setCameraError(null);
        let cameraIdOrConfig: string | MediaTrackConstraints;

        if (!preferredCameraIdRef.current) {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            setCameraError("No camera devices were found. Connect a camera and try again.");
            return;
          }
          const normalizeLabel = (label: string) => label.toLowerCase();
          const environmentCamera = cameras.find((device) => normalizeLabel(device.label).includes("back"))
            ?? cameras.find((device) => normalizeLabel(device.label).includes("rear"))
            ?? cameras.find((device) => normalizeLabel(device.label).includes("environment"))
            ?? cameras[0];
          preferredCameraIdRef.current = environmentCamera.id;
        }

        cameraIdOrConfig = preferredCameraIdRef.current ?? { facingMode: "environment" };

        await scanner.start(
          cameraIdOrConfig,
          scannerConfig,
          (decodedText) => {
            processToken(decodedText, "scan");
          },
          (warningMessage) => {
            if (typeof warningMessage === "string" && warningMessage.includes("NotFound")) {
              return;
            }
            console.warn("scanner warning", warningMessage);
          }
        );
        if (active) {
          isCameraRunningRef.current = true;
        } else {
          await scanner.stop();
        }
      } catch (error) {
        console.warn("Failed to start camera", error);
        if (active) {
          setCameraError("Unable to start the scanner. Check camera permissions or try a different device.");
        }
        try {
          await html5QrCodeRef.current?.stop();
        } catch {
          /* ignore */
        }
        isCameraRunningRef.current = false;
      }
    };

    const stopCamera = async () => {
      if (!isCameraRunningRef.current || !html5QrCodeRef.current) {
        return;
      }
      try {
        await html5QrCodeRef.current.stop();
      } catch (error) {
        console.warn("Failed to stop camera", error);
      } finally {
        isCameraRunningRef.current = false;
      }
    };

    if (scannerPaused) {
      stopCamera().catch(() => undefined);
    } else {
      startCamera().catch(() => undefined);
    }

    return () => {
      active = false;
      stopCamera().catch(() => undefined);
    };
  }, [previewElementId, processToken, scannerConfig, scannerPaused]);

  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (html5QrCodeRef.current) {
          try {
            if (isCameraRunningRef.current) {
              await html5QrCodeRef.current.stop();
            }
          } catch {
            /* ignore */
          }
          html5QrCodeRef.current.clear();
          html5QrCodeRef.current = null;
          isCameraRunningRef.current = false;
        }
      };

      void cleanup();
    };
  }, []);

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    processToken(manualToken, "manual");
  }

  const handleImageUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (scannerPaused) {
        setErrorMessage("Admin session required before confirming check-ins.");
        event.target.value = "";
        return;
      }

      setFeedback(null);
      setErrorMessage(null);
      setIsImageDecoding(true);

      const wasRunning = isCameraRunningRef.current;
      if (wasRunning) {
        try {
          html5QrCodeRef.current?.pause(true);
        } catch (error) {
          console.warn("Failed to pause live scanner", error);
        }
      }

      let fileScanner: Html5Qrcode | undefined;

      try {
        fileScanner = new Html5Qrcode(fileScanElementId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: true,
        });
        const decodedText = await fileScanner.scanFile(file, false);
        processToken(decodedText, "image");
      } catch (error) {
        console.warn("Image decode failed", error);
        setErrorMessage("Could not read a QR code from that image. Try a clearer, well-lit photo.");
      } finally {
        try {
          await fileScanner?.clear();
        } catch {
          /* ignore */
        }
        if (wasRunning) {
          try {
            html5QrCodeRef.current?.resume();
          } catch (error) {
            console.warn("Failed to resume live scanner", error);
          }
        }
        setIsImageDecoding(false);
        event.target.value = "";
      }
    },
    [fileScanElementId, processToken, scannerPaused]
  );

  return (
    <div className="checkin-page">
      <section className="checkin-hero">
        <div>
          <span className="eyebrow">Front desk mode</span>
          <h1>Touchless QR Check-In</h1>
          <p>
            Scan visitor badges, capture visit intent, and sync arrivals to your dashboard in real time.
            Designed for reception teams in corporate offices, coworking spaces, tech parks, and smart
            campuses.
          </p>
        </div>
        <div className="hero-actions">
          <div className="hero-badge">
            <span className="badge badge-positive">Ready</span>
            <span>Camera connected</span>
          </div>
          <div className="hero-badge">
            <span className="badge badge-outline">Secure</span>
            <span>Admin authentication required</span>
          </div>
        </div>
      </section>

      <div className="checkin-grid">
        <section className="scanner-glass">
          <header>
            <div>
              <h2>Live QR Scanner</h2>
              <p>Position the badge inside the frame for an instant scan.</p>
            </div>
            <div className="scan-status">
              <span className={`status-dot ${scannerPaused ? "status-dot--paused" : "status-dot--active"}`} />
              <span>{scannerPaused ? "Scanner paused" : "Scanning"}</span>
            </div>
          </header>

          <div className="scan-window">
            {adminEnabled ? (
              <>
                <div id={previewElementId} className="scanner-video-surface" />
                <div id={fileScanElementId} className="visually-hidden" aria-hidden="true" />
                <div className="scan-reticle" />
              </>
            ) : (
              <div className="scanner-guard">
                <h3>{adminStatus === "checking" ? "Verifying admin session" : "Authentication required"}</h3>
                <p>
                  {adminStatus === "checking"
                    ? "Checking stored admin credentials..."
                    : "Sign in through the admin dashboard to unlock scanning."}
                </p>
              </div>
            )}
          </div>

          <footer className="scan-footer">
            <p>Use HTTPS or localhost to enable camera access. Ensure the QR code fills ~70% of the frame.</p>
            {cameraError && <span className="alert alert-error">{cameraError}</span>}
            {feedback && <span className="alert alert-success">{feedback}</span>}
            {errorMessage && <span className="alert alert-error">{errorMessage}</span>}
          </footer>
        </section>

        <aside className="checkin-utilities">
          <section className="utility-card">
            <h3>Manual or Assisted Check-In</h3>
            <p>Fallback to manual entry or upload a QR image when the camera cannot be used.</p>
            <form className="manual-form" onSubmit={handleManualSubmit}>
              <label>
                QR token
                <input
                  value={manualToken}
                  onChange={(event) => setManualToken(event.target.value)}
                  placeholder="Paste or type the QR value"
                  disabled={scannerDisabled}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={scannerDisabled}>
                {checkInMutation.isPending ? "Checking..." : "Confirm check-in"}
              </button>
            </form>
            <label className="file-upload">
              Upload QR image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={scannerDisabled || isImageDecoding}
              />
            </label>
            {isImageDecoding && <span className="alert">Analyzing uploaded image...</span>}
          </section>

          <section className="utility-card tips-card">
            <h3>Scanning tips</h3>
            <ul>
              <li>Hold the badge 15–20 cm from the camera for the sharpest focus.</li>
              <li>Glare-free lighting or matte badge prints boost recognition accuracy.</li>
              <li>Ask visitors to refresh issued QR codes if they report delivery delays.</li>
            </ul>
          </section>
        </aside>
      </div>

      <Modal
        open={Boolean(modalVisitor)}
        title="Visitor check-in captured"
        onClose={() => setModalVisitor(null)}
      >
        {modalVisitor && (
          <div className="checkin-modal">
            <div className="modal-summary">
              <div>
                <span className="label">Visitor</span>
                <strong>{modalVisitor.name}</strong>
              </div>
              <div>
                <span className="label">Phone</span>
                <strong>{modalVisitor.phone}</strong>
              </div>
              <div>
                <span className="label">Purpose</span>
                <strong>{modalVisitor.purpose}</strong>
              </div>
            </div>
            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                setModalVisitor(null);
                setHostName("");
              }}
            >
              <label>
                Host person
                <input
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  placeholder="e.g. Ananya Gupta"
                />
              </label>
              <label>
                Notes
                <textarea placeholder="Security observations or delivery details" rows={3} />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModalVisitor(null)}>
                  Close
                </button>
                <button type="submit" className="btn btn-primary">
                  Finish check-in
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
