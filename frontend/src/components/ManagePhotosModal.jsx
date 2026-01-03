import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import apiClient, { uploadImageFile } from '../lib/api';

export default function ManagePhotosModal({ isOpen, onClose, visitor }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && visitor) {
      fetchPhotos();
    }
  }, [isOpen, visitor]);

  const fetchPhotos = async () => {
    if (!visitor) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`/api/biometrics/photos/${visitor.qrToken}`);
      setPhotos(response.data.photos || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!newPhotoUrl.trim()) {
      setError('Please enter a valid URL');
      return;
    }
    setUploading(true);
    setError('');
    try {
      await apiClient.post(`/api/biometrics/photos/${visitor.qrToken}`, { url: newPhotoUrl });
      setNewPhotoUrl('');
      await fetchPhotos();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add photo');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImageFile(file);
      await apiClient.post(`/api/biometrics/photos/${visitor.qrToken}`, { url });
      await fetchPhotos();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    setError('');
    try {
      await apiClient.delete(`/api/biometrics/photos/${photoId}`);
      await fetchPhotos();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete photo');
    }
  };

  const handleClose = () => {
    setNewPhotoUrl('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">Manage Reference Photos</h2>
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

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Add Photo Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold mb-3">Add New Reference Photo</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="Enter photo URL (http://... or data:image/...)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={handleAddUrl}
                  disabled={uploading || !newPhotoUrl.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {uploading ? 'Adding...' : 'Add URL'}
                </button>
              </div>
              <div className="text-center">
                <span className="text-gray-500 text-sm">or</span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {uploading ? 'Uploading...' : 'Upload from Device'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Photos Grid */}
          <div>
            <h3 className="font-semibold mb-3">Stored Photos ({photos.length})</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading photos...</p>
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600">No reference photos yet</p>
                <p className="text-gray-500 text-sm">Add photos to enable face verification</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt="Reference"
                      className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EError%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    <button
                      onClick={() => handleDelete(photo.id)}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                      title="Delete photo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-60 text-white text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition">
                      {new Date(photo.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
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
