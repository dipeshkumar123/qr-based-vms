import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import apiClient, { getErrorMessage } from '../lib/api';

/**
 * ManagePhotosModal — lets admins view biometric enrollment status,
 * capture a new face encoding, or delete stored biometric data for a visitor.
 *
 * Works with the deployed biometric service via the backend proxy:
 *   GET  /api/biometric/info/:visitor_id
 *   POST /api/biometric/capture     { visitor_id, photo_base64 }
 *   DELETE /api/biometric/encoding/:visitor_id
 */
export default function ManagePhotosModal({ isOpen, onClose, visitor }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch enrollment info whenever modal opens
  useEffect(() => {
    if (isOpen && visitor) {
      fetchEnrollmentInfo();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, visitor]);

  const fetchEnrollmentInfo = async () => {
    if (!visitor) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`/api/biometric/info/${visitor.id}`);
      setInfo(response.data);
    } catch (err) {
      // 404 means no encoding stored yet — that's not an error
      if (err.response?.status === 404) {
        setInfo({ has_encoding: false });
      } else {
        setError(getErrorMessage(err, 'Failed to load biometric info'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Camera helpers ──────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch {
      setError('Failed to access camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => setCapturedImage(evt.target.result);
    reader.readAsDataURL(file);
  };

  // ── Capture encoding ────────────────────────────────
  const handleCaptureEncoding = async () => {
    if (!capturedImage) {
      setError('Please capture or upload an image first');
      return;
    }
    setCapturing(true);
    setError('');
    setSuccess('');
    try {
      const base64Data = capturedImage.includes(',')
        ? capturedImage.split(',')[1]
        : capturedImage;

      await apiClient.post('/api/biometric/capture', {
        visitor_id: visitor.id,
        photo_base64: base64Data,
      });
      setSuccess('Face encoding captured successfully!');
      setCapturedImage('');
      await fetchEnrollmentInfo();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to capture face encoding'));
    } finally {
      setCapturing(false);
    }
  };

  // ── Delete encoding ─────────────────────────────────
  const handleDeleteEncoding = async () => {
    if (!window.confirm('Delete all biometric data for this visitor? This cannot be undone.')) return;
    setError('');
    setSuccess('');
    try {
      await apiClient.delete(`/api/biometric/encoding/${visitor.id}`);
      setSuccess('Biometric data deleted.');
      setInfo({ has_encoding: false });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete biometric data'));
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage('');
    setError('');
    setSuccess('');
    setInfo(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">Manage Biometric Data</h2>
              <p className="text-gray-600 text-sm">
                {visitor?.name} ({visitor?.email})
              </p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {/* Enrollment Status */}
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-600 mt-2">Loading biometric info…</p>
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold mb-2">Enrollment Status</h3>
                {info?.has_encoding ? (
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                      <span className="font-medium text-green-700">Face encoding enrolled</span>
                    </p>
                    {info.encoded_at && (
                      <p className="text-gray-500">
                        Encoded: {new Date(info.encoded_at).toLocaleString()}
                      </p>
                    )}
                    {info.photo_count != null && (
                      <p className="text-gray-500">Photos on file: {info.photo_count}</p>
                    )}
                    <button
                      onClick={handleDeleteEncoding}
                      className="mt-2 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                    >
                      Delete Biometric Data
                    </button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm">
                    <span className="inline-block w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-gray-600">No face encoding stored yet</span>
                  </p>
                )}
              </div>

              {/* Capture Section */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold mb-3">
                  {info?.has_encoding ? 'Update Face Encoding' : 'Enroll Face Encoding'}
                </h3>

                {!capturedImage && !cameraActive && (
                  <div className="flex gap-3">
                    <button
                      onClick={startCamera}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Use Camera
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Image
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {cameraActive && (
                  <div className="space-y-3">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-lg border-2 border-blue-500"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-3">
                      <button
                        onClick={captureFromCamera}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                      >
                        Capture Photo
                      </button>
                      <button
                        onClick={stopCamera}
                        className="px-4 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {capturedImage && (
                  <div className="space-y-3">
                    <img
                      src={capturedImage}
                      alt="Captured face"
                      className="w-full max-h-64 object-contain rounded-lg border-2 border-gray-300"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleCaptureEncoding}
                        disabled={capturing}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                      >
                        {capturing ? 'Processing…' : 'Save Face Encoding'}
                      </button>
                      <button
                        onClick={() => setCapturedImage('')}
                        className="px-4 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition"
                      >
                        Retake
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
