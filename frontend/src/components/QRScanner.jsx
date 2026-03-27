import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { motion } from 'framer-motion';

export default function QRScanner({ onScanSuccess, onClose }) {
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('camera');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  
  const preferredCameraIdRef = useRef(null);
  const recentScanRef = useRef({ token: '', timestamp: 0 });
  const html5QrCodeRef = useRef(null);
  const onScanSuccessRef = useRef(onScanSuccess);
  const isCameraRunningRef = useRef(false);
  const transitionLockRef = useRef(Promise.resolve());
  const startAttemptRef = useRef(0);
  
  const previewElementId = useMemo(
    () => `qr-live-preview-${Math.random().toString(36).slice(2, 10)}`,
    []
  );
  const fileScanElementId = useMemo(
    () => `qr-file-scan-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  const processToken = useCallback((token, source) => {
    const value = token.trim();
    if (!value) {
      return;
    }

    if (source === 'scan') {
      const { token: lastToken, timestamp } = recentScanRef.current;
      const now = Date.now();
      if (value === lastToken && now - timestamp < 3000) {
        return;
      }
      recentScanRef.current = { token: value, timestamp: now };
    }

    setError('');
    setCameraError('');
    onScanSuccessRef.current(value);
  }, []);

  const scannerConfig = useMemo(
    () => ({
      fps: 12,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const boxSize = Math.max(Math.floor(minEdge * 0.7), 220);
        return { width: boxSize, height: boxSize };
      },
      aspectRatio: 1,
      disableFlip: true,
      videoConstraints: {
        facingMode: 'environment',
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
      if (isCameraRunningRef.current || scanMode !== 'camera') {
        return;
      }

      const currentAttempt = ++startAttemptRef.current;

      if (!document.getElementById(previewElementId)) {
        return;
      }

      const scanner = ensureInstance();
      if (!scanner) {
        return;
      }

      try {
        setCameraError('');
        let cameraIdOrConfig;

        if (!preferredCameraIdRef.current) {
          const cameras = await Html5Qrcode.getCameras();
          if (!active || currentAttempt !== startAttemptRef.current) {
            return;
          }
          if (!cameras || cameras.length === 0) {
            setCameraError('No camera devices were found. Connect a camera and try again.');
            return;
          }
          const normalizeLabel = (label) => label.toLowerCase();
          const environmentCamera =
            cameras.find((device) => normalizeLabel(device.label).includes('back')) ??
            cameras.find((device) => normalizeLabel(device.label).includes('rear')) ??
            cameras.find((device) => normalizeLabel(device.label).includes('environment')) ??
            cameras[0];
          preferredCameraIdRef.current = environmentCamera.id;
        }

        cameraIdOrConfig = preferredCameraIdRef.current ?? { facingMode: 'environment' };

        if (!active || currentAttempt !== startAttemptRef.current || !document.getElementById(previewElementId)) {
          return;
        }

        await scanner.start(
          cameraIdOrConfig,
          scannerConfig,
          (decodedText) => {
            processToken(decodedText, 'scan');
          },
          (errorMessage) => {
            if (typeof errorMessage === 'string' && errorMessage.includes('NotFound')) {
              return;
            }
            console.warn('scanner warning', errorMessage);
          }
        );
        if (active) {
          isCameraRunningRef.current = true;
        } else {
          await scanner.stop();
        }
      } catch (error) {
        console.warn('Failed to start camera', error);
        if (active) {
          setCameraError('Unable to start the scanner. Check camera permissions or try a different device.');
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
        console.warn('Failed to stop camera', error);
      } finally {
        isCameraRunningRef.current = false;
      }
    };

    if (scanMode !== 'camera') {
      transitionLockRef.current = transitionLockRef.current
        .then(() => stopCamera())
        .catch(() => undefined);
    } else {
      transitionLockRef.current = transitionLockRef.current
        .then(() => startCamera())
        .catch(() => undefined);
    }

    return () => {
      active = false;
      startAttemptRef.current += 1;
      transitionLockRef.current = transitionLockRef.current
        .then(() => stopCamera())
        .catch(() => undefined);
    };
  }, [previewElementId, processToken, scannerConfig, scanMode]);

  useEffect(() => {
    return () => {
      const cleanup = async () => {
        startAttemptRef.current += 1;
        if (html5QrCodeRef.current) {
          try {
            if (isCameraRunningRef.current) {
              await html5QrCodeRef.current.stop();
            }
          } catch {
            /* ignore */
          }
          // Avoid calling clear() on teardown; the container may already be removed by modal unmount animation.
          html5QrCodeRef.current = null;
          isCameraRunningRef.current = false;
        }
      };

      void cleanup();
    };
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    processToken(manualToken, 'manual');
    setManualToken('');
  };

  const handleImageUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setError('');
      setCameraError('');
      setUploading(true);

      const wasRunning = isCameraRunningRef.current;
      if (wasRunning) {
        try {
          html5QrCodeRef.current?.pause(true);
        } catch (error) {
          console.warn('Failed to pause live scanner', error);
        }
      }

      let fileScanner;

      try {
        fileScanner = new Html5Qrcode(fileScanElementId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: true,
        });
        const decodedText = await fileScanner.scanFile(file, false);
        processToken(decodedText, 'image');
      } catch (error) {
        console.warn('Image decode failed', error);
        setError('Could not read a QR code from that image. Try a clearer, well-lit photo.');
      } finally {
        try {
          if (fileScanner && !fileScanner.isScanning) {
            await fileScanner.clear();
          }
        } catch {
          /* ignore */
        }
        if (wasRunning) {
          try {
            html5QrCodeRef.current?.resume();
          } catch (error) {
            console.warn('Failed to resume live scanner', error);
          }
        }
        setUploading(false);
        event.target.value = '';
      }
    },
    [fileScanElementId, processToken]
  );

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setScanMode('camera')}
          className={`flex-1 py-2.5 px-4 rounded-md font-semibold transition-all ${
            scanMode === 'camera'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Camera Scan
          </div>
        </button>
        <button
          onClick={() => setScanMode('manual')}
          className={`flex-1 py-2.5 px-4 rounded-md font-semibold transition-all ${
            scanMode === 'manual'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Manual Entry
          </div>
        </button>
      </div>

      {scanMode === 'camera' ? (
        <div>
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Position QR code within the frame
            </div>
          </div>

          <div className="relative">
            <div id={previewElementId} className="rounded-xl overflow-hidden shadow-lg border-2 border-gray-200 min-h-[320px] bg-black" />
            <div id={fileScanElementId} className="hidden" aria-hidden="true" />

            {/* Corner decorations */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg pointer-events-none"></div>
            <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg pointer-events-none"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg pointer-events-none"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg pointer-events-none"></div>
          </div>

          {cameraError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2"
            >
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{cameraError}</span>
            </motion.div>
          )}

          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Allow camera access when prompted to scan QR codes</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Hold the QR code steady within the highlighted area</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-3">No camera? Upload QR code image</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg font-semibold text-gray-700 cursor-pointer hover:border-blue-400">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M4 12l8-8 8 8M12 4v12" />
              </svg>
              <span>{uploading ? 'Processing…' : 'Upload QR Image'}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      ) : (
        <motion.div key="manual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Enter QR Token</label>
              <div className="relative">
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => {
                    setManualToken(e.target.value);
                    setError('');
                  }}
                  className={`w-full px-4 py-3.5 rounded-lg border-2 ${
                    error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  } focus:ring-2 focus:outline-none transition font-mono text-sm`}
                  placeholder="e.g., abc123-def456-ghi789"
                  autoFocus
                />
                {error && (
                  <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </motion.p>
                )}
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>The QR token is displayed on the visitor's registration confirmation page. Ask the visitor to provide their unique token code.</span>
                </p>
              </div>
            </div>
          </form>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        {scanMode === 'manual' && (
          <button
            onClick={handleManualSubmit}
            className="flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Submit Token
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`${scanMode === 'manual' ? 'flex-1' : 'w-full'} px-6 py-3.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
    </div>
  );
}
