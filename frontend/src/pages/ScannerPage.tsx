import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Html5Qrcode,
  type Html5QrcodeCameraScanConfig,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
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
  const [isImageDecoding, setIsImageDecoding] = useState(false);
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

  const processToken = useCallback((token: string, source: "scan" | "manual" | "image") => {
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
  }, [checkInMutation, scannerPaused]);

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
          (errorMessage) => {
            if (typeof errorMessage === "string" && errorMessage.includes("NotFound")) {
              return;
            }
            console.warn("scanner warning", errorMessage);
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
          setCameraError(
            "Unable to start the scanner. Check camera permissions or try a different device."
          );
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

  const handleImageUpload = useCallback(async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
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
  }, [fileScanElementId, processToken, scannerPaused]);

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
            <div className="video-shell">
              <div id={previewElementId} className="scanner-video-surface" />
              <div id={fileScanElementId} className="visually-hidden" aria-hidden="true" />
            </div>
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
          <div className="image-upload">
            <label>
              Upload QR image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={scannerDisabled || isImageDecoding}
              />
            </label>
            <p className="card-subtitle">
              Select a saved badge photo when the camera cannot be used.
            </p>
          </div>
          {isImageDecoding && (
            <p className="status-message">Analyzing uploaded image...</p>
          )}
          {cameraError && <p className="status-message status-message--error">{cameraError}</p>}
          {feedback && <p className="status-message status-message--success">{feedback}</p>}
          {errorMessage && <p className="status-message status-message--error">{errorMessage}</p>}
          <ul className="scanner-hints">
            <li>Ensure the QR code is well lit and fills most of the frame.</li>
            <li>If the scan repeats, move the badge away briefly before rescanning.</li>
            <li>Manual entry or image upload accepts the raw token printed under each QR code.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
