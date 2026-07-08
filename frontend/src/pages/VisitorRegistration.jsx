import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '../lib/api';
import PhotoCapture from '../components/PhotoCapture';
import Modal from '../components/Modal';

/* ─── Inline SVG icons for form fields ─── */
const UserIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);
const MailIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);
const PhoneIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);
const PurposeIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

export default function VisitorRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [qrToken, setQrToken] = useState('');
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
      <div className="min-h-screen pt-28 pb-20 px-4 bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl mx-auto"
        >
          {/* Success card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Green banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-6 text-center text-white">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold">Registration Successful!</h2>
              <p className="text-emerald-100 text-sm mt-1">Save your QR code for check-in</p>
            </div>

            <div className="p-8">
              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-gray-200 inline-block">
                  <QRCodeSVG
                    id="qr-code-svg"
                    value={qrToken}
                    size={220}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              <div className="text-center mb-6">
                <p className="text-xs text-gray-400 mb-1">Token</p>
                <p className="font-mono text-xs font-semibold text-gray-600 break-all bg-gray-50 rounded-lg p-2">{qrToken}</p>
              </div>

              {/* Biometric status */}
              <AnimatePresence>
                {biometricStatus && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6"
                  >
                    <div className={`rounded-xl p-4 text-sm font-medium ${
                      biometricStatus === 'enrolled'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : biometricStatus === 'pending'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {biometricStatus === 'pending' && 'Enrolling face for biometric verification...'}
                      {biometricStatus === 'enrolled' && 'Biometric enrolled — your face is ready for secure check-in.'}
                      {biometricStatus === 'failed' && `Biometric enrollment failed: ${biometricError}`}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-sm text-blue-700">Save this QR code or take a screenshot. Present it at the entrance for quick check-in.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={downloadQRCode}
                  className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download QR Code
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
                >
                  Back to Home
                </button>
                <button
                  onClick={() => {
                    setSuccess(false);
                    setFormData({ name: '', email: '', phone: '', purpose: '' });
                    setCapturedPhoto('');
                  }}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
                >
                  Register Another Visitor
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-20 px-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto"
      >
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white text-center">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Visitor Registration</h2>
            <p className="text-blue-200 text-sm mt-1">Fill in the details below to receive your QR code</p>
          </div>

          <div className="p-8">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm"
              >
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><UserIcon /></div>
                  <input
                    type="text" name="name" value={formData.name} onChange={handleChange} required minLength={2}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-gray-50 focus:bg-white"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><MailIcon /></div>
                  <input
                    type="email" name="email" value={formData.email} onChange={handleChange} required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-gray-50 focus:bg-white"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><PhoneIcon /></div>
                  <input
                    type="tel" name="phone" value={formData.phone} onChange={handleChange} required minLength={10}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-gray-50 focus:bg-white"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Purpose of Visit</label>
                <div className="relative">
                  <div className="absolute top-3.5 left-3.5 pointer-events-none"><PurposeIcon /></div>
                  <textarea
                    name="purpose" value={formData.purpose} onChange={handleChange} required minLength={3} rows={3}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-gray-50 focus:bg-white resize-none"
                    placeholder="Meeting with..."
                  />
                </div>
              </div>

              {/* Photo capture */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Face Photo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Capture your face for biometric verification at check-in.
                </p>

                {!capturedPhoto ? (
                  <button
                    type="button"
                    onClick={() => setShowPhotoCapture(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 font-semibold hover:bg-blue-50 hover:border-blue-300 transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    Capture Face Photo
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="border-2 border-emerald-200 rounded-xl overflow-hidden bg-emerald-50">
                      <img src={capturedPhoto} alt="Captured face" className="w-full max-h-52 object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCapturedPhoto('')}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
                    >
                      Retake Photo
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Registering...
                  </>
                ) : (
                  'Register & Get QR Code'
                )}
              </button>
            </form>
          </div>
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
