import { useState } from 'react';
import apiClient from '../lib/api';
import PhotoCapture from './PhotoCapture';
import LoadingSpinner from './LoadingSpinner';

export default function BiometricVerification({
  visitor,
  onVerified,
  onFailed,
  onClose,
}) {
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);

  const resetState = () => {
    setPhoto(null);
    setResult(null);
    setError(null);
  };

  const handlePhotoCaptured = async (photoBase64) => {
    setPhoto(photoBase64);
    setIsVerifying(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/biometric/verify', {
        visitor_id: visitor.id,
        photo_base64: photoBase64,
        match_threshold: 0.6,
      });

      setResult(response.data);

      if (response.data.fallback?.active) {
        onFailed?.(response.data);
      } else if (response.data.success && response.data.is_match) {
        onVerified?.(response.data);
      } else {
        onFailed?.(response.data);
      }
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message || 'Verification failed';
      setError(message);
      onFailed?.({ error: message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    resetState();
    onClose?.();
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-700 font-medium">Verifying visitor</p>
        <p className="text-lg font-semibold text-gray-900">{visitor.name}</p>
        <p className="text-sm text-gray-500">ID #{visitor.id} • {visitor.email}</p>
      </div>

      {!result && (
        <div className="space-y-3">
          <PhotoCapture onPhotoCaptured={handlePhotoCaptured} onClose={handleClose} />
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {isVerifying && (
            <div className="p-4 border border-gray-200 rounded-lg bg-white">
              <LoadingSpinner />
              <p className="mt-2 text-center text-sm text-gray-600">Verifying face...</p>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {photo && (
            <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
              <img src={photo} alt="Captured face" className="w-full h-full object-cover" />
            </div>
          )}

          {result.fallback?.active ? (
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">ℹ</span>
                <h3 className="font-semibold text-sky-900">Biometric Service Unavailable</h3>
              </div>
              <p className="text-sky-800 text-sm">{result.message}</p>
              <p className="text-sky-700 text-xs mt-1">
                Suggested action: {result.fallback?.allow_qr_check_in ? 'Continue with QR check-in policy' : 'Require manual identity review'}.
              </p>
            </div>
          ) : result.is_match ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✅</span>
                <h3 className="font-semibold text-green-900">Face Match</h3>
              </div>
              <p className="text-green-800 text-sm">Confidence: {(result.confidence_score * 100).toFixed(1)}%</p>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⚠</span>
                <h3 className="font-semibold text-yellow-900">No Match</h3>
              </div>
              <p className="text-yellow-800 text-sm">Confidence: {(result.confidence_score * 100).toFixed(1)}%</p>
              <p className="text-yellow-700 text-xs mt-1">Ask the visitor to try again or use QR check-in.</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { resetState(); setPhoto(null); }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Retake Photo
            </button>
            <button
              onClick={handleClose}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition ${result.is_match ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
