import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const MAX_429_RETRIES = 2;
const BASE_BACKOFF_MS = 350;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(retryAfterHeader) {
  if (!retryAfterHeader) return null;

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1000);
  }

  const asDate = Date.parse(retryAfterHeader);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
}

function isRetryable429(error) {
  const status = error?.response?.status;
  const method = error?.config?.method?.toLowerCase();
  return status === 429 && method === 'get';
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send cookie for admin auth
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error) || !error.config || !isRetryable429(error)) {
      return Promise.reject(error);
    }

    const config = error.config;
    config.__retryCount = config.__retryCount || 0;

    if (config.__retryCount >= MAX_429_RETRIES) {
      return Promise.reject(error);
    }

    const retryAfterMs = getRetryAfterMs(error.response?.headers?.['retry-after']);
    const exponentialDelay = BASE_BACKOFF_MS * (2 ** config.__retryCount);
    const jitter = Math.floor(Math.random() * 120);
    const waitMs = Math.max(retryAfterMs ?? 0, exponentialDelay + jitter);

    config.__retryCount += 1;
    await sleep(waitMs);
    return apiClient.request(config);
  }
);

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
