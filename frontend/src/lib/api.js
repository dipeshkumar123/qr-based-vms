import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send cookie for admin auth
});

/**
 * Upload an image file to the backend.
 * @param {File} file - The image file to upload
 * @returns {Promise<{url: string}>} The uploaded file's URL
 */
export async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append('photo', file);
  const response = await apiClient.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Extract a user-friendly error message from an Axios error.
 * Centralizes the repeated `err.response?.data?.message` pattern.
 * @param {unknown} err
 * @param {string} fallback
 * @returns {string}
 */
export function getErrorMessage(err, fallback = 'An unexpected error occurred') {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.response?.data?.error || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export default apiClient;
