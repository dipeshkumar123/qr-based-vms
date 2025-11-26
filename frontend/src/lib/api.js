import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add admin key interceptor if stored
apiClient.interceptors.request.use((config) => {
  const adminKey = localStorage.getItem('adminKey');
  if (adminKey && config.headers) {
    config.headers['x-admin-key'] = adminKey;
  }
  return config;
});

export default apiClient;
