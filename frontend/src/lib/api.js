import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const MAX_429_RETRIES = 2;
const BASE_BACKOFF_MS = 350;
const SWR_CACHE_PREFIX = 'ii_vms_swr_cache:';
const swrMemoryCache = new Map();

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

function generateRequestId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `req_${ts}_${rand}`;
}

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  if (!config.headers['x-request-id']) {
    config.headers['x-request-id'] = generateRequestId();
  }
  return config;
});

function buildSWRKey(url, params) {
  const suffix = params ? JSON.stringify(params) : '';
  return `${SWR_CACHE_PREFIX}${url}?${suffix}`;
}

function readSWRCache(key) {
  const mem = swrMemoryCache.get(key);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    swrMemoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeSWRCache(key, data) {
  const entry = {
    data,
    savedAt: Date.now(),
  };
  swrMemoryCache.set(key, entry);
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore storage quota or availability failures
  }
}

/**
 * Fetch GET data with stale-while-revalidate behavior.
 * Returns cached data immediately when fresh or stale-within-window,
 * and can trigger background refresh that invokes onUpdate.
 */
export async function getWithSWR(url, options = {}) {
  const {
    params,
    ttlMs = 30_000,
    staleMs = 5 * 60_000,
    forceNetwork = false,
    onUpdate,
  } = options;

  const cacheKey = buildSWRKey(url, params);
  const cached = forceNetwork ? null : readSWRCache(cacheKey);
  const ageMs = cached ? Date.now() - Number(cached.savedAt || 0) : Number.POSITIVE_INFINITY;

  const fetchNetwork = async () => {
    const response = await apiClient.get(url, { params });
    writeSWRCache(cacheKey, response.data);
    return response.data;
  };

  if (cached && ageMs <= ttlMs) {
    return {
      data: cached.data,
      cache: { hit: true, stale: false, ageMs },
    };
  }

  if (cached && ageMs <= staleMs) {
    if (typeof onUpdate === 'function') {
      void fetchNetwork()
        .then((fresh) => onUpdate(fresh))
        .catch(() => {
          // keep stale data if refresh fails
        });
    }
    return {
      data: cached.data,
      cache: { hit: true, stale: true, ageMs },
    };
  }

  const fresh = await fetchNetwork();
  return {
    data: fresh,
    cache: { hit: false, stale: false, ageMs: 0 },
  };
}

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
