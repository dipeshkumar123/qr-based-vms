import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '../lib/api';
import PhotoCapture from '../components/PhotoCapture';
import Modal from '../components/Modal';

export default function VisitorRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [visitorData, setVisitorData] = useState(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState('');
  const [biometricStatus, setBiometricStatus] = useState(''); // 'pending', 'enrolled', 'failed'
  const [biometricError, setBiometricError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    purpose: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setBiometricStatus('');
    setBiometricError('');

    try {
      const response = await apiClient.post('/api/visitors', formData);
      setQrToken(response.data.qrToken);
      setVisitorData(response.data);

      // If photo was captured, enroll in biometric system
      if (capturedPhoto) {
        await enrollBiometric(response.data.id, capturedPhoto);
      }

      setSuccess(true);

      // Record analytics event
      await apiClient.post('/api/analytics/events', {
        name: 'visitor_registered',
        payload: { 
          email: formData.email,
          biometric_enrolled: !!capturedPhoto
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const enrollBiometric = async (visitor_id, photo_base64) => {
    try {
      setBiometricStatus('pending');
      const response = await apiClient.post('/api/biometric/capture', {
        visitor_id,
        photo_base64
      });

      if (response.data.success && response.data.encoding_saved) {
        setBiometricStatus('enrolled');
      } else {
        setBiometricStatus('failed');
        setBiometricError(response.data.message || 'Failed to enroll biometric');
      }
    } catch (err) {
      setBiometricStatus('failed');
      setBiometricError(err.response?.data?.message || 'Biometric enrollment failed');
    }
  };

  const handlePhotoCaptured = (photoDataUrl) => {
    setCapturedPhoto(photoDataUrl);
    setShowPhotoCapture(false);
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code-svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `visitor-qr-${qrToken.substring(0, 8)}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (success) {
    return (
      <div className="min-h-screen pt-32 pb-20 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-4">Registration Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your QR code has been generated. Please save or screenshot this code for entry.
          </p>
          
          <div className="bg-white p-8 rounded-lg mb-6 border-2 border-gray-200">
            <div className="flex justify-center mb-4">
              <QRCodeSVG 
                id="qr-code-svg"
                value={qrToken} 
                size={256} 
                level="H" 
                includeMargin={true} 
              />
            </div>
            <p className="text-sm text-gray-500 mb-2 text-center">Your QR Token:</p>
            <p className="font-mono text-sm font-semibold break-all text-center text-gray-700">{qrToken}</p>
          </div>

          {biometricStatus && (
            <div className={`rounded-lg p-4 mb-6 ${
              biometricStatus === 'enrolled' 
                ? 'bg-green-50 border border-green-200' 
                : biometricStatus === 'pending'
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {biometricStatus === 'pending' && (
                <p className="text-sm text-yellow-800">
                  ⏳ Enrolling your face for biometric verification...
                </p>
              )}
              {biometricStatus === 'enrolled' && (
                <p className="text-sm text-green-800">
                  ✅ <strong>Biometric verified!</strong> Your face has been enrolled for secure check-in.
                </p>
              )}
              {biometricStatus === 'failed' && (
                <p className="text-sm text-red-800">
                  ❌ Biometric enrollment failed: {biometricError}
                </p>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              📱 <strong>Important:</strong> Save this QR code or take a screenshot. Present it at the entrance for quick check-in.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={downloadQRCode}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download QR Code
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition"
            >
              Back to Home
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setFormData({ name: '', email: '', phone: '', purpose: '' });
              }}
              className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Register Another Visitor
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20 px-4 bg-gradient-to-br from-blue-50 to-purple-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold mb-2 text-center">Visitor Registration</h2>
          <p className="text-gray-600 text-center mb-8">
            Please fill out the form below to receive your QR code
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                minLength={2}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                minLength={10}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Purpose of Visit *
              </label>
              <textarea
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                required
                minLength={3}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Meeting with..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Face Photo for Biometric Verification (optional)
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Capture your face for secure biometric verification at check-in. This helps ensure proper visitor identification.
              </p>
              
              {!capturedPhoto ? (
                <button
                  type="button"
                  onClick={() => setShowPhotoCapture(true)}
                  className="w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 font-semibold hover:bg-blue-50 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Capture Face Photo
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="border-2 border-green-300 rounded-lg p-3 bg-green-50">
                    <img src={capturedPhoto} alt="Captured face" className="w-full max-h-60 object-cover rounded" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto('')}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Retake Photo
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-[1.02] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registering...' : 'Register & Get QR Code'}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Photo Capture Modal */}
      <Modal
        isOpen={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
        title="Capture Face Photo"
      >
        <PhotoCapture
          onPhotoCaptured={handlePhotoCaptured}
          onClose={() => setShowPhotoCapture(false)}
        />
      </Modal>
    </div>
  );
}
