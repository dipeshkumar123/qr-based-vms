import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function PhotoCapture({ onPhotoCaptured }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [uploadMode, setUploadMode] = useState(false);

  function stopCamera() {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      console.log('Stopping camera - tracks to stop:', tracks.length);
      tracks.forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.label);
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  }

  // Handle video playback when camera becomes active
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      // Ensure the stream is attached
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      
      // Play the video
      videoRef.current.play().catch(err => {
        console.error('Video play error:', err);
        setCameraError('Unable to start video playback. ' + err.message);
      });
      
      console.log('Camera activated - stream playing');
    }
  }, [cameraActive]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError('');
      // Stop any existing streams first
      stopCamera();
      
      console.log('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      });
      
      console.log('Camera stream obtained, tracks:', stream.getTracks().length);
      
      // Store stream and set UI state
      streamRef.current = stream;
      setCameraActive(true);
      
    } catch (error) {
      const errorMessage = error.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access in browser settings.'
        : error.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : error.name === 'NotReadableError'
        ? 'Camera is in use by another application. Please close other apps using the camera.'
        : 'Unable to access camera: ' + error.message;
      setCameraError(errorMessage);
      console.error('Camera error:', error);
    }
  };

  const capturePhoto = () => {
    try {
      if (!videoRef.current || !canvasRef.current) {
        setCameraError('Camera not properly initialized.');
        return;
      }
      
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        setCameraError('Video stream not ready. Please wait a moment and try again.');
        return;
      }

      const context = canvasRef.current.getContext('2d');
      if (!context) {
        setCameraError('Unable to access canvas. Please refresh and try again.');
        return;
      }

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      const photoDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
      
      if (photoDataUrl && photoDataUrl.length > 100) {
        setCapturedPhoto(photoDataUrl);
        stopCamera();
      } else {
        setCameraError('Failed to capture photo. Please try again.');
      }
    } catch (error) {
      setCameraError('Error capturing photo: ' + error.message);
      console.error('Capture error:', error);
    }
  };

  const handleFileUpload = (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) {
        setCameraError('No file selected. Please choose an image.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setCameraError('Please select a valid image file.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setCameraError('Image is too large. Please select a file smaller than 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        setCameraError('Failed to read file. Please try again.');
      };
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (typeof dataUrl === 'string' && dataUrl.length > 100) {
          setCapturedPhoto(dataUrl);
          setUploadMode(false);
          setCameraError('');
        } else {
          setCameraError('Failed to process image. Please try again.');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setCameraError('Error uploading photo: ' + error.message);
      console.error('Upload error:', error);
    }
  };

  const handleConfirm = () => {
    if (capturedPhoto && capturedPhoto.length > 100) {
      try {
        onPhotoCaptured(capturedPhoto);
        setCapturedPhoto(null);
        setUploadMode(false);
        setCameraError('');
      } catch (error) {
        setCameraError('Error confirming photo: ' + error.message);
        console.error('Confirm error:', error);
      }
    } else {
      setCameraError('Invalid photo. Please try again.');
    }
  };

  const handleReset = () => {
    setCapturedPhoto(null);
    setCameraError('');
    if (!cameraActive) {
      startCamera();
    }
  };

  if (capturedPhoto) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <p className="text-sm font-semibold text-gray-700">Captured Photo</p>
        <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <img src={capturedPhoto} alt="Captured" className="w-full max-h-80 object-cover" />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
          >
            Use Photo
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-3 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400"
          >
            Retake
          </button>
        </div>
      </motion.div>
    );
  }

  if (uploadMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="photo-upload"
          />
          <label htmlFor="photo-upload" className="cursor-pointer">
            <svg className="w-12 h-12 text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M4 12l8-8 8 8" />
            </svg>
            <p className="font-semibold text-blue-600">Click to upload photo</p>
            <p className="text-sm text-gray-600">or drag and drop</p>
          </label>
        </div>
        <button
          onClick={() => {
            setUploadMode(false);
            startCamera();
          }}
          className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold"
        >
          Use Camera Instead
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {!cameraActive ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 text-center">
            Position your face in the center. Make sure you're well-lit and facing the camera.
          </p>
          <button
            onClick={startCamera}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Start Camera
          </button>
          <button
            onClick={() => setUploadMode(true)}
            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
          >
            Upload Photo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-video object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {/* Corner guides */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br"></div>
          </div>
          {cameraError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {cameraError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={capturePhoto}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              Capture Photo
            </button>
            <button
              onClick={() => {
                stopCamera();
                setUploadMode(true);
              }}
              className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400"
            >
              Upload Instead
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}
